import type { GirConstructor, GirField, GirFunction, GirMethod, GirParameter, GirRecord, TypeMapper } from "@gtkx/gir";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "@gtkx/gir";
import type { GenerationContext } from "../generation-context.js";
import { BaseGenerator, type GeneratorOptions } from "./base-generator.js";
import { ClassGenerator } from "./class-generator.js";

export class RecordGenerator extends BaseGenerator {
    private classGenerator: ClassGenerator;

    constructor(typeMapper: TypeMapper, ctx: GenerationContext, options: GeneratorOptions) {
        super(typeMapper, ctx, options);
        this.classGenerator = new ClassGenerator(typeMapper, ctx, options);
    }

    async generateRecord(record: GirRecord, sharedLibrary: string): Promise<string> {
        this.ctx.usesRef =
            record.methods.some((m) => this.hasRefParameter(m.parameters)) ||
            record.constructors.some((c) => this.hasRefParameter(c.parameters)) ||
            record.functions.some((f) => this.hasRefParameter(f.parameters));
        this.ctx.usesCall = record.methods.length > 0 || record.constructors.length > 0 || record.functions.length > 0;

        const hasReadableFields = record.fields.some((f) => f.readable !== false && !f.private);
        if (hasReadableFields) {
            this.ctx.usesRead = true;
        }

        const recordName = normalizeClassName(record.name, this.options.namespace);
        const sections: string[] = [];

        const initInterface = this.generateRecordInitInterface(record);
        if (initInterface) {
            sections.push(initInterface);
        }

        if (record.doc) {
            sections.push(this.formatDoc(record.doc));
        }
        this.ctx.usesNativeObject = true;
        sections.push(`export class ${recordName} extends NativeObject {`);
        if (record.glibTypeName) {
            sections.push(`  static readonly glibTypeName: string = "${record.glibTypeName}";`);
            const objectType = record.glibTypeName === "GVariant" ? "gvariant" : "boxed";
            sections.push(`  static readonly objectType = "${objectType}" as const;\n`);
        } else {
            sections.push(`  static readonly objectType = "struct" as const;\n`);
        }

        sections.push(this.generateRecordConstructors(record, sharedLibrary));
        sections.push(this.generateRecordFromPtr(recordName));
        sections.push(this.generateRecordStaticFunctions(record.functions, sharedLibrary, recordName));
        sections.push(this.generateRecordMethods(record.methods, sharedLibrary, record.name, record.glibTypeName));
        sections.push(this.generateRecordFields(record.fields, record.methods));

        sections.push("}");

        if (record.glibTypeName) {
            this.ctx.usesRegisterNativeClass = true;
            sections.push(`\nregisterNativeClass(${recordName});`);
        }

        return sections.join("\n");
    }

    private generateRecordInitInterface(record: GirRecord): string | null {
        const supportedConstructors = record.constructors.filter((c) => !this.hasUnsupportedCallbacks(c.parameters));
        const mainConstructor = supportedConstructors.find((c) => !c.parameters.some((p) => this.isVararg(p)));
        if (mainConstructor) return null;

        const initFields = this.getWritableFields(record.fields);
        if (initFields.length === 0) return null;

        const recordName = normalizeClassName(record.name, this.options.namespace);
        return this.generateFieldInitInterface(recordName, initFields);
    }

