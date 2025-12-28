import type { GirClass, GirNamespace, GirRecord, TypeRegistry } from "@gtkx/gir";
import { normalizeClassName, TypeMapper, toKebabCase, toPascalCase } from "@gtkx/gir";
import { format } from "prettier";
import { GenerationContext } from "./generation-context.js";
import { generateConstants } from "./generators/constant-generator.js";
import { generateEnums } from "./generators/enum-generator.js";
import {
    ClassGenerator,
    FunctionGenerator,
    type GeneratorOptions,
    InterfaceGenerator,
    RecordGenerator,
} from "./generators/index.js";
import { generateIndex } from "./generators/index-generator.js";

type CodeGeneratorOptions = {
    outputDir: string;
    namespace: string;
    prettierConfig?: unknown;
    typeRegistry?: TypeRegistry;
    allNamespaces?: Map<string, GirNamespace>;
};

export class CodeGenerator {
    private typeMapper: TypeMapper;
    private ctx: GenerationContext;
    private options: CodeGeneratorOptions;

    private classGenerator: ClassGenerator;
    private interfaceGenerator: InterfaceGenerator;
    private recordGenerator: RecordGenerator;
    private functionGenerator: FunctionGenerator;

    constructor(options: CodeGeneratorOptions) {
        this.options = options;
        this.typeMapper = new TypeMapper();
        this.ctx = new GenerationContext();

        if (options.typeRegistry) {
            this.typeMapper.setTypeRegistry(options.typeRegistry, options.namespace);
        }

        const generatorOptions: GeneratorOptions = {
            namespace: options.namespace,
            prettierConfig: options.prettierConfig,
            typeRegistry: options.typeRegistry,
            allNamespaces: options.allNamespaces,
        };

        this.classGenerator = new ClassGenerator(this.typeMapper, this.ctx, generatorOptions);
        this.interfaceGenerator = new InterfaceGenerator(this.typeMapper, this.ctx, generatorOptions);
        this.recordGenerator = new RecordGenerator(this.typeMapper, this.ctx, generatorOptions);
        this.functionGenerator = new FunctionGenerator(this.typeMapper, this.ctx, generatorOptions);
    }

    private get formatOptions() {
        return { namespace: this.options.namespace, prettierConfig: this.options.prettierConfig };
    }

    async generateNamespace(namespace: GirNamespace): Promise<Map<string, string>> {
        const files = new Map<string, string>();

        this.ctx.currentSharedLibrary = namespace.sharedLibrary;
        this.typeMapper.clearSkippedClasses();
        this.registerEnumsAndBitfields(namespace);
        this.registerRecords(namespace);
        this.registerInterfaces(namespace);
        const classMap = this.buildClassMap(namespace);
        const interfaceMap = this.buildInterfaceMap(namespace);

        const allEnums = [...namespace.enumerations, ...namespace.bitfields];
        if (allEnums.length > 0) {
            files.set("enums.ts", await generateEnums(allEnums, this.formatOptions));
        }

        for (const record of namespace.records) {
            if (this.shouldGenerateRecord(record)) {
                this.ctx.reset(this.typeMapper);
                const code = await this.recordGenerator.generateRecord(record, namespace.sharedLibrary);
                const imports = this.generateImports(normalizeClassName(record.name, this.options.namespace));
                files.set(`${toKebabCase(record.name)}.ts`, await this.formatCode(imports + code));
            }
        }

        const sortedClasses = this.topologicalSortClasses(namespace.classes, classMap);
        for (const cls of sortedClasses) {
            this.ctx.reset(this.typeMapper);
            const generatedClass = await this.classGenerator.generateClass(
                cls,
                namespace.sharedLibrary,
                classMap,
                interfaceMap,
            );
            if (generatedClass !== null) {
                const className = normalizeClassName(cls.name, this.options.namespace);
                const parentInfo = this.parseParentReference(cls.parent, classMap);
                const imports = this.generateImports(
                    className,
                    parentInfo.hasParent && !parentInfo.isCrossNamespace ? parentInfo.className : undefined,
                    parentInfo.isCrossNamespace ? parentInfo.namespace : undefined,
                );
                files.set(`${toKebabCase(cls.name)}.ts`, await this.formatCode(imports + generatedClass));
            } else {
                this.typeMapper.registerSkippedClass(cls.name);
            }
        }

        for (const iface of namespace.interfaces) {
            this.ctx.reset(this.typeMapper);
            const code = await this.interfaceGenerator.generateInterface(iface, namespace.sharedLibrary, interfaceMap);
            const imports = this.generateImports(toPascalCase(iface.name));
            files.set(`${toKebabCase(iface.name)}.ts`, await this.formatCode(imports + code));
        }

        const standaloneFunctions = namespace.functions;
        if (standaloneFunctions.length > 0) {
            this.ctx.reset(this.typeMapper);
            const code = await this.functionGenerator.generateFunctions(standaloneFunctions, namespace.sharedLibrary);
            const imports = this.generateImports();
            files.set("functions.ts", await this.formatCode(imports + code));
        }

        if (namespace.constants.length > 0) {
            files.set("constants.ts", await generateConstants(namespace.constants, this.formatOptions));
        }

        files.set("index.ts", await generateIndex(files.keys(), this.options.prettierConfig));

        return files;
    }

