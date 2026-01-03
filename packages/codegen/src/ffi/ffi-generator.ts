import type { GirRepository, GirClass, GirNamespace, GirRecord } from "@gtkx/gir";
import { parseQualifiedName } from "@gtkx/gir";
import type { SourceFile } from "ts-morph";
import { GenerationContext } from "../core/generation-context.js";
import { CodegenProject } from "../core/project.js";
import { FfiMapper } from "../core/type-system/ffi-mapper.js";
import { isPrimitiveFieldType } from "../core/type-system/ffi-types.js";
import { normalizeClassName, toKebabCase, toPascalCase } from "../core/utils/naming.js";
import { parseParentReference } from "../core/utils/parent-reference.js";
import { buildFromPtrStatements } from "../core/utils/structure-helpers.js";
import { ImportsBuilder } from "../core/writers/imports-builder.js";
import { createWriters } from "../core/writers/index.js";
import { ClassGenerator } from "./generators/class/index.js";
import { ConstantGenerator } from "./generators/constant.js";
import { EnumGenerator } from "./generators/enum.js";
import { FunctionGenerator } from "./generators/function.js";
import { InterfaceGenerator } from "./generators/interface.js";
import { RecordGenerator } from "./generators/record/index.js";

/**
 * Configuration for generating a namespace's FFI bindings.
 *
 * Note: This is distinct from `FfiGeneratorOptions` in core/types.ts which
 * defines the shared options passed to sub-generators (sharedLibrary, etc.).
 */
type FfiNamespaceConfig = {
    outputDir: string;
    namespace: string;
    repository: GirRepository;
    /** Optional external project to use (for orchestrator mode) */
    project?: CodegenProject;
    /** If true, skip emit() and return files from memory (for orchestrator mode) */
    skipEmit?: boolean;
};

export class FfiGenerator {
    private ctx: GenerationContext;
    private options: FfiNamespaceConfig;
    private ffiMapper: FfiMapper;
    private project: CodegenProject;
    private namespacePrefix: string;

    constructor(options: FfiNamespaceConfig) {
        this.options = options;
        this.ctx = new GenerationContext();
        this.ffiMapper = new FfiMapper(options.repository, options.namespace);
        this.project = options.project ?? new CodegenProject();
        this.namespacePrefix = `${options.namespace.toLowerCase()}/`;
    }

    private createSourceFile(fileName: string): SourceFile {
        return this.project.createFfiSourceFile(`${this.namespacePrefix}${fileName}`);
    }

    /**
     * Gets the underlying CodegenProject.
     * Useful for orchestrator mode to access generated files and metadata.
     */
    getProject(): CodegenProject {
        return this.project;
    }

    private getNamespaceLibrary(namespaceName: string): string {
        const ns = this.options.repository.getNamespace(namespaceName);
        if (!ns || !ns.sharedLibrary) {
            throw new Error(`No shared library found for namespace: ${namespaceName}`);
        }
        const firstLib = ns.sharedLibrary.split(",")[0];
        if (!firstLib) {
            throw new Error(`Invalid shared library format for namespace: ${namespaceName}`);
        }
        return firstLib.trim();
    }

