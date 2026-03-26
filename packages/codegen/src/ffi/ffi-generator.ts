/**
 * FFI Generator
 *
 * Top-level orchestrator for generating TypeScript FFI bindings from GIR data.
 * Produces GeneratedFile arrays using FileBuilder.
 */

import type { GirClass, GirNamespace, GirRecord, GirRepository } from "@gtkx/gir";
import { type FileBuilder, fileBuilder } from "../builders/file-builder.js";
import { classDecl, method, param, property } from "../builders/index.js";
import { stringify } from "../builders/stringify.js";
import { CodegenMetadata } from "../core/codegen-metadata.js";
import type { GeneratedFile } from "../core/generated-file-set.js";
import type { FfiGeneratorOptions } from "../core/generator-types.js";
import { FfiMapper } from "../core/type-system/ffi-mapper.js";
import { boxedSelfType, isPrimitiveFieldType } from "../core/type-system/ffi-types.js";
import { filterSupportedMethods } from "../core/utils/filtering.js";
import { normalizeClassName, toCamelCase, toKebabCase, toPascalCase, toValidMemberName } from "../core/utils/naming.js";
import { splitQualifiedName } from "../core/utils/qualified-name.js";
import { createMethodBodyWriter } from "../core/writers/index.js";
import { ClassGenerator } from "./generators/class/index.js";
import { ConstantGenerator } from "./generators/constant.js";
import { EnumGenerator } from "./generators/enum.js";
import { FunctionGenerator } from "./generators/function.js";
import { InterfaceGenerator } from "./generators/interface.js";
import { RecordGenerator } from "./generators/record/index.js";

/**
 * Configuration for generating a namespace's FFI bindings.
 */
type FfiNamespaceConfig = {
    outputDir: string;
    namespace: string;
    repository: GirRepository;
};

/**
 * Result of generating a namespace's FFI bindings.
 */
type FfiNamespaceResult = {
    files: GeneratedFile[];
    metadata: CodegenMetadata;
};

/**
 * Generates TypeScript FFI bindings for a GIR namespace.
 *
 * Processes classes, records, interfaces, enums, functions, and constants
 * from GIR data and outputs TypeScript wrappers for `@gtkx/ffi`.
 */
export class FfiGenerator {
    private readonly options: FfiNamespaceConfig;
    private readonly ffiMapper: FfiMapper;
    private readonly namespacePrefix: string;
    private readonly metadata = new CodegenMetadata();
    private readonly recordNameToFile = new Map<string, string>();
    private readonly interfaceNameToFile = new Map<string, string>();

    constructor(options: FfiNamespaceConfig) {
        this.options = options;
        this.ffiMapper = new FfiMapper(options.repository, options.namespace);
        this.namespacePrefix = `${options.namespace.toLowerCase()}/`;
    }

    /**
     * Gets the metadata collected during generation.
     */
    getMetadata(): CodegenMetadata {
        return this.metadata;
    }

    private getNamespaceLibrary(namespaceName: string): string {
        const ns = this.options.repository.getNamespace(namespaceName);
        if (!ns?.sharedLibrary) {
            throw new Error(`No shared library found for namespace: ${namespaceName}`);
        }
        const firstLib = ns.sharedLibrary.split(",")[0];
        if (!firstLib) {
            throw new Error(`Invalid shared library format for namespace: ${namespaceName}`);
        }
        return firstLib.trim();
    }