    private registerEnumsAndBitfields(namespace: GirNamespace): void {
        for (const enumeration of namespace.enumerations) {
            this.typeMapper.registerEnum(enumeration.name, toPascalCase(enumeration.name));
        }
        for (const bitfield of namespace.bitfields) {
            this.typeMapper.registerEnum(bitfield.name, toPascalCase(bitfield.name));
        }
    }

    private registerRecords(namespace: GirNamespace): void {
        for (const record of namespace.records) {
            if (this.shouldGenerateRecord(record)) {
                const normalizedName = normalizeClassName(record.name, this.options.namespace);
                this.typeMapper.registerRecord(record.name, normalizedName, record.glibTypeName);
                this.ctx.recordNameToFile.set(normalizedName, record.name);
            }
        }
    }

    private shouldGenerateRecord(record: GirRecord): boolean {
        if (record.disguised) return false;
        // Filter out widget class vtables but keep core GObject types
        if (record.name.endsWith("Class") && record.name !== "TypeClass") return false;
        if (record.name.endsWith("Private")) return false;
        if (record.name.endsWith("Iface")) return false;
        if (record.name.endsWith("Interface") && record.name !== "TypeInterface") return false;

        if (record.glibTypeName) return true;

        if (record.opaque || record.fields.length === 0) return false;

        // Plain structs must have at least one public primitive field
        // Records with only private fields are opaque and not plain structs
        const publicFields = record.fields.filter((f) => !f.private);
        if (publicFields.length === 0) return false;

        const primitiveTypes = new Set([
            "gint", "guint", "gint8", "guint8", "gint16", "guint16",
            "gint32", "guint32", "gint64", "guint64", "gfloat", "gdouble",
            "gboolean", "gchar", "guchar", "gsize", "gssize", "glong", "gulong",
        ]);

        return publicFields.every((field) => primitiveTypes.has(field.type.name));
    }

    private buildClassMap(namespace: GirNamespace): Map<string, GirClass> {
        const classMap = new Map<string, GirClass>();
        for (const cls of namespace.classes) {
            classMap.set(cls.name, cls);
        }
        return classMap;
    }

    private registerInterfaces(namespace: GirNamespace): void {
        for (const iface of namespace.interfaces) {
            const normalizedName = toPascalCase(iface.name);
            this.ctx.interfaceNameToFile.set(normalizedName, iface.name);
        }
    }

    private buildInterfaceMap(namespace: GirNamespace): Map<string, (typeof namespace.interfaces)[number]> {
        const interfaceMap = new Map<string, (typeof namespace.interfaces)[number]>();
        for (const iface of namespace.interfaces) {
            interfaceMap.set(iface.name, iface);
        }
        return interfaceMap;
    }

    private topologicalSortClasses(classes: GirClass[], classMap: Map<string, GirClass>): GirClass[] {
        const sorted: GirClass[] = [];
        const visited = new Set<string>();

        const visit = (cls: GirClass) => {
            if (visited.has(cls.name)) return;
            visited.add(cls.name);
            if (cls.parent && classMap.has(cls.parent)) {
                const parent = classMap.get(cls.parent) as GirClass;
                visit(parent);
            }
            sorted.push(cls);
        };

        for (const cls of classes) {
            visit(cls);
        }

        return sorted;
    }

    private parseParentReference(
        parent: string | undefined,
        classMap: Map<string, GirClass>,
    ): { hasParent: boolean; isCrossNamespace: boolean; namespace?: string; className: string } {
        if (!parent) {
            return { hasParent: false, isCrossNamespace: false, className: "" };
        }

        if (parent.includes(".")) {
            const [ns, className] = parent.split(".", 2);
            if (ns && className) {
                const normalizedClass = normalizeClassName(className, ns);
                return {
                    hasParent: true,
                    isCrossNamespace: true,
                    namespace: ns,
                    className: normalizedClass,
                };
            }
        }

        if (classMap.has(parent)) {
            const normalizedClass = normalizeClassName(parent, this.options.namespace);
            return {
                hasParent: true,
                isCrossNamespace: false,
                className: normalizedClass,
            };
        }

        return { hasParent: false, isCrossNamespace: false, className: "" };
    }