    async generateNamespace(namespaceName: string): Promise<Map<string, string>> {
        const namespace = this.options.repository.getNamespace(namespaceName);
        if (!namespace) {
            throw new Error(`Namespace ${namespaceName} not found in repository`);
        }

        const glibLibrary = this.getNamespaceLibrary("GLib");
        const gobjectLibrary = this.getNamespaceLibrary("GObject");

        this.ffiMapper.clearSkippedClasses();
        this.registerRecords(namespace);
        this.registerInterfaces(namespace);

        const writers = createWriters({
            sharedLibrary: namespace.sharedLibrary,
            glibLibrary,
        });

        const allEnums = [...namespace.enumerations.values(), ...namespace.bitfields.values()];
        if (allEnums.length > 0) {
            const enumFile = this.createSourceFile("enums.ts");
            const enumGenerator = new EnumGenerator(enumFile, { namespace: this.options.namespace });
            enumGenerator.addEnums(allEnums);
        }

        const generatorOptions = {
            namespace: this.options.namespace,
            sharedLibrary: namespace.sharedLibrary,
            glibLibrary,
            gobjectLibrary,
        };

        const recordGenerator = new RecordGenerator(this.ffiMapper, this.ctx, writers, generatorOptions);

        for (const [, record] of namespace.records) {
            if (this.shouldGenerateRecord(record)) {
                this.ctx.reset();
                this.ctx.currentNamespace = this.options.namespace;
                const fileName = `${toKebabCase(record.name)}.ts`;
                const sourceFile = this.createSourceFile(fileName);

                recordGenerator.generateToSourceFile(record, sourceFile);

                const importsBuilder = new ImportsBuilder(this.ctx, {
                    namespace: this.options.namespace,
                    currentClassName: normalizeClassName(record.name, this.options.namespace),
                });
                importsBuilder.applyToSourceFile(sourceFile);
            } else if (this.isUsableStubRecord(record)) {
                const fileName = `${toKebabCase(record.name)}.ts`;
                const sourceFile = this.createSourceFile(fileName);
                const recordName = normalizeClassName(record.name, this.options.namespace);

                sourceFile.addImportDeclaration({
                    moduleSpecifier: "../../native/base.js",
                    namedImports: ["NativeObject"],
                });

                const classDecl = sourceFile.addClass({
                    name: recordName,
                    isExported: true,
                    extends: "NativeObject",
                    docs: [{ description: `Stub class for ${record.name} (opaque type not fully generated)` }],
                });

                if (record.glibTypeName) {
                    classDecl.addProperty({
                        name: "glibTypeName",
                        isStatic: true,
                        isReadonly: true,
                        type: "string",
                        initializer: `"${record.glibTypeName}"`,
                    });
                }

                classDecl.addProperty({
                    name: "objectType",
                    isStatic: true,
                    isReadonly: true,
                    initializer: '"boxed" as const',
                });

                classDecl.addMethod({
                    name: "fromPtr",
                    isStatic: true,
                    parameters: [{ name: "ptr", type: "unknown" }],
                    returnType: recordName,
                    statements: buildFromPtrStatements(recordName),
                });
            }
        }

        const sortedClasses = this.topologicalSortClasses([...namespace.classes.values()]);
        for (const cls of sortedClasses) {
            this.ctx.reset();
            this.ctx.currentNamespace = this.options.namespace;

            const classGenerator = new ClassGenerator(
                cls,
                this.ffiMapper,
                this.ctx,
                this.options.repository,
                writers,
                generatorOptions,
            );

            const fileName = `${toKebabCase(cls.name)}.ts`;
            const sourceFile = this.createSourceFile(fileName);

            const result = classGenerator.generateToSourceFile(sourceFile);
            if (result.success) {
                const className = normalizeClassName(cls.name, this.options.namespace);
                const parentInfo = this.getParentInfo(cls.parent);

                const importsBuilder = new ImportsBuilder(this.ctx, {
                    namespace: this.options.namespace,
                    currentClassName: className,
                    parentClassName:
                        parentInfo.hasParent && !parentInfo.isCrossNamespace ? parentInfo.className : undefined,
                    parentOriginalName:
                        parentInfo.hasParent && !parentInfo.isCrossNamespace ? parentInfo.originalName : undefined,
                    parentNamespace: parentInfo.isCrossNamespace ? parentInfo.namespace : undefined,
                });
                importsBuilder.applyToSourceFile(sourceFile);

                if (result.widgetMeta) {
                    this.project.metadata.setWidgetMeta(sourceFile, result.widgetMeta);
                }
            } else {
                this.project.getProject().removeSourceFile(sourceFile);
                this.ffiMapper.registerSkippedClass(cls.name);
            }
        }

        const interfaceGenerator = new InterfaceGenerator(
            this.ffiMapper,
            this.ctx,
            writers,
            this.options.repository,
            generatorOptions,
        );

        for (const [, iface] of namespace.interfaces) {
            this.ctx.reset();
            this.ctx.currentNamespace = this.options.namespace;
            const fileName = `${toKebabCase(iface.name)}.ts`;
            const sourceFile = this.createSourceFile(fileName);

            interfaceGenerator.generateToSourceFile(iface, sourceFile);

            const importsBuilder = new ImportsBuilder(this.ctx, {
                namespace: this.options.namespace,
                currentClassName: toPascalCase(iface.name),
            });
            importsBuilder.applyToSourceFile(sourceFile);
        }

        const standaloneFunctions = [...namespace.functions.values()];
        if (standaloneFunctions.length > 0) {
            this.ctx.reset();
            this.ctx.currentNamespace = this.options.namespace;

            const functionGenerator = new FunctionGenerator(this.ffiMapper, this.ctx, writers, generatorOptions);

            const sourceFile = this.createSourceFile("functions.ts");
            functionGenerator.generateToSourceFile(standaloneFunctions, sourceFile);

            const importsBuilder = new ImportsBuilder(this.ctx, {
                namespace: this.options.namespace,
            });
            importsBuilder.applyToSourceFile(sourceFile);
        }

        if (namespace.constants.size > 0) {
            const constantsFile = this.createSourceFile("constants.ts");
            const constantGenerator = new ConstantGenerator(constantsFile, { namespace: this.options.namespace });
            constantGenerator.addConstants([...namespace.constants.values()]);
        }

        const namespaceFiles = this.project.getSourceFilesInNamespace(this.options.namespace);
        const ffiNamespacePrefix = `ffi/${this.namespacePrefix}`;
        const relativeNames = namespaceFiles.map((sf) => {
            const fullPath = sf.getFilePath().replace(/^\//, "");
            return fullPath.replace(ffiNamespacePrefix, "");
        });
        this.project.createIndexSourceFile(`ffi/${this.namespacePrefix}index.ts`, relativeNames);

        if (this.options.skipEmit) {
            return new Map();
        }

        return this.project.emit();
    }

    private registerRecords(namespace: GirNamespace): void {
        for (const [, record] of namespace.records) {
            if (this.shouldGenerateRecord(record)) {
                const normalizedName = normalizeClassName(record.name, this.options.namespace);
                this.ctx.recordNameToFile.set(normalizedName, record.name);
            }
        }
    }

    private shouldGenerateRecord(record: GirRecord): boolean {
        if (record.disguised) return false;

        if (record.isGtypeStruct()) return false;

        if (record.name.endsWith("Private")) return false;

        if (record.glibTypeName) return true;

        if (record.opaque || record.fields.length === 0) return false;

        const publicFields = record.getPublicFields();
        if (publicFields.length === 0) return false;

        return publicFields.every((field) => isPrimitiveFieldType(field.type.name as string));
    }

    private isUsableStubRecord(record: GirRecord): boolean {
        if (record.glibTypeName) return true;

        if (record.name.endsWith("Private")) return false;

        const coreTypeStructs = ["TypeClass", "TypeInterface", "EnumClass", "FlagsClass", "ObjectClass", "AttrClass"];
        if (coreTypeStructs.includes(record.name)) return true;

        if (record.isGtypeStruct()) return false;

        return true;
    }

    private registerInterfaces(namespace: GirNamespace): void {
        for (const [, iface] of namespace.interfaces) {
            const normalizedName = toPascalCase(iface.name);
            this.ctx.interfaceNameToFile.set(normalizedName, iface.name);
        }
    }

    private topologicalSortClasses(classes: GirClass[]): GirClass[] {
        const classMap = new Map<string, GirClass>();
        for (const cls of classes) {
            classMap.set(cls.name, cls);
        }

        const sorted: GirClass[] = [];
        const visited = new Set<string>();

        const visit = (cls: GirClass) => {
            if (visited.has(cls.name)) return;
            visited.add(cls.name);
            if (cls.parent) {
                const { name: parentName } = parseQualifiedName(cls.parent);
                const parent = classMap.get(parentName);
                if (parent) {
                    visit(parent);
                }
            }
            sorted.push(cls);
        };

        for (const cls of classes) {
            visit(cls);
        }

        return sorted;
    }

    private getParentInfo(parent: string | null) {
        return parseParentReference(parent, this.options.namespace);
    }
}
