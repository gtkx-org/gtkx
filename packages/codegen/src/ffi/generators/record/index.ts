/**
 * Record Generator (ts-morph)
 *
 * Generates record (struct/boxed type) classes using ts-morph AST.
 * Orchestrates sub-builders for different aspects of record generation.
 */

import type { GirConstructor, GirField, GirFunction, GirMethod, GirRecord } from "@gtkx/gir";
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
 * const generator = new RecordGenerator(ffiMapper, ctx, builders, options);
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
    ) {
        this.fieldBuilder = new FieldBuilder(ffiMapper, ctx, writers);
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

        methodStructures.push(...this.buildMethodStructures(record.methods, record.glibTypeName));

        if (methodStructures.length > 0) {
            classDecl.addMethods(methodStructures);
        }

        this.generateFields(record.fields, record.methods, classDecl);

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

        const initFields = this.fieldBuilder.getWritableFields(record.fields);
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
            const initFields = this.fieldBuilder.getWritableFields(record.fields);
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
                            writer.writeLine(`this.id = ${allocFn} as ObjectId;`);
                        },
                    });
                }
            } else {
                classDecl.addConstructor({
                    statements: ["super();", "this.id = null as unknown as ObjectId;"],
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
            writer.write("this.id = call(");
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
                    `{ type: "boxed", ownership: "none", innerType: "${glibTypeName}", lib: "${this.options.sharedLibrary}"${getTypeFnPart} }`,
                );
            });
            writer.writeLine(") as ObjectId;");
        };
    }

    private writeConstructorWithAlloc(allocFn: string, fields: readonly GirField[]): WriterFunction {
        return (writer) => {
            writer.writeLine("super();");
            writer.writeLine(`this.id = ${allocFn} as ObjectId;`);
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
                ownership: "none",
                innerType,
                lib: this.options.sharedLibrary,
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
    ): MethodDeclarationStructure[] {
        const supportedMethods = filterSupportedMethods(methods, (params) =>
            this.methodBody.hasUnsupportedCallbacks(params),
        );
        return supportedMethods.map((method) => this.buildMethodStructure(method, glibTypeName));
    }

    private buildMethodStructure(method: GirMethod, className: string | undefined): MethodDeclarationStructure {
        const methodName = toCamelCase(method.name);
        const selfTypeDescriptor = className ? boxedSelfType(className, this.options.sharedLibrary) : SELF_TYPE_GOBJECT;

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
    ): void {
        const layout = this.fieldBuilder.calculateLayout(fields);
        const methodNames = new Set(methods.map((m) => toCamelCase(m.name)));

        for (const { field, offset } of layout) {
            const isReadable = field.readable !== false;
            const isWritable = field.writable !== false;

            if (!isReadable && !isWritable) continue;

            let fieldName = toValidIdentifier(toCamelCase(field.name));
            if (methodNames.has(fieldName)) continue;
            if (fieldName === "id") fieldName = "id_";

            const typeMapping = this.ffiMapper.mapType(field.type, false, field.type.transferOwnership);
            this.ctx.addTypeImports(typeMapping.imports);

            if (isReadable) {
                this.ctx.usesRead = true;
                classDecl.addGetAccessor({
                    name: fieldName,
                    returnType: typeMapping.ts,
                    docs: buildJsDocStructure(field.doc, this.options.namespace),
                    statements: (writer) => {
                        writer.write("return read(this.id, ");
                        this.writers.ffiTypeWriter.toWriter(typeMapping.ffi)(writer);
                        writer.writeLine(`, ${offset}) as ${typeMapping.ts};`);
                    },
                });
            }

            if (isWritable && this.fieldBuilder.isWritableType(field.type)) {
                this.ctx.usesWrite = true;
                classDecl.addSetAccessor({
                    name: fieldName,
                    parameters: [{ name: "value", type: typeMapping.ts }],
                    docs: buildJsDocStructure(field.doc, this.options.namespace),
                    statements: (writer) => {
                        writer.write("write(this.id, ");
                        this.writers.ffiTypeWriter.toWriter(typeMapping.ffi)(writer);
                        writer.writeLine(`, ${offset}, value);`);
                    },
                });
            }
        }
    }
}