    private generateRecordConstructors(record: GirRecord, sharedLibrary: string): string {
        const recordName = normalizeClassName(record.name, this.options.namespace);
        const sections: string[] = [];

        const supportedConstructors = record.constructors.filter((c) => !this.hasUnsupportedCallbacks(c.parameters));
        const mainConstructor = supportedConstructors.find((c) => !c.parameters.some((p) => this.isVararg(p)));
        if (mainConstructor) {
            const ctorDoc = this.formatMethodDoc(mainConstructor.doc, mainConstructor.parameters);
            const filteredParams = mainConstructor.parameters.filter((p) => !this.isVararg(p));

            if (filteredParams.length === 0) {
                sections.push(`${ctorDoc}  constructor() {\n    super();\n    this.id = this.createPtr([]);\n  }\n`);
            } else {
                const typedParams = this.generateParameterList(mainConstructor.parameters, false);
                const paramNames = filteredParams.map((p) => toValidIdentifier(toCamelCase(p.name)));
                const firstParamType = this.typeMapper.mapParameter(filteredParams[0] as GirParameter).ts;
                const isFirstParamArray = firstParamType.endsWith("[]") || firstParamType.startsWith("Array<");

                if (isFirstParamArray) {
                    sections.push(`${ctorDoc}  constructor(${typedParams}) {
    super();
    const _args = [${paramNames.join(", ")}];
    this.id = this.createPtr(_args);
  }
`);
                } else {
                    sections.push(`${ctorDoc}  constructor(${typedParams});
  constructor(_args: unknown[]);
  constructor(...args: unknown[]) {
    super();
    const _args = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    this.id = this.createPtr(_args);
  }
`);
                }
            }

            for (const ctor of supportedConstructors) {
                if (ctor !== mainConstructor) {
                    sections.push(
                        this.generateRecordStaticFactoryMethod(
                            ctor,
                            recordName,
                            sharedLibrary,
                            record.glibTypeName,
                            record.glibGetType,
                        ),
                    );
                }
            }
        } else {
            const initFields = this.getWritableFields(record.fields);
            if (initFields.length > 0) {
                sections.push(
                    `  constructor(init: ${recordName}Init = {}) {\n    super();\n    this.id = this.createPtr(init);\n  }\n`,
                );
            } else {
                sections.push(`  constructor() {\n    super();\n    this.id = this.createPtr({});\n  }\n`);
            }
        }

        sections.push(this.generateRecordCreatePtr(record, sharedLibrary));
        return sections.join("\n");
    }

    private generateRecordFromPtr(recordName: string): string {
        return `  static fromPtr(ptr: unknown): ${recordName} {
    const instance = Object.create(${recordName}.prototype) as ${recordName};
    instance.id = ptr;
    return instance;
  }
`;
    }

    private getWritableFields(fields: GirField[]): GirField[] {
        return fields.filter((f) => !f.private && f.writable !== false && this.isWritableType(f.type));
    }

    private generateFieldInitInterface(recordName: string, fields: GirField[]): string {
        const properties = fields.map((field) => {
            let fieldName = toValidIdentifier(toCamelCase(field.name));
            if (fieldName === "id") fieldName = "id_";
            const typeMapping = this.typeMapper.mapType(field.type);
            return `  ${fieldName}?: ${typeMapping.ts};`;
        });
        return `export interface ${recordName}Init {\n${properties.join("\n")}\n}\n\n`;
    }

    private generateRecordCreatePtr(record: GirRecord, sharedLibrary: string): string {
        const recordName = normalizeClassName(record.name, this.options.namespace);
        const supportedConstructors = record.constructors.filter((c) => !this.hasUnsupportedCallbacks(c.parameters));
        const mainConstructor = supportedConstructors.find((c) => !c.parameters.some((p) => this.isVararg(p)));

        if (!mainConstructor) {
            if (record.fields.length > 0) {
                const structSize = this.calculateStructSize(record.fields);
                const initFields = this.getWritableFields(record.fields);
                this.ctx.usesAlloc = true;

                const allocFn = record.glibTypeName
                    ? `alloc(${structSize}, "${record.glibTypeName}", "${sharedLibrary}")`
                    : `alloc(${structSize})`;

                if (initFields.length > 0) {
                    const fieldWrites = this.generateFieldWrites(record.fields);
                    this.ctx.usesWrite = true;
                    return `  protected createPtr(init: ${recordName}Init): unknown {
    const ptr = ${allocFn};
${fieldWrites}
    return ptr;
  }
`;
                }

                return `  protected createPtr(_init: Record<string, unknown>): unknown {
    return ${allocFn};
  }
`;
            }
            return `  protected createPtr(_init: Record<string, unknown>): unknown {\n    return null;\n  }\n`;
        }

        const filteredParams = mainConstructor.parameters.filter(
            (p, i) => !this.isVararg(p) && !this.typeMapper.isClosureTarget(i, mainConstructor.parameters),
        );
        const paramTypes = filteredParams.map((p) => this.typeMapper.mapParameter(p).ts);
        const paramNames = filteredParams.map((p) => toValidIdentifier(toCamelCase(p.name)));

        const destructuring =
            paramNames.length > 0
                ? `    const [${paramNames.join(", ")}] = _args as [${paramTypes.join(", ")}];\n`
                : "";

        const args = this.generateCallArguments(mainConstructor.parameters);
        const glibTypeName = record.glibTypeName ?? record.cType;

        return `  protected createPtr(_args: unknown[]): unknown {
${destructuring}    return call(
      "${sharedLibrary}",
      "${mainConstructor.cIdentifier}",
      [
${args}
      ],
      { type: "boxed", borrowed: true, innerType: "${glibTypeName}" }
    );
  }
`;
    }