    private generateImports(currentClassName?: string, parentClassName?: string, parentNamespace?: string): string {
        const nativeImports: string[] = [];
        if (this.ctx.usesAlloc) nativeImports.push("alloc");
        if (this.ctx.usesRead) nativeImports.push("read");
        if (this.ctx.usesWrite) nativeImports.push("write");
        if (this.ctx.usesRef) nativeImports.push("Ref");
        if (this.ctx.usesType) nativeImports.push("Type");

        const lines: string[] = [];
        if (nativeImports.length > 0) {
            lines.push(`import { ${nativeImports.join(", ")} } from "@gtkx/native";`);
        }
        if (this.ctx.usesCall) {
            lines.push(`import { call } from "../../batch.js";`);
        }
        if (this.ctx.usesNativeError) {
            lines.push(`import { NativeError } from "../../native/error.js";`);
        }
        if (this.ctx.usesGetNativeObject) {
            lines.push(`import { getNativeObject } from "../../native/object.js";`);
        }
        const baseImports: string[] = [];
        if (this.ctx.usesInstantiating) baseImports.push("isInstantiating", "setInstantiating");
        if (this.ctx.usesNativeObject) baseImports.push("NativeObject");
        if (baseImports.length > 0) {
            lines.push(`import { ${baseImports.join(", ")} } from "../../native/base.js";`);
        }
        const registryImports: string[] = [];
        if (this.ctx.usesRegisterNativeClass) registryImports.push("registerNativeClass");
        if (this.ctx.usesGetClassByTypeName) registryImports.push("getNativeClass");
        if (registryImports.length > 0) {
            lines.push(`import { ${registryImports.join(", ")} } from "../../registry.js";`);
        }
        if (this.ctx.usesSignalMeta) {
            lines.push(`import type { SignalMeta } from "../../types.js";`);
        }
        if (this.ctx.usedEnums.size > 0) {
            const enumList = Array.from(this.ctx.usedEnums).sort().join(", ");
            lines.push(`import { ${enumList} } from "./enums.js";`);
        }

        for (const normalizedRecordName of Array.from(this.ctx.usedRecords).sort()) {
            const normalizedCurrentClass = currentClassName
                ? normalizeClassName(currentClassName, this.options.namespace)
                : "";
            const normalizedParentClass = parentClassName
                ? normalizeClassName(parentClassName, this.options.namespace)
                : "";
            if (normalizedRecordName !== normalizedCurrentClass && normalizedRecordName !== normalizedParentClass) {
                const originalName = this.ctx.recordNameToFile.get(normalizedRecordName) ?? normalizedRecordName;
                lines.push(`import { ${normalizedRecordName} } from "./${toKebabCase(originalName)}.js";`);
            }
        }

        for (const [interfaceName, originalName] of Array.from(this.ctx.usedInterfaces.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            const originalFileName = this.ctx.interfaceNameToFile.get(interfaceName) ?? originalName;
            lines.push(`import { ${interfaceName} } from "./${toKebabCase(originalFileName)}.js";`);
        }

        for (const [className, originalName] of Array.from(this.ctx.usedSameNamespaceClasses.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            const normalizedCurrentClass = currentClassName
                ? normalizeClassName(currentClassName, this.options.namespace)
                : "";
            const normalizedParentClass = parentClassName
                ? normalizeClassName(parentClassName, this.options.namespace)
                : "";
            if (
                className !== normalizedCurrentClass &&
                className !== normalizedParentClass &&
                !this.ctx.signalClasses.has(className) &&
                !this.ctx.usedInterfaces.has(className)
            ) {
                if (this.ctx.cyclicReturnTypes.has(className)) {
                    lines.push(`import type { ${className} } from "./${toKebabCase(originalName)}.js";`);
                } else {
                    lines.push(`import { ${className} } from "./${toKebabCase(originalName)}.js";`);
                }
            }
        }

        for (const [className, originalName] of Array.from(this.ctx.signalClasses.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            if (className !== currentClassName && className !== parentClassName) {
                lines.push(`import { ${className} } from "./${toKebabCase(originalName)}.js";`);
            }
        }

        const externalNamespaces = new Set<string>();
        for (const usage of this.ctx.usedExternalTypes.values()) {
            if (usage.namespace === this.options.namespace) continue;
            externalNamespaces.add(usage.namespace);
        }
        if (this.ctx.addGioImport && this.options.namespace !== "Gio") {
            externalNamespaces.add("Gio");
        }
        if (parentNamespace && parentNamespace !== this.options.namespace) {
            externalNamespaces.add(parentNamespace);
        }
        for (const namespace of Array.from(externalNamespaces).sort()) {
            const nsLower = namespace.toLowerCase();
            lines.push(`import * as ${namespace} from "../${nsLower}/index.js";`);
        }

        return lines.length > 0 ? `${lines.join("\n")}\n` : "";
    }

    private async formatCode(code: string): Promise<string> {
        try {
            return await format(code, {
                parser: "typescript",
                ...(this.options.prettierConfig &&
                typeof this.options.prettierConfig === "object" &&
                this.options.prettierConfig !== null
                    ? (this.options.prettierConfig as Record<string, unknown>)
                    : {}),
            });
        } catch (error) {
            console.warn("Failed to format code:", error);
            return code;
        }
    }
}
