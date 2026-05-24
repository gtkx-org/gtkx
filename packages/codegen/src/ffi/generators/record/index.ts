/**
 * Record Generator
 *
 * Generates record (struct/boxed type) classes. Records emit a class
 * extending `NativeObject`, field accessors, methods, static factory
 * methods for every GIR `<constructor>`, and a module-load
 * `registerConstructionMeta` call describing the boxed layout. The
 * actual allocation happens inside `NativeObject`'s constructor.
 */

import type { FileBuilder } from "../../../builders/file-builder.js";
import { accessor, type ClassDeclarationBuilder, classDecl, constructorDecl, param } from "../../../builders/index.js";
import type { Writer } from "../../../builders/text-writer.js";
import { writeFfiTypeExpression } from "../../../ffi-emitters/ffi-type-expression.js";
import {
    addMethodStructure,
    addTypeImports,
    createMethodBodyWriter,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../../ffi-emitters/index.js";
import type { FfiGeneratorOptions } from "../../../generator-types.js";
import type { GirField, GirFunction, GirMethod, GirRecord, GirRepository } from "../../../gir/index.js";
import type { FfiMapper } from "../../../type-system/ffi-mapper.js";
import {
    boxedSelfType,
    type FfiTypeDescriptor,
    fundamentalSelfType,
    getPrimitiveTypeSize,
    isPrimitiveFieldType,
    type MappedType,
    SELF_TYPE_GOBJECT,
    type SelfTypeDescriptor,
    UNSAFE_PRIMITIVE_NAMES,
} from "../../../type-system/ffi-types.js";
import { type AsyncCallablePair, collectAsyncCallablePairs } from "../../../utils/async-callable.js";
import { buildJsDocStructure } from "../../../utils/doc-formatter.js";
import { partitionSupportedFunctions, partitionSupportedMethods } from "../../../utils/filtering.js";
import { normalizeClassName, toCamelCase, toValidMemberName } from "../../../utils/naming.js";
import { canAllocateRecord } from "../../../utils/record-filter.js";
import { FieldBuilder, type FieldLayout } from "./field-builder.js";

type RecordTypeMeta = {
    glibTypeName?: string;
    glibGetType?: string;
    copyFunction?: string;
    freeFunction?: string;
};

/**
 * GIR primitive type names whose array form (`gchar**`) marshals as a
 * zero-terminated array of C strings.
 */
const STRING_ELEMENT_TYPE_NAMES: ReadonlySet<string> = new Set(["utf8", "filename"]);

/**
 * A leaf field within an array element struct, addressed by an absolute byte
 * offset. Bitfield members additionally carry their bit position and width.
 */
type ArrayElementLeaf = {
    name: string;
    offset: number;
    ffi: FfiTypeDescriptor;
    bitOffset?: number;
    bitWidth?: number;
};

/**
 * One field of an array element struct: either a primitive read directly at an
 * offset, or an inline nested struct grouped from its writable leaf fields.
 */
type ArrayElementEntry =
    | { kind: "primitive"; leaf: ArrayElementLeaf }
    | { kind: "nested"; name: string; subFields: ArrayElementLeaf[] };

/**
 * A record struct field layout, as produced by {@link FieldBuilder.getNestedStructLayout}.
 */
type StructLayout = NonNullable<ReturnType<FieldBuilder["getNestedStructLayout"]>>;

/**
 * A single placed field within a {@link StructLayout}.
 */
type StructLayoutItem = StructLayout[number];

/**
 * Resolved inputs shared by the getter and setter bodies of a struct-array
 * field accessor: the backing-buffer descriptor expression, its pointer
 * offset, the element-count expression, the element byte size, whether each
 * element wraps a boxed class, the element TypeScript type, and the flattened
 * per-field read/write plan.
 */
type ArrayAccessorContext = {
    structTypeExpr: string;
    ptrOffset: number;
    lengthExpr: string;
    elementSize: number;
    wrapElement: boolean;
    tsTypeName: string;
    plan: ArrayElementEntry[];
};

/**
 * Inputs for emitting a primitive (or bitfield) record field accessor: the
 * field, its resolved member name and byte offset, the access flags, the
 * target class builder, and the optional bit placement for bitfield members.
 */
/**
 * Common inputs for record field accessor emitters.
 */
type FieldAccessorContext = {
    field: GirField;
    fieldName: string;
    offset: number;
    cls: ClassDeclarationBuilder;
    methodNames: Set<string>;
};

type PrimitiveFieldAccessorOptions = {
    field: GirField;
    fieldName: string;
    offset: number;
    isReadable: boolean;
    isWritable: boolean;
    cls: ClassDeclarationBuilder;
    bitOffset?: number;
    bitWidth?: number;
};

/**
 * Generates record (struct/boxed type) classes.
 */
export class RecordGenerator {
    private readonly fieldBuilder: FieldBuilder;
    private readonly methodBody: MethodBodyWriter;
    private selfNames: ReadonlySet<string> = new Set();

    private readonly repo?: GirRepository;

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly file: FileBuilder,
        private readonly options: FfiGeneratorOptions,
        repo?: GirRepository,
    ) {
        this.repo = repo;
        this.fieldBuilder = new FieldBuilder(ffiMapper, file, repo, options.namespace);
        this.methodBody = createMethodBodyWriter(ffiMapper, file, {
            sharedLibrary: options.sharedLibrary,
            glibLibrary: options.glibLibrary,
        });
    }

    /**
     * Generates a record class into the FileBuilder.
     */
    generate(record: GirRecord): void {
        const recordName = normalizeClassName(record.name);
        this.selfNames = new Set([recordName]);
        this.methodBody.setSelfNames(this.selfNames);

        const initFields = this.collectInitializableFields(record);

        const cls = this.generateClass(record, recordName);

        const methodStructures: MethodStructure[] = [];

        const fieldMemberNames = new Set(
            record.fields
                .filter((field) => !field.private && field.readable !== false)
                .map((field) => toValidMemberName(toCamelCase(field.name))),
        );
        const recordMethods = record.methods.filter(
            (method) => !fieldMemberNames.has(toValidMemberName(toCamelCase(method.name))),
        );

        methodStructures.push(
            ...this.buildStaticFactoryMethodStructures(record, recordName),
            ...this.buildStaticFunctionStructures(record.staticFunctions, recordName, record.name),
            ...this.buildMethodStructures(recordMethods, {
                glibTypeName: record.glibTypeName,
                glibGetType: record.glibGetType,
                copyFunction: record.copyFunction,
                freeFunction: record.freeFunction,
            }),
        );

        for (const struct of methodStructures) {
            addMethodStructure(cls, struct);
        }

        this.generateFields(record.fields, recordMethods, cls, record.isUnion);

        this.file.add(cls);

        if (record.glibGetType) {
            this.file.addImport("../../registry.js", ["registerNativeClass"]);
            const getTypeCall = this.buildGTypeCall(record.glibGetType, record.glibTypeName, recordName);
            this.file.addStatement(`\n${recordName}.prototype.__gtype__ = 0;`);
            this.file.addStatement(`registerNativeClass(${recordName}, ${getTypeCall});`);
        }

        if (canAllocateRecord(record)) {
            this.emitConstructionMeta(record, initFields);
        }
    }

    private collectInitializableFields(record: GirRecord): GirField[] {
        return this.fieldBuilder.getInitializableFields(record.fields);
    }

    private generateClass(record: GirRecord, recordName: string): ClassDeclarationBuilder {
        this.file.addImport("../../object.js", ["constructNativeObject"]);
        this.file.addImport("../../handles.js", ["getHandle", "tryGetHandle"]);

        const doc = buildJsDocStructure(record.doc, this.options.namespace);
        const cls = classDecl(recordName, {
            exported: true,
            doc: doc?.[0]?.description,
        });

        cls.setConstructor(
            constructorDecl({
                params: [param("props", "object", { defaultValue: "{}" })],
                body: (writer) => {
                    writer.writeLine("constructNativeObject(this, props);");
                },
            }),
        );

        return cls;
    }

    private emitConstructionMeta(record: GirRecord, initFields: readonly GirField[]): void {
        const glibTypeName = record.glibTypeName;

        this.file.addImport("../../construction-meta.js", ["registerConstructionMeta"]);
        const structSize = this.fieldBuilder.calculateStructSize(record.fields, record.isUnion);
        const layout = this.fieldBuilder.calculateLayout(record.fields, false, record.isUnion);
        const layoutByName = this.buildLayoutByName(layout);
        const fieldEntries = this.collectConstructionFieldEntries(initFields, layoutByName);

        this.file.addImport("../../native.js", ["t"]);

        const recordName = normalizeClassName(record.name);
        this.file.addRawBlock(
            this.buildConstructionMetaWriter({
                recordName,
                glibTypeName,
                structSize,
                fieldEntries,
            }),
        );
    }

    private buildLayoutByName(
        layout: FieldLayout[],
    ): Map<string, { offset: number; bitOffset?: number; bitWidth?: number }> {
        const layoutByName = new Map<string, { offset: number; bitOffset?: number; bitWidth?: number }>();
        for (const item of layout) {
            layoutByName.set(item.field.name, {
                offset: item.offset,
                bitOffset: item.bitOffset,
                bitWidth: item.bitWidth,
            });
        }
        return layoutByName;
    }

    private collectConstructionFieldEntries(
        initFields: readonly GirField[],
        layoutByName: Map<string, { offset: number; bitOffset?: number; bitWidth?: number }>,
    ): Array<{ jsName: string; offset: number; ffiType: FfiTypeDescriptor; bitOffset?: number; bitWidth?: number }> {
        const fieldEntries: Array<{
            jsName: string;
            offset: number;
            ffiType: FfiTypeDescriptor;
            bitOffset?: number;
            bitWidth?: number;
        }> = [];
        for (const field of initFields) {
            const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
            if (typeMapping.unsafe) continue;
            const placement = layoutByName.get(field.name);
            if (placement === undefined) continue;
            let jsName = toValidMemberName(toCamelCase(field.name));
            if (jsName === "id") jsName = "id_";
            fieldEntries.push({
                jsName,
                offset: placement.offset,
                ffiType: typeMapping.ffi,
                bitOffset: placement.bitOffset,
                bitWidth: placement.bitWidth,
            });
        }
        return fieldEntries;
    }

    private buildConstructionMetaWriter(opts: {
        recordName: string;
        glibTypeName: string | undefined;
        structSize: number;
        fieldEntries: Array<{
            jsName: string;
            offset: number;
            ffiType: FfiTypeDescriptor;
            bitOffset?: number;
            bitWidth?: number;
        }>;
    }): (writer: Writer) => void {
        const { recordName, glibTypeName, structSize, fieldEntries } = opts;
        return (writer: Writer) => {
            writer.writeLine("");
            writer.writeLine(`registerConstructionMeta(${recordName}, {`);
            writer.withIndent(() => {
                writer.writeLine(`kind: "boxed",`);
                writer.writeLine(`size: ${structSize},`);
                if (glibTypeName) {
                    writer.writeLine(`glibTypeName: "${glibTypeName}",`);
                    writer.writeLine(`lib: "${this.options.sharedLibrary}",`);
                }
                if (fieldEntries.length === 0) {
                    writer.writeLine("fields: {},");
                } else {
                    writer.writeLine("fields: {");
                    writer.withIndent(() => {
                        for (const entry of fieldEntries) {
                            writer.write(`${entry.jsName}: { offset: ${entry.offset}, ffiType: `);
                            writeFfiTypeExpression(writer, entry.ffiType);
                            if (entry.bitWidth !== undefined) {
                                writer.write(`, bitOffset: ${entry.bitOffset ?? 0}, bitWidth: ${entry.bitWidth}`);
                            }
                            writer.writeLine(" },");
                        }
                    });
                    writer.writeLine("},");
                }
            });
            writer.writeLine("});");
        };
    }

    private buildGTypeCall(cIdentifier: string, glibTypeName: string | undefined, recordName: string): string {
        if (cIdentifier === "intern" || cIdentifier === "") {
            if (!glibTypeName) {
                return `0 /* ${recordName} has no glib:type-name */`;
            }
            const binding = this.file.descriptors.register({
                sharedLibrary: "libgobject-2.0.so.0",
                cIdentifier: "g_type_from_name",
                args: [{ type: { type: "string", ownership: "borrowed" }, value: "" }],
                returnType: { type: "uint64" },
            });
            this.file.addImport("../../native.js", ["t"]);
            if (binding.varargs === false) {
                return `${binding.name}("${glibTypeName}")`;
            }
            this.file.addImport("../../native.js", ["call"]);
            return `call("libgobject-2.0.so.0", "g_type_from_name", [{ type: t.string("borrowed"), value: "${glibTypeName}" }], t.uint64)`;
        }
        const binding = this.file.descriptors.register({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier,
            args: [],
            returnType: { type: "uint64" },
            exported: true,
        });
        this.file.addImport("../../native.js", ["t"]);
        if (binding.varargs === false) {
            return `${binding.name}()`;
        }
        this.file.addImport("../../native.js", ["call"]);
        return `call("${this.options.sharedLibrary}", "${cIdentifier}", [], t.uint64)`;
    }

    private buildRecordReturnDescriptor(
        meta: RecordTypeMeta,
        ownership: "full" | "borrowed",
        fallbackInnerType?: string,
    ): FfiTypeDescriptor {
        const { glibTypeName, glibGetType, copyFunction, freeFunction } = meta;
        if (copyFunction && freeFunction) {
            return {
                type: "fundamental",
                ownership,
                library: this.options.sharedLibrary,
                refFn: copyFunction,
                unrefFn: freeFunction,
            };
        }
        return {
            type: "boxed",
            ownership,
            innerType: glibTypeName ?? fallbackInnerType,
            library: this.options.sharedLibrary,
            ...(glibGetType ? { getTypeFn: glibGetType } : {}),
        };
    }

    private buildStaticFactoryMethodStructures(record: GirRecord, recordName: string): MethodStructure[] {
        const { supported, unsupported } = this.methodBody.selectConstructors(record.constructors);
        const meta: RecordTypeMeta = {
            glibTypeName: record.glibTypeName,
            glibGetType: record.glibGetType,
            copyFunction: record.copyFunction,
            freeFunction: record.freeFunction,
        };
        return [
            ...supported.map((ctor) => this.buildStaticFactoryMethodStructure(ctor, recordName, meta)),
            ...unsupported.map((ctor) =>
                this.methodBody.buildStubStructure({
                    memberName: toCamelCase(ctor.shadows ?? ctor.name),
                    qualifiedName: `${this.options.namespace}.${record.name}.${ctor.name}`,
                    doc: ctor.doc,
                    namespace: this.options.namespace,
                    isStatic: true,
                    parameters: ctor.parameters,
                }),
            ),
        ];
    }

    private buildStaticFactoryMethodStructure(
        ctor: import("../../../gir/index.js").GirConstructor,
        recordName: string,
        meta: RecordTypeMeta,
    ): MethodStructure {
        const methodName = toCamelCase(ctor.shadows ?? ctor.name);
        const shape = this.methodBody.buildShape(ctor.parameters, undefined, 0);
        const params = this.methodBody.buildSignatureParameters(shape, false);
        this.file.addImport("../../registry.js", ["getNativeObject"]);

        return {
            name: methodName,
            isStatic: true,
            parameters: params,
            returnType: recordName,
            docs: buildJsDocStructure(ctor.doc, this.options.namespace),
            statements: this.writeStaticFactoryMethodBody(ctor, recordName, meta),
        };
    }

    private writeStaticFactoryMethodBody(
        ctor: import("../../../gir/index.js").GirConstructor,
        recordName: string,
        meta: RecordTypeMeta,
    ): (writer: Writer) => void {
        const shape = this.methodBody.buildShape(ctor.parameters, undefined, 0);
        const args = this.methodBody.buildShapeCallArguments(shape, ctor.parameters);
        const ownership = ctor.returnType.transferOwnership === "full" ? "full" : "borrowed";
        const returnTypeDescriptor = this.buildRecordReturnDescriptor(meta, ownership, recordName);

        return this.methodBody.writeFactoryMethodBody({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: ctor.cIdentifier,
            args,
            returnTypeDescriptor,
            wrapClassName: recordName,
            throws: ctor.throws,
            useClassInWrap: true,
            hiddenOuts: shape.hiddenOuts,
        });
    }

    private buildStaticFunctionStructures(
        functions: readonly GirFunction[],
        recordName: string,
        originalName: string,
    ): MethodStructure[] {
        const { supported: supportedFunctions, unsupported: unsupportedFunctions } = partitionSupportedFunctions(
            functions,
            (params) => this.methodBody.hasUnsupportedCallbacks(params),
            (returnType) => this.methodBody.isReturnTypeUnsafe(returnType),
        );
        const asyncPairs = collectAsyncCallablePairs(supportedFunctions, functions);
        return [
            ...supportedFunctions.map((func) => {
                const pair = asyncPairs.get(func.name);
                if (pair) {
                    return this.methodBody.buildAsyncCallableStructure({
                        asyncCallable: pair.async,
                        finishCallable: pair.finish,
                        callbackParameter: pair.callbackParameter,
                        memberName: toValidMemberName(toCamelCase(pair.async.name)),
                        finishMemberName: toValidMemberName(toCamelCase(pair.finish.name)),
                        isStatic: true,
                        sharedLibrary: this.options.sharedLibrary,
                        namespace: this.options.namespace,
                    });
                }
                return this.buildStaticFunctionStructure(func, recordName, originalName);
            }),
            ...unsupportedFunctions.map((func) =>
                this.methodBody.buildStubStructure({
                    memberName: toValidMemberName(toCamelCase(func.name)),
                    qualifiedName: `${this.options.namespace}.${originalName}.${func.name}`,
                    doc: func.doc,
                    namespace: this.options.namespace,
                    isStatic: true,
                    parameters: func.parameters,
                }),
            ),
        ];
    }

    private buildStaticFunctionStructure(
        func: GirFunction,
        className: string,
        originalClassName: string,
    ): MethodStructure {
        return this.methodBody.buildStaticFunctionStructure(func, {
            className,
            originalClassName,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
        });
    }

    private buildMethodStructures(methods: readonly GirMethod[], meta: RecordTypeMeta): MethodStructure[] {
        const { supported, unsupported } = partitionSupportedMethods(
            methods,
            (params) => this.methodBody.hasUnsupportedCallbacks(params),
            (returnType) => this.methodBody.isReturnTypeUnsafe(returnType),
        );
        const asyncPairs = collectAsyncCallablePairs(supported, methods);
        return [
            ...supported.map((method) => {
                const pair = asyncPairs.get(method.name);
                return pair ? this.buildAsyncMethodStructure(pair, meta) : this.buildMethodStructure(method, meta);
            }),
            ...unsupported.map((method) =>
                this.methodBody.buildStubStructure({
                    memberName: toValidMemberName(toCamelCase(method.name)),
                    qualifiedName: `${this.options.namespace}.${method.name}`,
                    doc: method.doc,
                    namespace: this.options.namespace,
                    isStatic: false,
                    parameters: method.parameters,
                }),
            ),
        ];
    }

    private buildAsyncMethodStructure(
        pair: AsyncCallablePair<GirMethod, GirMethod>,
        meta: RecordTypeMeta,
    ): MethodStructure {
        return this.methodBody.buildAsyncCallableStructure({
            asyncCallable: pair.async,
            finishCallable: pair.finish,
            callbackParameter: pair.callbackParameter,
            memberName: toValidMemberName(toCamelCase(pair.async.name)),
            finishMemberName: toValidMemberName(toCamelCase(pair.finish.name)),
            isStatic: false,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
            self: { type: this.resolveSelfTypeDescriptor(pair.async, meta), value: "getHandle(this)" },
        });
    }

    private resolveSelfTypeDescriptor(m: GirMethod, meta: RecordTypeMeta): SelfTypeDescriptor {
        const instanceOwnership = m.instanceParameter?.transferOwnership === "full" ? "full" : "borrowed";
        const className = meta.glibTypeName;
        if (!className) {
            return SELF_TYPE_GOBJECT;
        }
        return meta.copyFunction && meta.freeFunction
            ? fundamentalSelfType({
                  library: this.options.sharedLibrary,
                  refFn: meta.copyFunction,
                  unrefFn: meta.freeFunction,
                  ownership: instanceOwnership,
                  typeName: className,
              })
            : boxedSelfType(className, this.options.sharedLibrary, meta.glibGetType, instanceOwnership);
    }

    private buildMethodStructure(m: GirMethod, meta: RecordTypeMeta): MethodStructure {
        return this.methodBody.buildMethodStructure(m, {
            methodName: toCamelCase(m.name),
            selfTypeDescriptor: this.resolveSelfTypeDescriptor(m, meta),
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
            className: meta.glibTypeName,
        });
    }

    private resolveFieldName(field: GirField): string {
        const fieldName = toValidMemberName(toCamelCase(field.name));
        return fieldName === "id" ? "id_" : fieldName;
    }

    private tryGenerateArrayField(ctx: FieldAccessorContext, fields: readonly GirField[]): boolean {
        const { field } = ctx;
        if (!field.type.isArray || !field.type.elementType) return false;

        if (this.tryGenerateZeroTerminatedArrayField(ctx)) return true;

        const elementTypeName = String(field.type.elementType.name);
        if (
            this.fieldBuilder.isNestedStructType(elementTypeName) ||
            this.fieldBuilder.hasReadableStructLayout(elementTypeName)
        ) {
            this.generateArrayFieldAccessors(ctx, fields);
            return true;
        }
        if (field.type.fixedSize !== undefined && isPrimitiveFieldType(elementTypeName)) {
            this.generateFixedPrimitiveArrayAccessor(ctx);
            return true;
        }
        if (field.type.fixedSize === undefined && field.type.sizeParamIndex !== undefined) {
            this.generateSizedArrayFieldAccessor(ctx, fields);
            return true;
        }
        if (field.type.fixedSize === undefined && STRING_ELEMENT_TYPE_NAMES.has(elementTypeName)) {
            this.generateStringArrayFieldAccessor(ctx);
            return true;
        }
        if (this.isLinkedListField(field)) {
            this.generateLinkedListFieldAccessor(ctx);
        }
        return true;
    }

    private tryGenerateZeroTerminatedArrayField(ctx: FieldAccessorContext): boolean {
        const { field } = ctx;
        if (field.type.fixedSize !== undefined || field.type.sizeParamIndex !== undefined) return false;
        const mapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        if (mapping.unsafe || mapping.ffi.type !== "array" || mapping.ffi.kind !== "array") return false;
        return this.generateZeroTerminatedArrayFieldAccessor(ctx, mapping);
    }

    /**
     * Builds a getter body that reads a struct field whole at `offset` through
     * the given FFI descriptor and returns the marshaled value.
     */
    private buildWholeFieldGetBody(ffi: FfiTypeDescriptor, offset: number): (writer: Writer) => void {
        return (writer: Writer): void => {
            writer.write("return read(getHandle(this), ");
            writeFfiTypeExpression(writer, ffi);
            writer.writeLine(`, ${offset});`);
        };
    }

    /**
     * Builds a setter body that writes a struct field whole at `offset`
     * through the given FFI descriptor.
     */
    private buildWholeFieldSetBody(ffi: FfiTypeDescriptor, offset: number): (writer: Writer) => void {
        return (writer: Writer): void => {
            writer.write("write(getHandle(this), ");
            writeFfiTypeExpression(writer, ffi);
            writer.writeLine(`, ${offset}, value);`);
        };
    }

    /**
     * Emits an accessor for a struct field holding a NULL-terminated array.
     *
     * The array is read or written whole through its mapped FFI descriptor,
     * mirroring node-gtk, which surfaces such fields as arrays.
     *
     * @returns `true` when an accessor was emitted.
     */
    private generateZeroTerminatedArrayFieldAccessor(ctx: FieldAccessorContext, mapping: MappedType): boolean {
        const { field, fieldName, offset, cls, methodNames } = ctx;
        if (field.readable === false || methodNames.has(fieldName)) return false;
        const isWritable = field.writable !== false && !methodNames.has(fieldName);
        addTypeImports(this.file, mapping.imports, this.selfNames);
        this.file.addImport("../../native.js", isWritable ? ["read", "t", "write"] : ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        cls.addAccessor(
            accessor(fieldName, {
                type: `${mapping.ts}`,
                getBody: this.buildWholeFieldGetBody(mapping.ffi, offset),
                setBody: isWritable ? this.buildWholeFieldSetBody(mapping.ffi, offset) : undefined,
                doc: doc?.[0]?.description,
            }),
        );
        return true;
    }

    private isLinkedListField(field: GirField): boolean {
        const cType = field.type.cType ?? "";
        return cType.startsWith("GList") || cType.startsWith("GSList");
    }

    private generateLinkedListFieldAccessor(ctx: FieldAccessorContext): void {
        const { field, fieldName, offset, cls, methodNames } = ctx;
        if (field.readable === false || methodNames.has(fieldName)) return;
        const mapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        if (mapping.ffi.type !== "array") return;
        const isWritable = field.writable !== false && !methodNames.has(fieldName);
        this.file.addImport("../../native.js", isWritable ? ["read", "t", "write"] : ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        cls.addAccessor(
            accessor(fieldName, {
                type: `${mapping.ts}`,
                getBody: this.buildWholeFieldGetBody(mapping.ffi, offset),
                setBody: isWritable ? this.buildWholeFieldSetBody(mapping.ffi, offset) : undefined,
                doc: doc?.[0]?.description,
            }),
        );
    }

    private isCallbackFieldType(typeName: string): boolean {
        if (!this.repo) return false;
        const qualified = typeName.includes(".") ? typeName : `${this.options.namespace}.${typeName}`;
        return this.repo.getTypeKind(qualified) === "callback";
    }

    /**
     * Emits an accessor for a struct field holding a C function pointer.
     *
     * The runtime exposes the raw function-pointer slot: the getter reads the
     * stored pointer and the setter writes one back. This mirrors node-gtk,
     * which surfaces callback struct fields as members.
     */
    private generateCallbackFieldAccessor(ctx: FieldAccessorContext): void {
        const { field, fieldName, offset, cls, methodNames } = ctx;
        if (field.readable === false || methodNames.has(fieldName)) return;
        const isWritable = field.writable !== false && !methodNames.has(fieldName);
        this.file.addImport("../../native.js", isWritable ? ["read", "t", "write"] : ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        const getBody = (writer: Writer): void => {
            writer.writeLine(`return read(getHandle(this), t.uint64, ${offset});`);
        };
        const setBody = isWritable
            ? (writer: Writer): void => {
                  writer.writeLine(`write(getHandle(this), t.uint64, ${offset}, value);`);
              }
            : undefined;

        cls.addAccessor(
            accessor(fieldName, {
                type: "unknown",
                getBody,
                setBody,
                doc: doc?.[0]?.description,
            }),
        );
    }

    private generateStringArrayFieldAccessor(ctx: FieldAccessorContext): void {
        const { field, fieldName, offset, cls, methodNames } = ctx;
        if (field.readable === false || methodNames.has(fieldName)) return;
        const isWritable = field.writable !== false && !methodNames.has(fieldName);
        this.file.addImport("../../native.js", isWritable ? ["read", "t", "write"] : ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        const getBody = (writer: Writer): void => {
            writer.writeLine(
                `return read(getHandle(this), t.array(t.string("borrowed"), "array", "borrowed"), ${offset});`,
            );
        };
        const setBody = isWritable
            ? (writer: Writer): void => {
                  writer.writeLine(
                      `write(getHandle(this), t.array(t.string("borrowed"), "array", "borrowed"), ${offset}, value);`,
                  );
              }
            : undefined;

        cls.addAccessor(
            accessor(fieldName, {
                type: "string[]",
                getBody,
                setBody,
                doc: doc?.[0]?.description,
            }),
        );
    }

    /**
     * Emits a read-only accessor for a struct field holding a pointer to an
     * array whose element count lives in a sibling length field.
     *
     * The pointer is dereferenced and `length` elements are read, mirroring
     * node-gtk, which surfaces such fields as arrays.
     */
    private generateSizedArrayFieldAccessor(ctx: FieldAccessorContext, allFields: readonly GirField[]): void {
        const { field, fieldName, offset, cls, methodNames } = ctx;
        if (field.readable === false || methodNames.has(fieldName)) return;
        const elementType = field.type.elementType;
        const sizeParamIndex = field.type.sizeParamIndex;
        if (!elementType || sizeParamIndex === undefined) return;

        const publicFields = allFields.filter((f) => !f.private);
        const lengthField = publicFields[sizeParamIndex];
        if (!lengthField) return;
        const lengthMember = toValidMemberName(toCamelCase(lengthField.name));

        const elementMapping = this.ffiMapper.mapType(elementType, false, elementType.transferOwnership);
        const elementFfiKind = elementMapping.ffi.type;
        const isPointerElement =
            elementFfiKind === "gobject" || elementFfiKind === "boxed" || elementFfiKind === "fundamental";
        const elementSize = isPointerElement ? 8 : getPrimitiveTypeSize(String(elementType.name));
        if (elementSize <= 0) return;
        if (elementMapping.unsafe && !isPointerElement) return;
        addTypeImports(this.file, elementMapping.imports, this.selfNames);
        this.file.addImport("../../native.js", ["read", "t"]);
        if (isPointerElement) {
            this.file.addImport("../../registry.js", ["getNativeObject"]);
        }
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        const getBody = (writer: Writer): void => {
            writer.writeLine(`const base = read(getHandle(this), t.object("borrowed"), ${offset});`);
            writer.writeLine("if (base === null) return [];");
            writer.writeLine(`/** @type {${elementMapping.ts}[]} */`);
            writer.writeLine("const result = [];");
            writer.writeLine(`for (let index = 0; index < this.${lengthMember}; index++) {`);
            writer.withIndent(() => {
                if (isPointerElement) {
                    writer.writeLine(`const elementPtr = read(base, t.object("borrowed"), index * ${elementSize});`);
                    writer.writeLine("result.push(getNativeObject(elementPtr));");
                } else {
                    writer.write("result.push(read(base, ");
                    writeFfiTypeExpression(writer, elementMapping.ffi);
                    writer.writeLine(`, index * ${elementSize}));`);
                }
            });
            writer.writeLine("}");
            writer.writeLine("return result;");
        };

        cls.addAccessor(
            accessor(fieldName, {
                type: `${elementMapping.ts}[]`,
                getBody,
                doc: doc?.[0]?.description,
            }),
        );
    }

    private generateFixedPrimitiveArrayAccessor(ctx: FieldAccessorContext): void {
        const { field, fieldName, offset, cls, methodNames } = ctx;
        const elementType = field.type.elementType;
        const fixedSize = field.type.fixedSize;
        if (!elementType || fixedSize === undefined) return;
        if (field.readable === false || methodNames.has(fieldName)) return;

        const elementMapping = this.ffiMapper.mapType(elementType, false, elementType.transferOwnership);
        const elementSize = getPrimitiveTypeSize(String(elementType.name));
        const isWritable = field.writable !== false && !methodNames.has(fieldName);
        this.file.addImport("../../native.js", isWritable ? ["read", "t", "write"] : ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        const getBody = (writer: Writer): void => {
            writer.writeLine(`/** @type {${elementMapping.ts}[]} */`);
            writer.writeLine("const result = [];");
            writer.writeLine(`for (let index = 0; index < ${fixedSize}; index++) {`);
            writer.withIndent(() => {
                writer.write("result.push(read(getHandle(this), ");
                writeFfiTypeExpression(writer, elementMapping.ffi);
                writer.writeLine(`, ${offset} + index * ${elementSize}));`);
            });
            writer.writeLine("}");
            writer.writeLine("return result;");
        };

        const setBody = isWritable
            ? (writer: Writer): void => {
                  writer.writeLine(`for (let index = 0; index < ${fixedSize}; index++) {`);
                  writer.withIndent(() => {
                      writer.write("write(getHandle(this), ");
                      writeFfiTypeExpression(writer, elementMapping.ffi);
                      writer.writeLine(`, ${offset} + index * ${elementSize}, value[index]);`);
                  });
                  writer.writeLine("}");
              }
            : undefined;

        cls.addAccessor(
            accessor(fieldName, {
                type: `${elementMapping.ts}[]`,
                getBody,
                setBody,
                doc: doc?.[0]?.description,
            }),
        );
    }

    private buildPrimitiveFieldAccessor(options: PrimitiveFieldAccessorOptions): void {
        const { field, fieldName, offset, isReadable, isWritable, cls, bitWidth } = options;
        const rawMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        const typeMapping =
            rawMapping.ffi.type === "boxed"
                ? { ...rawMapping, ffi: { ...rawMapping.ffi, ownership: "borrowed" as const } }
                : rawMapping;
        const isRawPointerPrimitive = UNSAFE_PRIMITIVE_NAMES.has(String(field.type.name));
        if (typeMapping.unsafe && !isRawPointerPrimitive) return;
        addTypeImports(this.file, typeMapping.imports, this.selfNames);

        if (bitWidth !== undefined) {
            this.buildBitfieldFieldAccessor(options, typeMapping);
            return;
        }

        const needsObjectWrap =
            typeMapping.ffi.type === "boxed" ||
            typeMapping.ffi.type === "gobject" ||
            typeMapping.ffi.type === "fundamental";
        const isInterfaceField = needsObjectWrap && typeMapping.kind === "interface";

        if (needsObjectWrap) {
            this.file.addImport(
                "../../registry.js",
                isInterfaceField ? ["getNativeObjectAsInterface"] : ["getNativeObject"],
            );
        }

        if (!isReadable) return;

        this.file.addImport("../../native.js", ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        const getBody = this.buildFieldGetBody(typeMapping, offset, needsObjectWrap, isInterfaceField);
        const setBody = isWritable ? this.buildFieldSetBody(typeMapping, offset, needsObjectWrap) : undefined;

        cls.addAccessor(
            accessor(fieldName, {
                type: needsObjectWrap ? `${typeMapping.ts} | null` : typeMapping.ts,
                getBody,
                setBody,
                doc: doc?.[0]?.description,
            }),
        );
    }

    /**
     * Emits a read accessor for a C bitfield member, masking and shifting the
     * stored value down to its logical width. A writable bitfield also gets a
     * read-modify-write setter that preserves sibling bits in the storage unit.
     */
    private buildBitfieldFieldAccessor(options: PrimitiveFieldAccessorOptions, typeMapping: MappedType): void {
        const { field, fieldName, offset, isReadable, isWritable, cls, bitOffset, bitWidth } = options;
        if (!isReadable) return;
        this.file.addImport("../../native.js", isWritable ? ["read", "t", "write"] : ["read", "t"]);
        const bitDoc = buildJsDocStructure(field.doc, this.options.namespace);
        cls.addAccessor(
            accessor(fieldName, {
                type: typeMapping.ts,
                getBody: (writer: Writer): void => {
                    writer.write("return ");
                    this.appendLeafRead(writer, {
                        handleExpr: "getHandle(this)",
                        ffi: typeMapping.ffi,
                        offsetExpr: String(offset),
                        bitOffset,
                        bitWidth,
                    });
                    writer.writeLine(";");
                },
                setBody: isWritable
                    ? (writer: Writer): void => {
                          this.writeLeafWrite(writer, {
                              handleExpr: "getHandle(this)",
                              ffi: typeMapping.ffi,
                              offsetExpr: String(offset),
                              valueExpr: "value",
                              bitOffset,
                              bitWidth,
                          });
                      }
                    : undefined,
                doc: bitDoc?.[0]?.description,
            }),
        );
    }

    private buildFieldGetBody(
        typeMapping: MappedType,
        offset: number,
        needsObjectWrap: boolean,
        isInterfaceField: boolean,
    ): (writer: Writer) => void {
        if (needsObjectWrap) {
            const wrapFn = isInterfaceField ? "getNativeObjectAsInterface" : "getNativeObject";
            return (writer: Writer) => {
                writer.write("const ptr = read(getHandle(this),");
                writeFfiTypeExpression(writer, typeMapping.ffi);
                writer.writeLine(`, ${offset});`);
                writer.writeLine("if (ptr === null) return null;");
                writer.writeLine(`return ${wrapFn}(ptr, ${typeMapping.ts});`);
            };
        }
        return (writer: Writer) => {
            writer.write("return read(getHandle(this),");
            writeFfiTypeExpression(writer, typeMapping.ffi);
            writer.writeLine(`, ${offset});`);
        };
    }

    private buildFieldSetBody(
        typeMapping: MappedType,
        offset: number,
        needsObjectWrap: boolean,
    ): (writer: Writer) => void {
        this.file.addImport("../../native.js", ["write", "t"]);
        return (writer: Writer) => {
            writer.write("write(getHandle(this),");
            writeFfiTypeExpression(writer, typeMapping.ffi);
            if (needsObjectWrap) {
                writer.writeLine(`, ${offset}, tryGetHandle(value));`);
            } else {
                writer.writeLine(`, ${offset}, value);`);
            }
        };
    }

    /**
     * Appends a memory-read expression for a single struct field. Bitfield
     * members are masked and shifted down to their logical value.
     */
    private appendLeafRead(
        writer: Writer,
        opts: { handleExpr: string; ffi: FfiTypeDescriptor; offsetExpr: string; bitOffset?: number; bitWidth?: number },
    ): void {
        const { handleExpr, ffi, offsetExpr, bitOffset, bitWidth } = opts;
        if (bitWidth === undefined) {
            writer.write(`read(${handleExpr}, `);
            writeFfiTypeExpression(writer, ffi);
            writer.write(`, ${offsetExpr})`);
            return;
        }
        const mask = (1 << bitWidth) - 1;
        writer.write(`((read(${handleExpr}, `);
        writeFfiTypeExpression(writer, ffi);
        writer.write(`, ${offsetExpr}) >>> ${bitOffset ?? 0}) & ${mask})`);
    }

    /**
     * Writes a memory-write statement for a single struct field. Bitfield
     * members are merged into their storage unit via read-modify-write so
     * sibling bits sharing the unit are preserved.
     */
    private writeLeafWrite(
        writer: Writer,
        opts: {
            handleExpr: string;
            ffi: FfiTypeDescriptor;
            offsetExpr: string;
            valueExpr: string;
            bitOffset?: number;
            bitWidth?: number;
        },
    ): void {
        const { handleExpr, ffi, offsetExpr, valueExpr, bitOffset, bitWidth } = opts;
        writer.write(`write(${handleExpr}, `);
        writeFfiTypeExpression(writer, ffi);
        if (bitWidth === undefined) {
            writer.writeLine(`, ${offsetExpr}, ${valueExpr});`);
            return;
        }
        const mask = (1 << bitWidth) - 1;
        const shiftedMask = mask << (bitOffset ?? 0);
        writer.write(`, ${offsetExpr}, ((read(${handleExpr}, `);
        writeFfiTypeExpression(writer, ffi);
        writer.writeLine(
            `, ${offsetExpr}) & ~${shiftedMask}) | ((${valueExpr} & ${mask}) << ${bitOffset ?? 0})) >>> 0);`,
        );
    }

    private generateField(opts: {
        field: GirField;
        offset: number;
        fields: readonly GirField[];
        cls: ClassDeclarationBuilder;
        methodNames: Set<string>;
        bitOffset?: number;
        bitWidth?: number;
    }): void {
        const { field, offset, fields, cls, methodNames, bitOffset, bitWidth } = opts;
        const fieldName = this.resolveFieldName(field);
        const ctx: FieldAccessorContext = { field, fieldName, offset, cls, methodNames };

        if (this.tryGenerateArrayField(ctx, fields)) return;

        const typeName = String(field.type.name);

        if (this.isCallbackFieldType(typeName)) {
            this.generateCallbackFieldAccessor(ctx);
            return;
        }

        if (this.fieldBuilder.isInlineNestedStruct(field)) {
            this.generateNestedStructAccessors(ctx);
            return;
        }

        if (this.fieldBuilder.isNestedStructType(typeName)) {
            const isPointerToStruct = field.type.cType?.includes("*") === true;
            if (isPointerToStruct) {
                this.generatePointerToStructFieldAccessor(ctx);
            } else {
                this.generateInlineStructFieldAccessor(ctx, typeName);
            }
            return;
        }

        if (!this.fieldBuilder.isGeneratableFieldType(typeName)) return;

        const isReadable = field.readable !== false && !methodNames.has(fieldName);
        const isWritable = field.writable !== false && !methodNames.has(fieldName);

        this.buildPrimitiveFieldAccessor({
            field,
            fieldName,
            offset,
            isReadable,
            isWritable,
            cls,
            bitOffset,
            bitWidth,
        });
    }

    private generateFields(
        fields: readonly GirField[],
        methods: readonly GirMethod[],
        cls: ClassDeclarationBuilder,
        isUnion: boolean,
    ): void {
        const layout = this.fieldBuilder.calculateLayout(fields, false, isUnion);
        const methodNames = new Set(methods.map((m) => toCamelCase(m.name)));

        for (const layoutItem of layout) {
            if (!layoutItem) continue;
            this.generateField({
                field: layoutItem.field,
                offset: layoutItem.offset,
                fields,
                cls,
                methodNames,
                bitOffset: layoutItem.bitOffset,
                bitWidth: layoutItem.bitWidth,
            });
        }
    }

    /**
     * Emits an accessor for a struct field holding a pointer to another
     * struct. The pointer is read or written whole, matching node-gtk, which
     * exposes such fields as struct-typed members regardless of whether the
     * pointed-to type is self-referential.
     */
    private generatePointerToStructFieldAccessor(ctx: FieldAccessorContext): void {
        const { field, fieldName, offset, cls, methodNames } = ctx;
        if (field.readable === false || methodNames.has(fieldName)) return;
        const mapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        if (mapping.ffi.type !== "struct") return;
        const ffi = { ...mapping.ffi, ownership: "borrowed" as const };
        const isWritable = field.writable !== false && !methodNames.has(fieldName);
        this.file.addImport("../../native.js", isWritable ? ["read", "t", "write"] : ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        cls.addAccessor(
            accessor(fieldName, {
                type: "unknown",
                getBody: this.buildWholeFieldGetBody(ffi, offset),
                setBody: isWritable ? this.buildWholeFieldSetBody(ffi, offset) : undefined,
                doc: doc?.[0]?.description,
            }),
        );
    }

    /**
     * Emits a read-only accessor for an inline struct field whose element
     * type cannot be safely flattened into per-leaf accessors.
     *
     * The struct is read whole from its byte offset, mirroring node-gtk,
     * which exposes such fields as a single struct-typed member.
     */
    private generateInlineStructFieldAccessor(ctx: FieldAccessorContext, typeName: string): void {
        const { field, fieldName, offset, cls, methodNames } = ctx;
        if (field.readable === false || methodNames.has(fieldName)) return;
        const mapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        if (mapping.ffi.type !== "struct") return;
        const size = this.fieldBuilder.getRecordSize(typeName);
        if (size <= 0) return;
        const structFfi = { ...mapping.ffi, size, ownership: "borrowed" as const };
        this.file.addImport("../../native.js", ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        const getBody = (writer: Writer): void => {
            writer.write("return read(getHandle(this), ");
            writeFfiTypeExpression(writer, structFfi);
            writer.writeLine(`, ${offset});`);
        };

        cls.addAccessor(
            accessor(fieldName, {
                type: "unknown",
                getBody,
                doc: doc?.[0]?.description,
            }),
        );
    }

    private generateNestedStructAccessors(ctx: FieldAccessorContext): void {
        const { field, fieldName, offset: baseOffset, cls, methodNames } = ctx;
        const typeName = String(field.type.name);
        const nestedLayout = this.fieldBuilder.getNestedStructLayout(typeName);
        if (!nestedLayout) return;

        const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        if (typeMapping.unsafe) {
            this.generateInlineStructFieldAccessor(ctx, typeName);
            return;
        }
        addTypeImports(this.file, typeMapping.imports, this.selfNames);

        const tsTypeName = typeMapping.ts;
        const isReadable = field.readable !== false && !methodNames.has(fieldName);
        const isWritable = field.writable !== false && !methodNames.has(fieldName);

        const writableFields = this.collectNestedWritableFields(nestedLayout, baseOffset);
        if (!isReadable) return;

        const writable = isWritable && writableFields.length > 0;
        this.file.addImport("../../native.js", writable ? ["read", "t", "write"] : ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        cls.addAccessor(
            accessor(fieldName, {
                type: tsTypeName,
                getBody: this.buildNestedStructGetBody(tsTypeName, writableFields),
                setBody: writable ? this.buildNestedStructSetBody(writableFields) : undefined,
                doc: doc?.[0]?.description,
            }),
        );
    }

    private collectNestedWritableFields(
        nestedLayout: StructLayout,
        baseOffset: number,
    ): Array<{ fieldName: string; offset: number; bitOffset?: number; bitWidth?: number; mapping: MappedType }> {
        return nestedLayout
            .filter(
                (item) =>
                    this.fieldBuilder.isGeneratableFieldType(String(item.field.type.name)) &&
                    this.fieldBuilder.isWritableType(item.field.type),
            )
            .map((item) => ({
                fieldName: toValidMemberName(toCamelCase(item.field.name)),
                offset: baseOffset + item.offset,
                bitOffset: item.bitOffset,
                bitWidth: item.bitWidth,
                mapping: this.ffiMapper.mapType(item.field.type, false, item.field.type.transferOwnership),
            }))
            .filter((entry) => !entry.mapping.unsafe);
    }

    private buildNestedStructGetBody(
        tsTypeName: string,
        writableFields: ReturnType<RecordGenerator["collectNestedWritableFields"]>,
    ): (writer: Writer) => void {
        return (writer: Writer): void => {
            writer.writeLine(`return new ${tsTypeName}({`);
            writer.withIndent(() => {
                for (const nested of writableFields) {
                    writer.write(`${nested.fieldName}: `);
                    this.appendLeafRead(writer, {
                        handleExpr: "getHandle(this)",
                        ffi: nested.mapping.ffi,
                        offsetExpr: String(nested.offset),
                        bitOffset: nested.bitOffset,
                        bitWidth: nested.bitWidth,
                    });
                    writer.writeLine(",");
                }
            });
            writer.writeLine("});");
        };
    }

    private buildNestedStructSetBody(
        writableFields: ReturnType<RecordGenerator["collectNestedWritableFields"]>,
    ): (writer: Writer) => void {
        return (writer: Writer): void => {
            for (const nested of writableFields) {
                this.writeLeafWrite(writer, {
                    handleExpr: "getHandle(this)",
                    ffi: nested.mapping.ffi,
                    offsetExpr: String(nested.offset),
                    valueExpr: `value.${nested.fieldName}`,
                    bitOffset: nested.bitOffset,
                    bitWidth: nested.bitWidth,
                });
            }
        };
    }

    private generateArrayFieldAccessors(ctx: FieldAccessorContext, allFields: readonly GirField[]): void {
        const { field, fieldName, offset: ptrOffset, cls, methodNames } = ctx;
        const elementType = field.type.elementType;
        if (!elementType) return;

        const elementTypeName = String(elementType.name);
        const elementSize = this.fieldBuilder.getRecordSize(elementTypeName);
        if (elementSize === 0) return;

        const typeMapping = this.ffiMapper.mapType(elementType, false, elementType.transferOwnership);
        if (typeMapping.unsafe) return;
        addTypeImports(this.file, typeMapping.imports, this.selfNames);

        const tsTypeName = typeMapping.ts;
        const isReadable = field.readable !== false && !methodNames.has(fieldName);
        const isWritable = field.writable !== false && !methodNames.has(fieldName);
        if (!isReadable) return;

        const wrapElement = this.resolveArrayElementWrap(elementTypeName);
        const lengthExpr = this.resolveArrayLengthExpression(field, allFields);
        if (lengthExpr === null) return;

        const elementLayout = this.fieldBuilder.getNestedStructLayout(elementTypeName);
        if (!elementLayout) return;

        const plan = this.buildArrayElementPlan(elementLayout);
        if (plan.length === 0) return;

        const doc = buildJsDocStructure(field.doc, this.options.namespace);
        this.file.addImport("../../native.js", isWritable ? ["read", "t", "write"] : ["read", "t"]);

        const context: ArrayAccessorContext = {
            structTypeExpr: `t.struct("${elementTypeName}", "borrowed", ${lengthExpr} * ${elementSize})`,
            ptrOffset,
            lengthExpr,
            elementSize,
            wrapElement,
            tsTypeName,
            plan,
        };

        cls.addAccessor(
            accessor(fieldName, {
                type: `${tsTypeName}[]`,
                getBody: this.buildArrayFieldGetBody(context),
                setBody: isWritable ? this.buildArrayFieldSetBody(context) : undefined,
                doc: doc?.[0]?.description,
            }),
        );
    }

    private resolveArrayElementWrap(elementTypeName: string): boolean {
        const [elementNamespace, elementName] = elementTypeName.includes(".")
            ? elementTypeName.split(".")
            : [this.options.namespace, elementTypeName];
        const elementRecord =
            elementNamespace && elementName
                ? this.repo?.getNamespace(elementNamespace)?.records.get(elementName)
                : undefined;
        return elementRecord?.isBoxed() === true;
    }

    /**
     * Builds the getter body for a struct-array field accessor: reads the
     * backing buffer and maps each element struct into a plain object.
     */
    private buildArrayFieldGetBody(context: ArrayAccessorContext): (writer: Writer) => void {
        const { structTypeExpr, ptrOffset, lengthExpr, elementSize, wrapElement, tsTypeName, plan } = context;
        return (writer: Writer): void => {
            writer.writeLine(`const array = read(getHandle(this),${structTypeExpr}, ${ptrOffset});`);
            writer.writeLine("const result = [];");
            writer.writeLine(`for (let index = 0; index < ${lengthExpr}; index++) {`);
            writer.withIndent(() => {
                writer.writeLine(`const base = index * ${elementSize};`);
                writer.writeLine(wrapElement ? `result.push(Object.assign(new ${tsTypeName}(), {` : "result.push({");
                writer.withIndent(() => {
                    for (const entry of plan) {
                        this.writeArrayElementEntryRead(writer, entry);
                    }
                });
                writer.writeLine(wrapElement ? "}));" : "});");
            });
            writer.writeLine("}");
            writer.writeLine("return result;");
        };
    }

    /**
     * Builds the setter body for a struct-array field accessor: writes each
     * element object back into the backing buffer.
     */
    private buildArrayFieldSetBody(context: ArrayAccessorContext): (writer: Writer) => void {
        const { structTypeExpr, ptrOffset, elementSize, plan } = context;
        return (writer: Writer): void => {
            writer.writeLine(`const array = read(getHandle(this),${structTypeExpr}, ${ptrOffset});`);
            writer.writeLine("for (let index = 0; index < value.length; index++) {");
            writer.withIndent(() => {
                writer.writeLine("const element = value[index];");
                writer.writeLine(`const base = index * ${elementSize};`);
                for (const entry of plan) {
                    this.writeArrayElementEntryWrite(writer, entry);
                }
            });
            writer.writeLine("}");
            writer.writeLine(`write(getHandle(this),${structTypeExpr}, ${ptrOffset}, array);`);
        };
    }

    /**
     * Resolves the element-count expression for a struct array field: a fixed
     * literal size, or a `this.<member>` reference to the sibling length field.
     * Returns `null` when the field carries no usable length.
     */
    private resolveArrayLengthExpression(field: GirField, allFields: readonly GirField[]): string | null {
        const fixedSize = field.type.fixedSize;
        if (fixedSize !== undefined) {
            return String(fixedSize);
        }
        const lengthFieldIndex = field.type.sizeParamIndex;
        if (lengthFieldIndex === undefined) {
            return null;
        }
        const publicFields = allFields.filter((f) => !f.private);
        const lengthField = publicFields[lengthFieldIndex];
        if (!lengthField) return null;
        return `this.${toValidMemberName(toCamelCase(lengthField.name))}`;
    }

    /**
     * Writes the read expression for a single array element entry into the
     * surrounding object literal, recursing one level for inline nested
     * structs.
     */
    private writeArrayElementEntryRead(writer: Writer, entry: ArrayElementEntry): void {
        if (entry.kind === "primitive") {
            writer.write(`${entry.leaf.name}: `);
            this.appendLeafRead(writer, {
                handleExpr: "array",
                ffi: entry.leaf.ffi,
                offsetExpr: `base + ${entry.leaf.offset}`,
                bitOffset: entry.leaf.bitOffset,
                bitWidth: entry.leaf.bitWidth,
            });
            writer.writeLine(",");
            return;
        }
        writer.writeLine(`${entry.name}: {`);
        writer.withIndent(() => {
            for (const sub of entry.subFields) {
                writer.write(`${sub.name}: `);
                this.appendLeafRead(writer, {
                    handleExpr: "array",
                    ffi: sub.ffi,
                    offsetExpr: `base + ${sub.offset}`,
                    bitOffset: sub.bitOffset,
                    bitWidth: sub.bitWidth,
                });
                writer.writeLine(",");
            }
        });
        writer.writeLine("},");
    }

    /**
     * Writes the write statements for a single array element entry, recursing
     * one level for inline nested structs.
     */
    private writeArrayElementEntryWrite(writer: Writer, entry: ArrayElementEntry): void {
        if (entry.kind === "primitive") {
            this.writeLeafWrite(writer, {
                handleExpr: "array",
                ffi: entry.leaf.ffi,
                offsetExpr: `base + ${entry.leaf.offset}`,
                valueExpr: `element.${entry.leaf.name}`,
                bitOffset: entry.leaf.bitOffset,
                bitWidth: entry.leaf.bitWidth,
            });
            return;
        }
        for (const sub of entry.subFields) {
            this.writeLeafWrite(writer, {
                handleExpr: "array",
                ffi: sub.ffi,
                offsetExpr: `base + ${sub.offset}`,
                valueExpr: `element.${entry.name}.${sub.name}`,
                bitOffset: sub.bitOffset,
                bitWidth: sub.bitWidth,
            });
        }
    }

    /**
     * Flattens an array element struct layout into a plan describing how to
     * read and write each field: primitives directly, inline nested structs
     * grouped from their writable leaf fields.
     */
    private buildArrayElementPlan(elementLayout: StructLayout): ArrayElementEntry[] {
        const plan: ArrayElementEntry[] = [];
        for (const item of elementLayout) {
            const entry = this.buildPrimitiveArrayEntry(item) ?? this.buildNestedArrayEntry(item);
            if (entry) plan.push(entry);
        }
        return plan;
    }

    /**
     * Builds the primitive-leaf array element entry for a layout item, or
     * `null` when the item is not a generatable primitive.
     */
    private buildPrimitiveArrayEntry(item: StructLayoutItem): ArrayElementEntry | null {
        const typeName = String(item.field.type.name);
        if (!this.fieldBuilder.isWritableType(item.field.type) || !this.fieldBuilder.isGeneratableFieldType(typeName)) {
            return null;
        }
        const mapping = this.ffiMapper.mapType(item.field.type, false, item.field.type.transferOwnership);
        if (mapping.unsafe && !UNSAFE_PRIMITIVE_NAMES.has(typeName)) return null;
        return {
            kind: "primitive",
            leaf: {
                name: toValidMemberName(toCamelCase(item.field.name)),
                offset: item.offset,
                ffi: mapping.ffi,
                bitOffset: item.bitOffset,
                bitWidth: item.bitWidth,
            },
        };
    }

    /**
     * Builds the inline-nested-struct array element entry for a layout item, or
     * `null` when the item is not an inline struct with writable leaf fields.
     */
    private buildNestedArrayEntry(item: StructLayoutItem): ArrayElementEntry | null {
        if (!this.fieldBuilder.isInlineNestedStruct(item.field)) return null;
        const subLayout = this.fieldBuilder.getNestedStructLayout(String(item.field.type.name));
        if (!subLayout) return null;

        const subFields: ArrayElementLeaf[] = [];
        for (const subItem of subLayout) {
            if (!this.fieldBuilder.isWritableType(subItem.field.type)) continue;
            const subMapping = this.ffiMapper.mapType(subItem.field.type, false, subItem.field.type.transferOwnership);
            if (subMapping.unsafe) continue;
            subFields.push({
                name: toValidMemberName(toCamelCase(subItem.field.name)),
                offset: item.offset + subItem.offset,
                ffi: subMapping.ffi,
                bitOffset: subItem.bitOffset,
                bitWidth: subItem.bitWidth,
            });
        }
        if (subFields.length === 0) return null;
        return { kind: "nested", name: toValidMemberName(toCamelCase(item.field.name)), subFields };
    }
}