    private generateFieldWrites(fields: GirField[]): string {
        const writes: string[] = [];
        let currentOffset = 0;

        for (const field of fields) {
            if (field.private) continue;
            const fieldSize = this.getFieldSize(field.type);
            const alignment = this.getFieldAlignment(field.type);
            currentOffset = Math.ceil(currentOffset / alignment) * alignment;

            if (field.writable !== false && this.isWritableType(field.type)) {
                let fieldName = toValidIdentifier(toCamelCase(field.name));
                if (fieldName === "id") fieldName = "id_";
                const typeMapping = this.typeMapper.mapType(field.type);
                writes.push(
                    `    if (init.${fieldName} !== undefined) write(ptr, ${this.generateTypeDescriptor(typeMapping.ffi)}, ${currentOffset}, init.${fieldName});`,
                );
            }

            currentOffset += fieldSize;
        }

        return writes.join("\n");
    }

    private calculateStructSize(fields: GirField[]): number {
        let currentOffset = 0;
        for (const field of fields) {
            const fieldSize = this.getFieldSize(field.type);
            const alignment = this.getFieldAlignment(field.type);
            currentOffset = Math.ceil(currentOffset / alignment) * alignment;
            currentOffset += fieldSize;
        }
        const maxAlignment = Math.max(...fields.map((f) => this.getFieldAlignment(f.type)), 1);
        return Math.ceil(currentOffset / maxAlignment) * maxAlignment;
    }

    private generateRecordStaticFactoryMethod(
        ctor: GirConstructor,
        recordName: string,
        sharedLibrary: string,
        glibTypeName?: string,
        glibGetType?: string,
    ): string {
        let methodName = "new";
        if (ctor.cIdentifier) {
            const parts = ctor.cIdentifier.split("_");
            const nameParts = parts.slice(2).join("_");
            if (nameParts && nameParts !== "new") {
                methodName = toCamelCase(nameParts);
            }
        }

        const params = this.generateParameterList(ctor.parameters);
        const args = this.generateCallArguments(ctor.parameters);
        const ctorDoc = this.formatMethodDoc(ctor.doc, ctor.parameters);
        const innerType = glibTypeName ?? recordName;
        const getTypeFnPart = glibGetType ? `, getTypeFn: "${glibGetType}"` : "";

        this.ctx.usesGetNativeObject = true;
        return `${ctorDoc}  static ${methodName}(${params}): ${recordName} {
    const ptr = call(
      "${sharedLibrary}",
      "${ctor.cIdentifier}",
      [
${args}
      ],
      { type: "boxed", borrowed: true, innerType: "${innerType}", lib: "${sharedLibrary}"${getTypeFnPart} }
    );
    return getNativeObject(ptr, ${recordName})!;
  }
`;
    }

    private generateRecordStaticFunctions(functions: GirFunction[], sharedLibrary: string, recordName: string): string {
        return this.classGenerator.generateStaticFunctions(functions, sharedLibrary, recordName);
    }

    private generateRecordMethods(
        methods: GirMethod[],
        sharedLibrary: string,
        recordName?: string,
        glibTypeName?: string,
    ): string {
        return this.classGenerator.generateMethods(methods, sharedLibrary, glibTypeName ?? recordName, true);
    }

