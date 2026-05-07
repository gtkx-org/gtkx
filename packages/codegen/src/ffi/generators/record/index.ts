/**
 * Record Generator
 *
 * Generates record (struct/boxed type) classes using the builder library.
 * Orchestrates sub-builders for different aspects of record generation.
 */

import type { GirConstructor, GirField, GirFunction, GirMethod, GirRecord, GirRepository } from "@gtkx/gir";
import type { FileBuilder } from "../../../builders/file-builder.js";
import {
    accessor,
    type ClassDeclarationBuilder,
    classDecl,
    constructorDecl,
    method,
    param,
    property,
    typeAlias,
} from "../../../builders/index.js";
import type { ConstructorBuilder } from "../../../builders/members/constructor.js";
import type { Writer } from "../../../builders/writer.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import {
    boxedSelfType,
    type FfiTypeDescriptor,
    fundamentalSelfType,
    type MappedType,
    SELF_TYPE_GOBJECT,
    type SelfTypeDescriptor,
} from "../../../core/type-system/ffi-types.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { filterSupportedFunctions, filterSupportedMethods } from "../../../core/utils/filtering.js";
import { normalizeClassName, toCamelCase, toValidMemberName } from "../../../core/utils/naming.js";
import { writeFfiTypeExpression } from "../../../core/writers/ffi-type-expression.js";
import {
    addMethodStructure,
    addTypeImports,
    applyForcedNonNullArgs,
    createMethodBodyWriter,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../../core/writers/index.js";
import { FieldBuilder } from "./field-builder.js";

type RecordTypeMeta = {
    glibTypeName?: string;
    glibGetType?: string;
    copyFunction?: string;
    freeFunction?: string;
};

function writeNativeHandleBranch(
    writer: Writer,
    handleVar: string,
    elseBody: () => void,
    superCall: string = `super(${handleVar})`,
): void {
    writer.writeLine(`if (isNativeHandle(${handleVar})) {`);
    writer.withIndent(() => {
        writer.writeLine(`${superCall};`);
    });
    writer.writeLine("} else {");
    writer.withIndent(elseBody);
    writer.writeLine("}");
}

/**
 * Generates record (struct/boxed type) classes.
 */
export class RecordGenerator {
    private readonly fieldBuilder: FieldBuilder;
    private readonly methodBody: MethodBodyWriter;
    private selfNames: ReadonlySet<string> = new Set();

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly file: FileBuilder,
        private readonly options: FfiGeneratorOptions,
        repo?: GirRepository,
    ) {
        this.fieldBuilder = new FieldBuilder(
            ffiMapper,
            file,
            options.sharedLibrary,
            options.glibLibrary,
            repo,
            options.namespace,
        );
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

        this.generateInitInterface(record, recordName);
        const cls = this.generateClass(record, recordName);

        const methodStructures: MethodStructure[] = [];

        this.generateConstructors(record, recordName, cls, methodStructures);

        methodStructures.push(
            ...this.buildStaticFunctionStructures(record.staticFunctions, recordName, record.name),
            ...this.buildMethodStructures(record.methods, {
                glibTypeName: record.glibTypeName,
                glibGetType: record.glibGetType,
                copyFunction: record.copyFunction,
                freeFunction: record.freeFunction,
            }),
        );

        for (const struct of methodStructures) {
            addMethodStructure(cls, struct);
        }

        this.generateFields(record.fields, record.methods, cls);

        this.file.add(cls);

        if (record.glibTypeName) {
            this.file.addImport("../../registry.js", ["registerNativeClass"]);
            this.file.addStatement(`\nregisterNativeClass(${recordName});`);
        }
    }

    private generateInitInterface(record: GirRecord, recordName: string): void {
        const { main: mainConstructor } = this.methodBody.selectConstructors(record.constructors);

        if (mainConstructor) {
            const filteredParams = this.methodBody.filterParameters(mainConstructor.parameters);
            if (filteredParams.length > 0) return;
        }

        const initFields = this.fieldBuilder.getInitializableFields(record.fields);
        if (initFields.length === 0) return;

        const propStrings: string[] = [];
        for (const field of initFields) {
            let fieldName = toValidMemberName(toCamelCase(field.name));
            if (fieldName === "id") fieldName = "id_";
            const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
            if (typeMapping.unsafe) continue;
            addTypeImports(this.file, typeMapping.imports, this.selfNames);
            propStrings.push(`${fieldName}?: ${typeMapping.ts}`);
        }

        if (propStrings.length === 0) return;

        this.file.add(typeAlias(`${recordName}Init`, `{ ${propStrings.join("; ")} }`, { exported: true }));
    }

    private generateClass(record: GirRecord, recordName: string): ClassDeclarationBuilder {
        this.file.addImport("../../object.js", ["NativeObject"]);

        const doc = buildJsDocStructure(record.doc, this.options.namespace);
        const cls = classDecl(recordName, {
            exported: true,
            extends: "NativeObject",
            doc: doc?.[0]?.description,
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

        return cls;
    }

    private buildRecordMeta(record: GirRecord): RecordTypeMeta {
        return {
            glibTypeName: record.glibTypeName ?? record.cType,
            glibGetType: record.glibGetType,
            copyFunction: record.copyFunction,
            freeFunction: record.freeFunction,
        };
    }

    private buildEmptyParamConstructor(
        record: GirRecord,
        recordName: string,
        mainConstructor: GirConstructor,
        args: { type: FfiTypeDescriptor; value: string; optional?: boolean }[],
        meta: RecordTypeMeta,
    ): ConstructorBuilder {
        const initFields = this.fieldBuilder.getInitializableFields(record.fields);
        if (initFields.length > 0) {
            this.file.addImport("../../native.js", ["t", "write"]);
            return constructorDecl({
                overloads: [
                    { params: [param("handle", "NativeHandle")] },
                    { params: [param("init", `${recordName}Init`, { optional: true })] },
                ],
                params: [param("init", `${recordName}Init | NativeHandle`, { defaultValue: "{}" })],
                body: this.writeConstructorWithCallAndInitOverloaded(mainConstructor, args, meta, record.fields),
            });
        }

        return constructorDecl({
            overloads: [{ params: [param("handle", "NativeHandle")] }, { params: [] }],
            params: [param("handle", "NativeHandle", { optional: true })],
            body: this.writeConstructorWithCallOverloaded("handle", mainConstructor, args, meta),
        });
    }

    private buildParameterizedConstructor(
        ctorShape: ReturnType<MethodBodyWriter["buildShape"]>,
        mainConstructor: GirConstructor,
        args: { type: FfiTypeDescriptor; value: string; optional?: boolean }[],
        meta: RecordTypeMeta,
    ): ConstructorBuilder {
        const params = this.methodBody.buildSignatureParameters(ctorShape, false);
        const firstParam = params[0] ?? { name: "arg0", type: "unknown" };
        const baseType = firstParam.type.includes("=>") ? `(${firstParam.type})` : firstParam.type;
        const implParams = params.map((p, i) =>
            i === 0
                ? param(p.name, `${baseType} | NativeHandle`, { optional: p.optional })
                : param(p.name, p.type, { optional: true }),
        );
        return constructorDecl({
            overloads: [
                { params: [param("handle", "NativeHandle")] },
                { params: params.map((p) => param(p.name, p.type, { optional: p.optional })) },
            ],
            params: implParams,
            body: this.writeConstructorWithCallOverloaded(firstParam.name, mainConstructor, args, meta),
        });
    }

    private buildAllocConstructor(record: GirRecord, recordName: string, allocFn: string): ConstructorBuilder {
        const initFields = this.fieldBuilder.getInitializableFields(record.fields);
        if (initFields.length > 0) {
            this.file.addImport("../../native.js", ["t", "write"]);
            return constructorDecl({
                overloads: [
                    { params: [param("handle", "NativeHandle")] },
                    { params: [param("init", `${recordName}Init`, { optional: true })] },
                ],
                params: [param("init", `${recordName}Init | NativeHandle`, { defaultValue: "{}" })],
                body: this.writeConstructorWithAllocOverloaded(allocFn, record.fields),
            });
        }

        return constructorDecl({
            overloads: [{ params: [param("handle", "NativeHandle")] }, { params: [] }],
            params: [param("handle", "NativeHandle", { optional: true })],
            body: (writer) => {
                writer.writeLine("if (isNativeHandle(handle)) {");
                writer.withIndent(() => writer.writeLine("super(handle);"));
                writer.writeLine("} else {");
                writer.withIndent(() => writer.writeLine(`super(${allocFn} as NativeHandle);`));
                writer.writeLine("}");
            },
        });
    }

    private setupMainConstructor(
        record: GirRecord,
        recordName: string,
        cls: ClassDeclarationBuilder,
        mainConstructor: GirConstructor,
        supportedConstructors: GirConstructor[],
        methodStructures: MethodStructure[],
    ): void {
        this.file.addImport("@gtkx/native", ["isNativeHandle"]);
        this.file.addTypeImport("../../object.js", ["NativeHandle"]);
        const filteredParams = this.methodBody.filterParameters(mainConstructor.parameters);
        const ctorShape = this.methodBody.buildShape(mainConstructor.parameters, undefined, 0);
        const args = this.methodBody.buildShapeCallArguments(ctorShape, mainConstructor.parameters);
        const meta = this.buildRecordMeta(record);

        cls.setConstructor(
            filteredParams.length === 0
                ? this.buildEmptyParamConstructor(record, recordName, mainConstructor, args, meta)
                : this.buildParameterizedConstructor(ctorShape, mainConstructor, args, meta),
        );

        const factoryMeta: RecordTypeMeta = {
            glibTypeName: record.glibTypeName,
            glibGetType: record.glibGetType,
            copyFunction: record.copyFunction,
            freeFunction: record.freeFunction,
        };
        for (const ctor of supportedConstructors) {
            if (ctor !== mainConstructor) {
                methodStructures.push(this.buildStaticFactoryMethodStructure(ctor, recordName, factoryMeta));
            }
        }
    }

    private setupAllocConstructor(record: GirRecord, recordName: string, cls: ClassDeclarationBuilder): void {
        if (record.fields.length === 0) return;

        this.file.addImport("@gtkx/native", ["isNativeHandle"]);
        this.file.addTypeImport("../../object.js", ["NativeHandle"]);
        const structSize = this.fieldBuilder.calculateStructSize(record.fields);
        this.file.addImport("../../native.js", ["alloc"]);

        const allocFn = record.glibTypeName
            ? `alloc(${structSize}, "${record.glibTypeName}", "${this.options.sharedLibrary}")`
            : `alloc(${structSize})`;

        cls.setConstructor(this.buildAllocConstructor(record, recordName, allocFn));
    }

    private generateConstructors(
        record: GirRecord,
        recordName: string,
        cls: ClassDeclarationBuilder,
        methodStructures: MethodStructure[],
    ): void {
        const { supported: supportedConstructors, main: mainConstructor } = this.methodBody.selectConstructors(
            record.constructors,
        );

        if (mainConstructor) {
            this.setupMainConstructor(
                record,
                recordName,
                cls,
                mainConstructor,
                supportedConstructors,
                methodStructures,
            );
        } else {
            this.setupAllocConstructor(record, recordName, cls);
        }
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

    private writeCallExpression(
        writer: Writer,
        mainConstructor: GirConstructor,
        args: { type: FfiTypeDescriptor; value: string; optional?: boolean }[],
        meta: RecordTypeMeta,
    ): void {
        const ownership: "full" | "borrowed" =
            mainConstructor.returnType.transferOwnership === "full" ? "full" : "borrowed";

        const returnType = this.buildRecordReturnDescriptor(meta, ownership);

        const callWriter = this.methodBody.buildCallWriter({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: mainConstructor.cIdentifier,
            args,
            returnType,
        });
        writer.write("const __handle = ");
        callWriter(writer);
        writer.writeLine(" as NativeHandle;");
    }

    private writeConstructorWithCallOverloaded(
        firstParamName: string,
        mainConstructor: GirConstructor,
        args: { type: FfiTypeDescriptor; value: string; optional?: boolean }[],
        meta: RecordTypeMeta,
    ): (writer: Writer) => void {
        const shape = this.methodBody.buildShape(mainConstructor.parameters, undefined, 0);
        const params = this.methodBody.buildSignatureParameters(shape, false);
        applyForcedNonNullArgs(
            args,
            params
                .slice(1)
                .filter((p) => !p.optional)
                .map((p) => p.name),
        );

        return (writer) => {
            writeNativeHandleBranch(writer, firstParamName, () => {
                for (const hidden of shape.hiddenOuts) {
                    this.methodBody.writeHiddenOutDeclarationFor(writer, hidden);
                }
                this.writeCallExpression(writer, mainConstructor, args, meta);
                writer.writeLine("super(__handle);");
            });
        };
    }

    private writeConstructorWithAllocOverloaded(
        allocFn: string,
        fields: readonly GirField[],
    ): (writer: Writer) => void {
        return (writer) => {
            writeNativeHandleBranch(writer, "init", () => {
                writer.writeLine(`const __handle = ${allocFn} as NativeHandle;`);
                writer.writeLine("super(__handle);");
                this.fieldBuilder.writeFieldWrites(fields)(writer);
            });
        };
    }

    private writeConstructorWithCallAndInitOverloaded(
        mainConstructor: GirConstructor,
        args: { type: FfiTypeDescriptor; value: string; optional?: boolean }[],
        meta: RecordTypeMeta,
        fields: readonly GirField[],
    ): (writer: Writer) => void {
        return (writer) => {
            writeNativeHandleBranch(writer, "init", () => {
                this.writeCallExpression(writer, mainConstructor, args, meta);
                writer.writeLine("super(__handle);");
                this.fieldBuilder.writeFieldWrites(fields)(writer);
            });
        };
    }

    private buildStaticFactoryMethodStructure(
        ctor: GirConstructor,
        recordName: string,
        meta: RecordTypeMeta,
    ): MethodStructure {
        const methodName = toCamelCase(ctor.name);
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
        ctor: GirConstructor,
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
        const supportedFunctions = filterSupportedFunctions(
            functions,
            (params) => this.methodBody.hasUnsupportedCallbacks(params),
            (returnType) => this.methodBody.isReturnTypeUnsafe(returnType),
        );
        return supportedFunctions.map((func) => this.buildStaticFunctionStructure(func, recordName, originalName));
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
        const supportedMethods = filterSupportedMethods(
            methods,
            (params) => this.methodBody.hasUnsupportedCallbacks(params),
            (returnType) => this.methodBody.isReturnTypeUnsafe(returnType),
        );
        return supportedMethods.map((method) => this.buildMethodStructure(method, meta));
    }

    private buildMethodStructure(m: GirMethod, meta: RecordTypeMeta): MethodStructure {
        const methodName = toCamelCase(m.name);
        const instanceOwnership = m.instanceParameter?.transferOwnership === "full" ? "full" : "borrowed";
        const className = meta.glibTypeName;
        let selfTypeDescriptor: SelfTypeDescriptor;
        if (className) {
            selfTypeDescriptor =
                meta.copyFunction && meta.freeFunction
                    ? fundamentalSelfType(
                          this.options.sharedLibrary,
                          meta.copyFunction,
                          meta.freeFunction,
                          instanceOwnership,
                          className,
                      )
                    : boxedSelfType(className, this.options.sharedLibrary, meta.glibGetType, instanceOwnership);
        } else {
            selfTypeDescriptor = SELF_TYPE_GOBJECT;
        }

        return this.methodBody.buildMethodStructure(m, {
            methodName,
            selfTypeDescriptor,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
            className,
        });
    }

    private resolveFieldName(field: GirField): string {
        const fieldName = toValidMemberName(toCamelCase(field.name));
        return fieldName === "id" ? "id_" : fieldName;
    }

    private tryGenerateArrayField(
        field: GirField,
        fieldName: string,
        offset: number,
        fields: readonly GirField[],
        cls: ClassDeclarationBuilder,
        methodNames: Set<string>,
    ): boolean {
        if (!field.type.isArray || !field.type.elementType) return false;

        const elementTypeName = String(field.type.elementType.name);
        if (this.fieldBuilder.isNestedStructType(elementTypeName)) {
            this.generateArrayFieldAccessors(field, fieldName, offset, fields, cls, methodNames);
        }
        return true;
    }

    private buildPrimitiveFieldAccessor(
        field: GirField,
        fieldName: string,
        offset: number,
        isReadable: boolean,
        isWritable: boolean,
        cls: ClassDeclarationBuilder,
    ): void {
        const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        if (typeMapping.unsafe) return;
        addTypeImports(this.file, typeMapping.imports, this.selfNames);

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
            this.file.addImport("../../object.js", ["NativeHandle"]);
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

    private buildFieldGetBody(
        typeMapping: MappedType,
        offset: number,
        needsObjectWrap: boolean,
        isInterfaceField: boolean,
    ): (writer: Writer) => void {
        if (needsObjectWrap) {
            const wrapFn = isInterfaceField ? "getNativeObjectAsInterface" : "getNativeObject";
            return (writer: Writer) => {
                writer.write("const ptr = read(this.handle, ");
                writeFfiTypeExpression(writer, typeMapping.ffi);
                writer.writeLine(`, ${offset});`);
                writer.writeLine("if (ptr === null) return null;");
                writer.writeLine(`return ${wrapFn}(ptr as NativeHandle, ${typeMapping.ts});`);
            };
        }
        return (writer: Writer) => {
            writer.write("return read(this.handle, ");
            writeFfiTypeExpression(writer, typeMapping.ffi);
            writer.writeLine(`, ${offset}) as ${typeMapping.ts};`);
        };
    }

    private buildFieldSetBody(
        typeMapping: MappedType,
        offset: number,
        needsObjectWrap: boolean,
    ): (writer: Writer) => void {
        this.file.addImport("../../native.js", ["write", "t"]);
        return (writer: Writer) => {
            writer.write("write(this.handle, ");
            writeFfiTypeExpression(writer, typeMapping.ffi);
            if (needsObjectWrap) {
                writer.writeLine(`, ${offset}, value?.handle ?? null);`);
            } else {
                writer.writeLine(`, ${offset}, value);`);
            }
        };
    }

    private generateField(
        field: GirField,
        offset: number,
        fields: readonly GirField[],
        cls: ClassDeclarationBuilder,
        methodNames: Set<string>,
    ): void {
        const fieldName = this.resolveFieldName(field);

        if (this.tryGenerateArrayField(field, fieldName, offset, fields, cls, methodNames)) return;

        const typeName = String(field.type.name);
        if (!this.fieldBuilder.isGeneratableFieldType(typeName)) return;

        const isReadable = field.readable !== false && !methodNames.has(fieldName);
        const isWritable = field.writable !== false && !methodNames.has(fieldName);

        if (this.fieldBuilder.isInlineNestedStruct(field)) {
            this.generateNestedStructAccessors(field, fieldName, offset, cls, methodNames);
            return;
        }

        if (this.fieldBuilder.isNestedStructType(typeName)) return;

        this.buildPrimitiveFieldAccessor(field, fieldName, offset, isReadable, isWritable, cls);
    }

    private generateFields(
        fields: readonly GirField[],
        methods: readonly GirMethod[],
        cls: ClassDeclarationBuilder,
    ): void {
        const layout = this.fieldBuilder.calculateLayout(fields);
        const methodNames = new Set(methods.map((m) => toCamelCase(m.name)));

        for (const layoutItem of layout) {
            if (!layoutItem) continue;
            this.generateField(layoutItem.field, layoutItem.offset, fields, cls, methodNames);
        }
    }

    private generateNestedStructAccessors(
        field: GirField,
        fieldName: string,
        baseOffset: number,
        cls: ClassDeclarationBuilder,
        methodNames: Set<string>,
    ): void {
        const typeName = String(field.type.name);
        const nestedLayout = this.fieldBuilder.getNestedStructLayout(typeName);
        if (!nestedLayout) return;

        const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        if (typeMapping.unsafe) return;
        addTypeImports(this.file, typeMapping.imports, this.selfNames);

        const tsTypeName = typeMapping.ts;
        const isReadable = field.readable !== false && !methodNames.has(fieldName);
        const isWritable = field.writable !== false && !methodNames.has(fieldName);

        const writableFields = nestedLayout
            .filter(
                (item) =>
                    this.fieldBuilder.isGeneratableFieldType(String(item.field.type.name)) &&
                    this.fieldBuilder.isWritableType(item.field.type),
            )
            .map((item) => ({
                fieldName: toValidMemberName(toCamelCase(item.field.name)),
                offset: baseOffset + item.offset,
                mapping: this.ffiMapper.mapType(item.field.type, false, item.field.type.transferOwnership),
            }))
            .filter((entry) => !entry.mapping.unsafe);

        if (!isReadable) return;

        this.file.addImport("../../native.js", ["read", "t"]);
        const doc = buildJsDocStructure(field.doc, this.options.namespace);

        const getBody = (writer: Writer) => {
            writer.writeLine(`return new ${tsTypeName}({`);
            writer.withIndent(() => {
                for (const nested of writableFields) {
                    writer.write(`${nested.fieldName}: read(this.handle, `);
                    writeFfiTypeExpression(writer, nested.mapping.ffi);
                    writer.writeLine(`, ${nested.offset}) as ${nested.mapping.ts},`);
                }
            });
            writer.writeLine(`});`);
        };

        let setBody: ((writer: Writer) => void) | undefined;
        if (isWritable && writableFields.length > 0) {
            this.file.addImport("../../native.js", ["write", "t"]);
            setBody = (writer) => {
                for (const nested of writableFields) {
                    writer.write(`write(this.handle, `);
                    writeFfiTypeExpression(writer, nested.mapping.ffi);
                    writer.writeLine(`, ${nested.offset}, value.${nested.fieldName});`);
                }
            };
        }

        cls.addAccessor(
            accessor(fieldName, {
                type: tsTypeName,
                getBody,
                setBody,
                doc: doc?.[0]?.description,
            }),
        );
    }

    private generateArrayFieldAccessors(
        field: GirField,
        fieldName: string,
        ptrOffset: number,
        allFields: readonly GirField[],
        cls: ClassDeclarationBuilder,
        methodNames: Set<string>,
    ): void {
        const elementType = field.type.elementType;
        if (!elementType) return;

        const elementTypeName = String(elementType.name);
        const elementSize = this.fieldBuilder.getRecordSize(elementTypeName);
        if (elementSize === 0) return;

        const typeMapping = this.ffiMapper.mapType(elementType, false, elementType.transferOwnership);
        if (typeMapping.unsafe) return;
        addTypeImports(this.file, typeMapping.imports, this.selfNames);

        const tsTypeName = typeMapping.ts;
        const singularName = fieldName.endsWith("s") ? fieldName.slice(0, -1) : fieldName;
        const capitalizedSingular = singularName.charAt(0).toUpperCase() + singularName.slice(1);
        const getterName = `get${capitalizedSingular}`;
        const setterName = `set${capitalizedSingular}`;

        const isReadable = field.readable !== false && !methodNames.has(getterName);
        const isWritable = field.writable !== false && !methodNames.has(setterName);

        const lengthFieldIndex = field.type.sizeParamIndex;
        if (lengthFieldIndex === undefined) return;

        const publicFields = allFields.filter((f) => !f.private);
        const lengthField = publicFields[lengthFieldIndex];
        if (!lengthField) return;

        const lengthFieldName = toValidMemberName(toCamelCase(lengthField.name));

        const nestedLayout = this.fieldBuilder.getNestedStructLayout(elementTypeName);
        if (!nestedLayout) return;

        const writableNestedFields = nestedLayout.filter(
            (item) =>
                this.fieldBuilder.isGeneratableFieldType(String(item.field.type.name)) &&
                this.fieldBuilder.isWritableType(item.field.type),
        );
        if (writableNestedFields.length === 0) return;

        const structTypeExpr = `t.struct("${elementTypeName}", "full", this.${lengthFieldName} * ${elementSize})`;

        if (isReadable) {
            this.file.addImport("../../native.js", ["read", "t"]);
            this.file.addImport("../../object.js", ["NativeHandle"]);
            const doc = buildJsDocStructure(field.doc, this.options.namespace);

            cls.addMethod(
                method(getterName, {
                    params: [param("index", "number")],
                    returnType: tsTypeName,
                    doc: doc?.[0]?.description,
                    body: (writer) => {
                        writer.writeLine(
                            `const array = read(this.handle, ${structTypeExpr}, ${ptrOffset}) as NativeHandle;`,
                        );
                        writer.writeLine(`const base = index * ${elementSize};`);
                        writer.writeLine(`return new ${tsTypeName}({`);
                        writer.withIndent(() => {
                            for (const nestedItem of writableNestedFields) {
                                const nestedField = nestedItem.field;
                                const nestedFieldName = toValidMemberName(toCamelCase(nestedField.name));
                                const nestedTypeMapping = this.ffiMapper.mapType(
                                    nestedField.type,
                                    false,
                                    nestedField.type.transferOwnership,
                                );

                                writer.write(`${nestedFieldName}: read(array, `);
                                writeFfiTypeExpression(writer, nestedTypeMapping.ffi);
                                writer.writeLine(`, base + ${nestedItem.offset}) as ${nestedTypeMapping.ts},`);
                            }
                        });
                        writer.writeLine("});");
                    },
                }),
            );
        }

        if (isWritable) {
            this.file.addImport("../../native.js", ["read", "t", "write"]);
            this.file.addImport("../../object.js", ["NativeHandle"]);

            cls.addMethod(
                method(setterName, {
                    params: [param("index", "number"), param("value", tsTypeName)],
                    body: (writer) => {
                        writer.writeLine(
                            `const array = read(this.handle, ${structTypeExpr}, ${ptrOffset}) as NativeHandle;`,
                        );
                        writer.writeLine(`const base = index * ${elementSize};`);
                        for (const nestedItem of writableNestedFields) {
                            const nestedField = nestedItem.field;
                            const nestedFieldName = toValidMemberName(toCamelCase(nestedField.name));
                            const nestedTypeMapping = this.ffiMapper.mapType(
                                nestedField.type,
                                false,
                                nestedField.type.transferOwnership,
                            );

                            writer.write(`write(array, `);
                            writeFfiTypeExpression(writer, nestedTypeMapping.ffi);
                            writer.writeLine(`, base + ${nestedItem.offset}, value.${nestedFieldName});`);
                        }
                        writer.writeLine(`write(this.handle, ${structTypeExpr}, ${ptrOffset}, array);`);
                    },
                }),
            );
        }
    }
}