    /**
     * Generates all FFI files for a namespace.
     */
    generateNamespace(namespaceName: string): FfiNamespaceResult {
        const namespace = this.options.repository.getNamespace(namespaceName);
        if (!namespace) {
            throw new Error(`Namespace ${namespaceName} not found in repository`);
        }

        const glibLibrary = this.getNamespaceLibrary("GLib");
        const gobjectLibrary = this.getNamespaceLibrary("GObject");

        this.ffiMapper.clearSkippedClasses();
        this.registerRecords(namespace);
        this.registerInterfaces(namespace);

        const files: GeneratedFile[] = [];

        const generatorOptions: FfiGeneratorOptions = {
            namespace: this.options.namespace,
            sharedLibrary: namespace.sharedLibrary,
            glibLibrary,
            gobjectLibrary,
        };

        const allEnums = [...namespace.enumerations.values(), ...namespace.bitfields.values()];
        if (allEnums.length > 0) {
            const file = fileBuilder();
            const enumGenerator = new EnumGenerator(file, { namespace: this.options.namespace });
            enumGenerator.addEnums(allEnums);
            files.push({ path: `${this.namespacePrefix}enums.ts`, content: stringify(file) });
        }

        for (const [, record] of namespace.records) {
            if (this.shouldGenerateRecord(record)) {
                const file = fileBuilder();
                const recordGenerator = new RecordGenerator(
                    this.ffiMapper,
                    file,
                    generatorOptions,
                    this.options.repository,
                );
                recordGenerator.generate(record);
                const fileName = `${toKebabCase(record.name)}.ts`;
                files.push({ path: `${this.namespacePrefix}${fileName}`, content: stringify(file) });
            } else if (this.isUsableStubRecord(record)) {
                const file = this.generateStubRecord(record, namespace, generatorOptions);
                if (file) {
                    const fileName = `${toKebabCase(record.name)}.ts`;
                    files.push({ path: `${this.namespacePrefix}${fileName}`, content: stringify(file) });
                }
            }
        }

        const sortedClasses = this.topologicalSortClasses([...namespace.classes.values()]);
        for (const cls of sortedClasses) {
            const file = fileBuilder();
            const classGenerator = new ClassGenerator(
                cls,
                this.ffiMapper,
                file,
                this.options.repository,
                generatorOptions,
            );

            const result = classGenerator.generate();
            if (result.success) {
                const fileName = `${toKebabCase(cls.name)}.ts`;
                const filePath = `${this.namespacePrefix}${fileName}`;
                files.push({ path: filePath, content: stringify(file) });

                if (result.widgetMeta) {
                    this.metadata.setWidgetMeta(filePath, result.widgetMeta);
                }
                if (result.controllerMeta) {
                    this.metadata.setControllerMeta(filePath, result.controllerMeta);
                }
            } else {
                this.ffiMapper.registerSkippedClass(cls.name);
            }
        }

        for (const [, iface] of namespace.interfaces) {
            const file = fileBuilder();
            const interfaceGenerator = new InterfaceGenerator(
                this.ffiMapper,
                file,
                this.options.repository,
                generatorOptions,
            );

            interfaceGenerator.generate(iface);
            const fileName = `${toKebabCase(iface.name)}.ts`;
            files.push({ path: `${this.namespacePrefix}${fileName}`, content: stringify(file) });
        }

        const standaloneFunctions = [...namespace.functions.values()];
        if (standaloneFunctions.length > 0) {
            const file = fileBuilder();
            const functionGenerator = new FunctionGenerator(this.ffiMapper, file, generatorOptions);
            functionGenerator.generate(standaloneFunctions);
            files.push({ path: `${this.namespacePrefix}functions.ts`, content: stringify(file) });
        }

        if (namespace.constants.size > 0) {
            const file = fileBuilder();
            const constantGenerator = new ConstantGenerator(file, { namespace: this.options.namespace });
            constantGenerator.addConstants([...namespace.constants.values()]);
            files.push({ path: `${this.namespacePrefix}constants.ts`, content: stringify(file) });
        }

        const indexContent = this.generateIndexFile(files);
        files.push({ path: `${this.namespacePrefix}index.ts`, content: indexContent });

        return { files, metadata: this.metadata };
    }