    private generateRecordFields(fields: GirField[], methods: GirMethod[]): string {
        const sections: string[] = [];
        const fieldOffsets: { field: GirField; offset: number }[] = [];
        const methodNames = new Set(methods.map((m) => toCamelCase(m.name)));

        let currentOffset = 0;
        for (const field of fields) {
            if (field.private) continue;
            const fieldSize = this.getFieldSize(field.type);
            const alignment = this.getFieldAlignment(field.type);
            currentOffset = Math.ceil(currentOffset / alignment) * alignment;
            fieldOffsets.push({ field, offset: currentOffset });
            currentOffset += fieldSize;
        }

        for (const { field, offset } of fieldOffsets) {
            const isReadable = field.readable !== false;
            const isWritable = field.writable !== false;

            if (!isReadable && !isWritable) continue;

            let fieldName = toValidIdentifier(toCamelCase(field.name));
            if (methodNames.has(fieldName)) continue;
            if (fieldName === "id") fieldName = "id_";

            const typeMapping = this.typeMapper.mapType(field.type);

            if (field.doc) {
                sections.push(this.formatDoc(field.doc, "  ").trimEnd());
            }

            if (isReadable) {
                sections.push(`  get ${fieldName}(): ${typeMapping.ts} {
    return read(this.id, ${this.generateTypeDescriptor(typeMapping.ffi)}, ${offset}) as ${typeMapping.ts};
  }
`);
            }

            if (isWritable && this.isWritableType(field.type)) {
                this.ctx.usesWrite = true;
                sections.push(`  set ${fieldName}(value: ${typeMapping.ts}) {
    write(this.id, ${this.generateTypeDescriptor(typeMapping.ffi)}, ${offset}, value);
  }
`);
            }
        }

        return sections.join("\n");
    }

    private isWritableType(type: { name: string; cType?: string }): boolean {
        const typeName = type.name;
        if (
            typeName === "gboolean" ||
            typeName === "guint8" ||
            typeName === "gint8" ||
            typeName === "guchar" ||
            typeName === "gchar"
        ) {
            return true;
        }
        if (typeName === "gint16" || typeName === "guint16" || typeName === "gshort" || typeName === "gushort") {
            return true;
        }
        if (typeName === "gint" || typeName === "guint" || typeName === "gint32" || typeName === "guint32") {
            return true;
        }
        if (
            typeName === "gint64" ||
            typeName === "guint64" ||
            typeName === "glong" ||
            typeName === "gulong" ||
            typeName === "gsize" ||
            typeName === "gssize"
        ) {
            return true;
        }
        if (typeName === "gfloat" || typeName === "float" || typeName === "gdouble" || typeName === "double") {
            return true;
        }
        return false;
    }

    private getFieldSize(type: { name: string; cType?: string }): number {
        const typeName = type.name;
        if (
            typeName === "gboolean" ||
            typeName === "guint8" ||
            typeName === "gint8" ||
            typeName === "guchar" ||
            typeName === "gchar"
        ) {
            return 1;
        }
        if (typeName === "gint16" || typeName === "guint16" || typeName === "gshort" || typeName === "gushort") {
            return 2;
        }
        if (
            typeName === "gint" ||
            typeName === "guint" ||
            typeName === "gint32" ||
            typeName === "guint32" ||
            typeName === "gfloat" ||
            typeName === "float" ||
            typeName === "Quark" ||
            typeName === "GQuark"
        ) {
            return 4;
        }
        if (
            typeName === "gint64" ||
            typeName === "guint64" ||
            typeName === "gdouble" ||
            typeName === "double" ||
            typeName === "glong" ||
            typeName === "gulong" ||
            typeName === "gsize" ||
            typeName === "gssize" ||
            typeName === "GType"
        ) {
            return 8;
        }
        return 8;
    }

    private getFieldAlignment(type: { name: string; cType?: string }): number {
        return this.getFieldSize(type);
    }
}
