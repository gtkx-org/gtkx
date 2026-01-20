/**
 * Record Generator (ts-morph)
 *
 * Generates record (struct/boxed type) classes using ts-morph AST.
 * Orchestrates sub-builders for different aspects of record generation.
 */

import type { GirConstructor, GirField, GirFunction, GirMethod, GirRecord, GirRepository } from "@gtkx/gir";
import {
    type ClassDeclaration,
    type MethodDeclarationStructure,
    type SourceFile,
    StructureKind,
    type WriterFunction,
} from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { boxedSelfType, type FfiTypeDescriptor, SELF_TYPE_GOBJECT } from "../../../core/type-system/ffi-types.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { filterSupportedFunctions, filterSupportedMethods } from "../../../core/utils/filtering.js";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "../../../core/utils/naming.js";
import { createMethodBodyWriter, type MethodBodyWriter, type Writers } from "../../../core/writers/index.js";
import { FieldBuilder } from "./field-builder.js";

/**
 * Generates record (struct/boxed type) classes using ts-morph AST.
 *
 * @example
 * ```typescript
 * const generator = new RecordGenerator(ffiMapper, ctx, builders, options, repo);
 * generator.generateToSourceFile(record, sourceFile);
 * ```
 */
export class RecordGenerator {
    private readonly fieldBuilder: FieldBuilder;
    private readonly methodBody: MethodBodyWriter;

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        private readonly writers: Writers,
        private readonly options: FfiGeneratorOptions,
        repo?: GirRepository,
    ) {
        this.fieldBuilder = new FieldBuilder(ffiMapper, ctx, writers, repo, options.namespace);
        this.methodBody = createMethodBodyWriter(ffiMapper, ctx, writers);
    }

    /**
     * Generates a record class into a ts-morph SourceFile.
     */
    generateToSourceFile(record: GirRecord, sourceFile: SourceFile): void {
        this.trackFeatureUsage(record);

        const recordName = normalizeClassName(record.name, this.options.namespace);

        this.generateInitInterface(record, recordName, sourceFile);

        const classDecl = this.generateClass(record, recordName, sourceFile);

        const methodStructures: MethodDeclarationStructure[] = [];

        this.generateConstructors(record, recordName, classDecl, methodStructures);

        methodStructures.push(...this.buildStaticFunctionStructures(record.staticFunctions, recordName, record.name));

        methodStructures.push(...this.buildMethodStructures(record.methods, record.glibTypeName, record.glibGetType));

        if (methodStructures.length > 0) {
            classDecl.addMethods(methodStructures);
        }

        const isBoxedType = !!record.glibTypeName;
        this.generateFields(record.fields, record.methods, classDecl, isBoxedType);

        if (record.glibTypeName) {
            this.ctx.usesRegisterNativeClass = true;
            sourceFile.addStatements(`\nregisterNativeClass(${recordName});`);
        }
    }

    private trackFeatureUsage(record: GirRecord): void {
        this.ctx.usesRef =
            record.methods.some((m) => this.methodBody.hasRefParameter(m.parameters)) ||
            record.constructors.some((c) => this.methodBody.hasRefParameter(c.parameters)) ||
            record.staticFunctions.some((f) => this.methodBody.hasRefParameter(f.parameters));
        this.ctx.usesCall =
            record.methods.length > 0 || record.constructors.length > 0 || record.staticFunctions.length > 0;

        const hasReadableFields = record.fields.some((f) => f.readable !== false && !f.private);
        if (hasReadableFields) {
            this.ctx.usesRead = true;
        }
    }

    private generateInitInterface(record: GirRecord, recordName: string, sourceFile: SourceFile): void {
        const { main: mainConstructor } = this.methodBody.selectConstructors(record.constructors);

        if (mainConstructor) return;

        const initFields = this.fieldBuilder.getInitializableFields(record.fields);
        if (initFields.length === 0) return;

        const properties = initFields.map((field) => {
            let fieldName = toValidIdentifier(toCamelCase(field.name));
            if (fieldName === "id") fieldName = "id_";
            const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
            this.ctx.addTypeImports(typeMapping.imports);
            return {
                name: fieldName,
                type: typeMapping.ts,
                hasQuestionToken: true,
            };
        });

        const propStrings = properties.map((p) => {
            const questionMark = p.hasQuestionToken ? "?" : "";
            return `${p.name}${questionMark}: ${p.type}`;
        });

        sourceFile.addTypeAlias({
            name: `${recordName}Init`,
            isExported: true,
            type: `{ ${propStrings.join("; ")} }`,
        });
    }

    private generateClass(record: GirRecord, recordName: string, sourceFile: SourceFile): ClassDeclaration {
        this.ctx.usesNativeObject = true;

        const classDecl = sourceFile.addClass({
            name: recordName,
            isExported: true,
            extends: "NativeObject",
            docs: buildJsDocStructure(record.doc, this.options.namespace),
        });

        if (record.glibTypeName) {
            classDecl.addProperty({
                name: "glibTypeName",
                isStatic: true,
                isReadonly: true,
                type: "string",
                initializer: `"${record.glibTypeName}"`,
            });

            const objectType = record.isFundamental() ? "fundamental" : "boxed";
            classDecl.addProperty({
                name: "objectType",
                isStatic: true,
                isReadonly: true,
                initializer: `"${objectType}" as const`,
            });
        } else {
            classDecl.addProperty({
                name: "objectType",
                isStatic: true,
                isReadonly: true,
                initializer: `"struct" as const`,
            });
        }

        return classDecl;
    }

    private generateConstructors(
        record: GirRecord,
        recordName: string,
        classDecl: ClassDeclaration,
        methodStructures: MethodDeclarationStructure[],
    ): void {
        const { supported: supportedConstructors, main: mainConstructor } = this.methodBody.selectConstructors(
            record.constructors,
        );

        if (mainConstructor) {
            const filteredParams = this.methodBody.filterParameters(mainConstructor.parameters);
            const args = this.methodBody.buildCallArgumentsArray(mainConstructor.parameters);
            const glibTypeName = record.glibTypeName ?? record.cType;
            const glibGetType = record.glibGetType;

            if (filteredParams.length === 0) {
                classDecl.addConstructor({
                    docs: buildJsDocStructure(mainConstructor.doc, this.options.namespace),
                    statements: this.writeConstructorWithCall(mainConstructor, args, glibTypeName, glibGetType),
                });
            } else {
                const params = this.methodBody.buildParameterList(mainConstructor.parameters);
                classDecl.addConstructor({
                    docs: buildJsDocStructure(mainConstructor.doc, this.options.namespace),
                    parameters: params,
                    statements: this.writeConstructorWithCall(mainConstructor, args, glibTypeName, glibGetType),
                });
            }

            for (const ctor of supportedConstructors) {
                if (ctor !== mainConstructor) {
                    methodStructures.push(
                        this.buildStaticFactoryMethodStructure(
                            ctor,
                            recordName,
                            record.glibTypeName,
                            record.glibGetType,
                        ),
                    );
                }
            }
        } else {
            const initFields = this.fieldBuilder.getInitializableFields(record.fields);
            if (record.fields.length > 0) {
                const structSize = this.fieldBuilder.calculateStructSize(record.fields);
                this.ctx.usesAlloc = true;

                const allocFn = record.glibTypeName
                    ? `alloc(${structSize}, "${record.glibTypeName}", "${this.options.sharedLibrary}")`
                    : `alloc(${structSize})`;

                if (initFields.length > 0) {
                    this.ctx.usesWrite = true;
                    classDecl.addConstructor({
                        parameters: [{ name: "init", type: `${recordName}Init`, initializer: "{}" }],
                        statements: this.writeConstructorWithAlloc(allocFn, record.fields),
                    });
                } else {
                    classDecl.addConstructor({
                        statements: (writer) => {
                            writer.writeLine("super();");
                            writer.writeLine(`this.handle = ${allocFn} as NativeHandle;`);
                        },
                    });
                }
            } else {
                classDecl.addConstructor({
                    statements: ["super();", "this.handle = null as unknown as NativeHandle;"],
                });
            }
        }
    }

    private writeConstructorWithCall(
        mainConstructor: GirConstructor,
        args: { type: FfiTypeDescriptor; value: string; optional?: boolean }[],
        glibTypeName: string | undefined,
        glibGetType: string | undefined,
    ): WriterFunction {
        return (writer) => {
            writer.writeLine("super();");
            writer.write("this.handle = call(");
            writer.newLine();
            writer.indent(() => {
                writer.writeLine(`"${this.options.sharedLibrary}",`);
                writer.writeLine(`"${mainConstructor.cIdentifier}",`);
                writer.writeLine("[");
                writer.indent(() => {
                    for (const arg of args) {
                        writer.write("{ type: ");
                        this.methodBody.getFfiTypeWriter().toWriter(arg.type)(writer);
                        writer.writeLine(`, value: ${arg.value}, optional: ${arg.optional ?? false} },`);
                    }
                });
                writer.writeLine("],");
                const getTypeFnPart = glibGetType ? `, getTypeFn: "${glibGetType}"` : "";
                writer.writeLine(
                    `{ type: "boxed", ownership: "borrowed", innerType: "${glibTypeName}", library: "${this.options.sharedLibrary}"${getTypeFnPart} }`,
                );
            });
            writer.writeLine(") as NativeHandle;");
        };
    }

    private writeConstructorWithAlloc(allocFn: string, fields: readonly GirField[]): WriterFunction {
        return (writer) => {
            writer.writeLine("super();");
            writer.writeLine(`this.handle = ${allocFn} as NativeHandle;`);
            this.fieldBuilder.writeFieldWrites(fields)(writer);
        };
    }

    private buildStaticFactoryMethodStructure(
        ctor: GirConstructor,
        recordName: string,
        glibTypeName?: string,
        glibGetType?: string,
    ): MethodDeclarationStructure {
        const methodName = toCamelCase(ctor.name);
        const params = this.methodBody.buildParameterList(ctor.parameters);
        this.ctx.usesGetNativeObject = true;

        return {
            kind: StructureKind.Method,
            name: methodName,
            isStatic: true,
            parameters: params,
            returnType: recordName,
            docs: buildJsDocStructure(ctor.doc, this.options.namespace),
            statements: this.writeStaticFactoryMethodBody(ctor, recordName, glibTypeName, glibGetType),
        };
    }

    private writeStaticFactoryMethodBody(
        ctor: GirConstructor,
        recordName: string,
        glibTypeName?: string,
        glibGetType?: string,
    ): WriterFunction {
        const args = this.methodBody.buildCallArgumentsArray(ctor.parameters);
        const innerType = glibTypeName ?? recordName;

        return this.methodBody.writeFactoryMethodBody({
            sharedLibrary: this.options.sharedLibrary,
            cIdentifier: ctor.cIdentifier,
            args,
            returnTypeDescriptor: {
                type: "boxed",
                ownership: "borrowed",
                innerType,
                library: this.options.sharedLibrary,
                ...(glibGetType && { getTypeFn: glibGetType }),
            },
            wrapClassName: recordName,
            throws: ctor.throws,
            useClassInWrap: true,
        });
    }

    private buildStaticFunctionStructures(
        functions: readonly GirFunction[],
        recordName: string,
        originalName: string,
    ): MethodDeclarationStructure[] {
        const supportedFunctions = filterSupportedFunctions(functions, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );
        return supportedFunctions.map((func) => this.buildStaticFunctionStructure(func, recordName, originalName));
    }

    private buildStaticFunctionStructure(
        func: GirFunction,
        className: string,
        originalClassName: string,
    ): MethodDeclarationStructure {
        return this.methodBody.buildStaticFunctionStructure(func, {
            className,
            originalClassName,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
        });
    }

    private buildMethodStructures(
        methods: readonly GirMethod[],
        glibTypeName: string | undefined,
        glibGetType: string | undefined,
    ): MethodDeclarationStructure[] {
        const supportedMethods = filterSupportedMethods(methods, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );
        return supportedMethods.map((method) => this.buildMethodStructure(method, glibTypeName, glibGetType));
    }

    private buildMethodStructure(
        method: GirMethod,
        className: string | undefined,
        glibGetType: string | undefined,
    ): MethodDeclarationStructure {
        const methodName = toCamelCase(method.name);
        const instanceOwnership = method.instanceParameter?.transferOwnership === "full" ? "full" : "borrowed";
        const selfTypeDescriptor = className
            ? boxedSelfType(className, this.options.sharedLibrary, glibGetType, instanceOwnership)
            : SELF_TYPE_GOBJECT;

        return this.methodBody.buildMethodStructure(method, {
            methodName,
            selfTypeDescriptor,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
            className,
        });
    }

    private generateFields(
        fields: readonly GirField[],
        methods: readonly GirMethod[],
        classDecl: ClassDeclaration,
        isBoxedType: boolean,
    ): void {
        const layout = this.fieldBuilder.calculateLayout(fields);
        const methodNames = new Set(methods.map((m) => toCamelCase(m.name)));

        for (let idx = 0; idx < layout.length; idx++) {
            const layoutItem = layout[idx];
            if (!layoutItem) continue;
            const { field, offset } = layoutItem;

            let fieldName = toValidIdentifier(toCamelCase(field.name));
            if (fieldName === "id") fieldName = "id_";

            const capitalizedFieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
            const getterName = `get${capitalizedFieldName}`;
            const setterName = `set${capitalizedFieldName}`;
            const isReadable = field.readable !== false && !methodNames.has(getterName);
            const isWritable = field.writable !== false && isBoxedType && !methodNames.has(setterName);

            if (field.type.isArray && field.type.elementType) {
                const elementTypeName = String(field.type.elementType.name);
                if (this.fieldBuilder.isNestedStructType(elementTypeName)) {
                    this.generateArrayFieldAccessor(field, fieldName, offset, classDecl, isBoxedType, methodNames);
                    continue;
                }
            }

            const typeName = String(field.type.name);
            if (!this.fieldBuilder.isGeneratableFieldType(typeName)) continue;

            const isInlineNestedStruct = this.fieldBuilder.isInlineNestedStruct(field);

            if (isInlineNestedStruct) {
                this.generateNestedStructAccessors(field, fieldName, offset, classDecl, isBoxedType, methodNames);
            } else if (!this.fieldBuilder.isNestedStructType(typeName)) {
                const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
                this.ctx.addTypeImports(typeMapping.imports);

                if (isReadable) {
                    this.ctx.usesRead = true;
                    classDecl.addMethod({
                        name: getterName,
                        returnType: typeMapping.ts,
                        docs: buildJsDocStructure(field.doc, this.options.namespace),
                        statements: (writer) => {
                            writer.write("return read(this.handle, ");
                            this.writers.ffiTypeWriter.toWriter(typeMapping.ffi)(writer);
                            writer.writeLine(`, ${offset}) as ${typeMapping.ts};`);
                        },
                    });
                }

                if (isWritable) {
                    this.ctx.usesWrite = true;
                    classDecl.addMethod({
                        name: setterName,
                        parameters: [{ name: "value", type: typeMapping.ts }],
                        statements: (writer) => {
                            writer.write("write(this.handle, ");
                            this.writers.ffiTypeWriter.toWriter(typeMapping.ffi)(writer);
                            writer.writeLine(`, ${offset}, value);`);
                        },
                    });
                }
            }
        }
    }

    private generateArrayFieldAccessor(
        field: GirField,
        fieldName: string,
        ptrOffset: number,
        classDecl: ClassDeclaration,
        isBoxedType: boolean,
        methodNames: Set<string>,
    ): void {
        const elementType = field.type.elementType;
        if (!elementType) return;

        const elementTypeName = String(elementType.name);
        const elementSize = this.fieldBuilder.getRecordSize(elementTypeName);
        if (elementSize === 0) return;

        const typeMapping = this.ffiMapper.mapType(elementType, false, elementType.transferOwnership);
        this.ctx.addTypeImports(typeMapping.imports);

        const tsTypeName = typeMapping.ts;
        const singularName = fieldName.endsWith("s") ? fieldName.slice(0, -1) : fieldName;
        const capitalizedSingular = singularName.charAt(0).toUpperCase() + singularName.slice(1);
        const getterName = `get${capitalizedSingular}`;
        const setterName = `set${capitalizedSingular}`;

        const isReadable = field.readable !== false && !methodNames.has(getterName);
        const isWritable = field.writable !== false && isBoxedType && !methodNames.has(setterName);

        if (isReadable) {
            this.ctx.usesReadPointer = true;
            this.ctx.usesNativeHandle = true;
            this.ctx.usesRead = true;

            classDecl.addMethod({
                name: `get${capitalizedSingular}`,
                parameters: [{ name: "index", type: "number" }],
                returnType: tsTypeName,
                docs: buildJsDocStructure(field.doc, this.options.namespace),
                statements: (writer) => {
                    writer.writeLine(`const elementOffset = index * ${elementSize};`);
                    writer.writeLine(
                        `const handle = readPointer(this.handle, ${ptrOffset}, elementOffset) as NativeHandle;`,
                    );
                    this.writeDeepCopyConstruction(writer, "handle", elementTypeName, tsTypeName, 0);
                },
            });
        }

        if (isWritable) {
            this.ctx.usesWritePointer = true;

            classDecl.addMethod({
                name: `set${capitalizedSingular}`,
                parameters: [
                    { name: "index", type: "number" },
                    { name: "value", type: tsTypeName },
                ],
                statements: (writer) => {
                    writer.writeLine(`const elementOffset = index * ${elementSize};`);
                    writer.writeLine(
                        `writePointer(this.handle, ${ptrOffset}, elementOffset, value.handle, ${elementSize});`,
                    );
                },
            });
        }
    }

    private generateNestedStructAccessors(
        field: GirField,
        fieldName: string,
        baseOffset: number,
        classDecl: ClassDeclaration,
        isBoxedType: boolean,
        methodNames: Set<string>,
    ): void {
        const typeName = String(field.type.name);
        const nestedLayout = this.fieldBuilder.getNestedStructLayout(typeName);
        if (!nestedLayout) return;

        const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
        this.ctx.addTypeImports(typeMapping.imports);

        const tsTypeName = typeMapping.ts;
        const capitalizedFieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        const getterName = `get${capitalizedFieldName}`;
        const setterName = `set${capitalizedFieldName}`;
        const isReadable = field.readable !== false && !methodNames.has(getterName);
        const isWritable = field.writable !== false && isBoxedType && !methodNames.has(setterName);

        const writableFields = nestedLayout.filter(
            (item) =>
                this.fieldBuilder.isGeneratableFieldType(String(item.field.type.name)) &&
                this.fieldBuilder.isWritableType(item.field.type),
        );

        if (isReadable) {
            this.ctx.usesRead = true;
            classDecl.addMethod({
                name: getterName,
                returnType: tsTypeName,
                docs: buildJsDocStructure(field.doc, this.options.namespace),
                statements: (writer) => {
                    writer.writeLine(`return new ${tsTypeName}({`);
                    writer.indent(() => {
                        for (const nestedItem of writableFields) {
                            const nestedField = nestedItem.field;
                            const nestedOffset = baseOffset + nestedItem.offset;
                            const nestedFieldName = toValidIdentifier(toCamelCase(nestedField.name));
                            const nestedTypeMapping = this.ffiMapper.mapType(
                                nestedField.type,
                                false,
                                nestedField.type.transferOwnership,
                            );

                            writer.write(`${nestedFieldName}: read(this.handle, `);
                            this.writers.ffiTypeWriter.toWriter(nestedTypeMapping.ffi)(writer);
                            writer.writeLine(`, ${nestedOffset}) as ${nestedTypeMapping.ts},`);
                        }
                    });
                    writer.writeLine(`});`);
                },
            });
        }

        if (isWritable && writableFields.length > 0) {
            this.ctx.usesWrite = true;
            classDecl.addMethod({
                name: setterName,
                parameters: [{ name: "value", type: tsTypeName }],
                statements: (writer) => {
                    for (const nestedItem of writableFields) {
                        const nestedField = nestedItem.field;
                        const nestedOffset = baseOffset + nestedItem.offset;
                        const nestedFieldName = toValidIdentifier(toCamelCase(nestedField.name));
                        const capitalizedNestedFieldName =
                            nestedFieldName.charAt(0).toUpperCase() + nestedFieldName.slice(1);
                        const nestedTypeMapping = this.ffiMapper.mapType(
                            nestedField.type,
                            false,
                            nestedField.type.transferOwnership,
                        );

                        writer.write(`write(this.handle, `);
                        this.writers.ffiTypeWriter.toWriter(nestedTypeMapping.ffi)(writer);
                        writer.writeLine(`, ${nestedOffset}, value.get${capitalizedNestedFieldName}());`);
                    }
                },
            });
        }
    }

    private writeDeepCopyConstruction(
        writer: import("ts-morph").CodeBlockWriter,
        handleExpr: string,
        typeName: string,
        tsTypeName: string,
        baseOffset: number,
    ): void {
        const layout = this.fieldBuilder.getNestedStructLayout(typeName);
        if (!layout || layout.length === 0) {
            writer.writeLine(`return new ${tsTypeName}({});`);
            return;
        }

        writer.writeLine(`return new ${tsTypeName}({`);
        writer.indent(() => {
            for (const item of layout) {
                const field = item.field;
                const offset = baseOffset + item.offset;
                let fieldName = toValidIdentifier(toCamelCase(field.name));
                if (fieldName === "id") fieldName = "id_";
                const fieldTypeName = String(field.type.name);

                if (this.fieldBuilder.isWritableType(field.type)) {
                    const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
                    writer.write(`${fieldName}: read(${handleExpr}, `);
                    this.writers.ffiTypeWriter.toWriter(typeMapping.ffi)(writer);
                    writer.writeLine(`, ${offset}) as ${typeMapping.ts},`);
                } else if (this.fieldBuilder.isInlineNestedStruct(field)) {
                    const nestedTypeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
                    this.ctx.addTypeImports(nestedTypeMapping.imports);
                    this.writeNestedStructConstruction(
                        writer,
                        handleExpr,
                        fieldName,
                        fieldTypeName,
                        nestedTypeMapping.ts,
                        offset,
                    );
                }
            }
        });
        writer.writeLine(`});`);
    }

    private writeNestedStructConstruction(
        writer: import("ts-morph").CodeBlockWriter,
        handleExpr: string,
        fieldName: string,
        typeName: string,
        tsTypeName: string,
        baseOffset: number,
    ): void {
        const nestedLayout = this.fieldBuilder.getNestedStructLayout(typeName);
        if (!nestedLayout || nestedLayout.length === 0) {
            writer.writeLine(`${fieldName}: new ${tsTypeName}({}),`);
            return;
        }

        writer.writeLine(`${fieldName}: new ${tsTypeName}({`);
        writer.indent(() => {
            for (const nestedItem of nestedLayout) {
                const nestedField = nestedItem.field;
                const nestedOffset = baseOffset + nestedItem.offset;
                let nestedFieldName = toValidIdentifier(toCamelCase(nestedField.name));
                if (nestedFieldName === "id") nestedFieldName = "id_";
                const nestedFieldTypeName = String(nestedField.type.name);

                if (this.fieldBuilder.isWritableType(nestedField.type)) {
                    const nestedTypeMapping = this.ffiMapper.mapType(
                        nestedField.type,
                        false,
                        nestedField.type.transferOwnership,
                    );
                    writer.write(`${nestedFieldName}: read(${handleExpr}, `);
                    this.writers.ffiTypeWriter.toWriter(nestedTypeMapping.ffi)(writer);
                    writer.writeLine(`, ${nestedOffset}) as ${nestedTypeMapping.ts},`);
                } else if (this.fieldBuilder.isInlineNestedStruct(nestedField)) {
                    const nestedNestedTypeMapping = this.ffiMapper.mapType(
                        nestedField.type,
                        false,
                        nestedField.type.transferOwnership,
                    );
                    this.ctx.addTypeImports(nestedNestedTypeMapping.imports);
                    this.writeNestedStructConstruction(
                        writer,
                        handleExpr,
                        nestedFieldName,
                        nestedFieldTypeName,
                        nestedNestedTypeMapping.ts,
                        nestedOffset,
                    );
                }
            }
        });
        writer.writeLine(`}),`);
    }
}