    private generateStubRecord(
        record: GirRecord,
        namespace: GirNamespace,
        generatorOptions: FfiGeneratorOptions,
    ): FileBuilder | null {
        const file = fileBuilder();
        const recordName = normalizeClassName(record.name);

        file.addImport("../../object.js", ["NativeObject"]);
        if (record.methods.length === 0) {
            file.addImport("../../object.js", ["NativeHandle"]);
        }

        const cls = classDecl(recordName, {
            exported: true,
            extends: "NativeObject",
            doc: `Stub class for ${record.name} (opaque type not fully generated)`,
        });

        if (record.glibTypeName) {
            cls.addProperty(
                property("glibTypeName", {
                    isStatic: true,
                    readonly: true,
                    type: "string",
                    initializer: `"${record.glibTypeName}"`,
                }),
            );
        }

        cls.addProperty(
            property("objectType", {
                isStatic: true,
                readonly: true,
                initializer: '"boxed" as const',
            }),
        );

        if (record.methods.length > 0) {
            const methodBody = createMethodBodyWriter(this.ffiMapper, file, {
                sharedLibrary: generatorOptions.sharedLibrary,
                glibLibrary: generatorOptions.glibLibrary,
                selfNames: new Set([recordName]),
            });
            const supportedMethods = filterSupportedMethods(record.methods, (params) =>
                methodBody.hasUnsupportedCallbacks(params),
            );

            if (supportedMethods.length > 0) {
                file.addImport("../../native.js", ["call"]);
                file.addImport("../../object.js", ["NativeHandle"]);
                file.addImport("../../registry.js", ["getNativeObject"]);

                for (const m of supportedMethods) {
                    const methodName = toValidMemberName(toCamelCase(m.name));
                    const instanceOwnership = m.instanceParameter?.transferOwnership === "full" ? "full" : "borrowed";
                    const selfTypeDescriptor = boxedSelfType(
                        record.cType,
                        namespace.sharedLibrary ?? "",
                        record.glibGetType,
                        instanceOwnership,
                    );

                    const struct = methodBody.buildMethodStructure(m, {
                        methodName,
                        selfTypeDescriptor,
                        sharedLibrary: namespace.sharedLibrary ?? "",
                        namespace: this.options.namespace,
                        className: record.cType,
                    });

                    cls.addMethod(
                        method(struct.name, {
                            params: struct.parameters.map((p) =>
                                param(p.name, p.type, { optional: p.optional, rest: p.isRestParameter }),
                            ),
                            returnType: struct.returnType,
                            body: struct.statements,
                            isStatic: struct.isStatic,
                            doc: struct.docs?.[0]?.description,
                        }),
                    );
                }
            }
        }

        file.add(cls);
        return file;
    }

    private generateIndexFile(files: GeneratedFile[]): string {
        const exportLines = files
            .map((f) => {
                const relativeName = f.path.replace(this.namespacePrefix, "").replace(/\.ts$/, "");
                return relativeName;
            })
            .filter((name) => name !== "index")
            .sort()
            .map((name) => `export * from "./${name}.js";`)
            .join("\n");

        return exportLines ? `${exportLines}\n` : "";
    }

    private registerRecords(namespace: GirNamespace): void {
        for (const [, record] of namespace.records) {
            if (this.shouldGenerateRecord(record)) {
                const normalizedName = normalizeClassName(record.name);
                this.recordNameToFile.set(normalizedName, record.name);
            }
        }
    }

    private isGeneratableFieldType(typeName: string, visited: Set<string> = new Set()): boolean {
        if (isPrimitiveFieldType(typeName)) return true;

        if (visited.has(typeName)) return false;
        visited.add(typeName);

        const resolved = this.resolveRecordType(typeName);
        if (!resolved) return false;

        if (resolved.glibTypeName) return true;

        if (resolved.opaque || resolved.disguised) return false;

        const publicFields = resolved.getPublicFields();
        if (publicFields.length === 0) return false;

        return publicFields.every((field) => this.isGeneratableFieldType(field.type.name as string, visited));
    }

    private resolveRecordType(typeName: string): GirRecord | null {
        if (typeName.includes(".")) {
            return this.options.repository.resolveRecord(typeName);
        }

        const ns = this.options.repository.getNamespace(this.options.namespace);
        if (!ns) return null;

        return ns.records.get(typeName) ?? null;
    }

    private shouldGenerateRecord(record: GirRecord): boolean {
        if (record.disguised) return false;

        if (record.isGtypeStruct()) return false;

        if (record.name.endsWith("Private")) return false;

        if (record.glibTypeName) return true;

        if (record.opaque || record.fields.length === 0) return false;

        const publicFields = record.getPublicFields();
        if (publicFields.length === 0) return false;

        return publicFields.some((field) => this.isGeneratableFieldType(field.type.name as string));
    }

    private isUsableStubRecord(record: GirRecord): boolean {
        if (record.glibTypeName) return true;

        if (record.name.endsWith("Private")) return false;

        const coreTypeStructs = ["TypeClass", "TypeInterface", "EnumClass", "FlagsClass", "ObjectClass", "AttrClass"];
        if (coreTypeStructs.includes(record.name)) return true;

        return true;
    }

    private registerInterfaces(namespace: GirNamespace): void {
        for (const [, iface] of namespace.interfaces) {
            const normalizedName = toPascalCase(iface.name);
            this.interfaceNameToFile.set(normalizedName, iface.name);
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
                const { name: parentName } = splitQualifiedName(cls.parent);
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
}
