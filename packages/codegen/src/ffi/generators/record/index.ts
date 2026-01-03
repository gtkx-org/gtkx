/**
 * Record Generator (ts-morph)
 *
 * Generates record (struct/boxed type) classes using ts-morph AST.
 * Orchestrates sub-builders for different aspects of record generation.
 */

import type {
    GirConstructor,
    GirField,
    GirFunction,
    GirMethod,
    GirParameter,
    GirRecord,
} from "@gtkx/gir";
import {
    type ClassDeclaration,
    type MethodDeclarationStructure,
    Scope,
    type SourceFile,
    StructureKind,
    type WriterFunction,
} from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import { boxedSelfType, SELF_TYPE_GOBJECT } from "../../../core/type-system/ffi-types.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { filterSupportedFunctions, filterSupportedMethods } from "../../../core/utils/filtering.js";
import { normalizeClassName, toCamelCase, toValidIdentifier } from "../../../core/utils/naming.js";
import { buildFromPtrStatements } from "../../../core/utils/structure-helpers.js";
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

        methodStructures.push(this.buildFromPtrStructure(recordName));

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

        sourceFile.addInterface({
            name: `${recordName}Init`,
            isExported: true,
            properties,
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

            const objectType = record.glibTypeName === "GVariant" ? "gvariant" : "boxed";
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

            if (filteredParams.length === 0) {
                classDecl.addConstructor({
                    docs: buildJsDocStructure(mainConstructor.doc, this.options.namespace),
                    statements: ["super();", "this.id = this.createPtr([]);"],
                });
            } else {
                const params = this.methodBody.buildParameterList(mainConstructor.parameters);
                const paramNames = filteredParams.map((p) => toValidIdentifier(toCamelCase(p.name)));
                const mapped = this.ffiMapper.mapParameter(filteredParams[0] as GirParameter);
                this.ctx.addTypeImports(mapped.imports);
                if (mapped.ffi.type === "ref") {
                    this.ctx.usesRef = true;
                }
                const firstParamType = mapped.ts;
                const isFirstParamArray = firstParamType.endsWith("[]") || firstParamType.startsWith("Array<");

                if (isFirstParamArray) {
                    classDecl.addConstructor({
                        docs: buildJsDocStructure(mainConstructor.doc, this.options.namespace),
                        parameters: params,
                        statements: [
                            "super();",
                            `const _args = [${paramNames.join(", ")}];`,
                            "this.id = this.createPtr(_args);",
                        ],
                    });
                } else {
                    classDecl.addConstructor({
                        overloads: [{ parameters: params }, { parameters: [{ name: "_args", type: "unknown[]" }] }],
                        parameters: [{ name: "args", type: "unknown[]", isRestParameter: true }],
                        statements: [
                            "super();",
                            "const _args = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;",
                            "this.id = this.createPtr(_args);",
                        ],
                    });
                }
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
            if (initFields.length > 0) {
                classDecl.addConstructor({
                    parameters: [{ name: "init", type: `${recordName}Init`, initializer: "{}" }],
                    statements: ["super();", "this.id = this.createPtr(init);"],
                });
            } else {
                classDecl.addConstructor({
                    statements: ["super();", "this.id = this.createPtr({});"],
                });
            }
        }

        methodStructures.push(this.buildCreatePtrStructure(record, recordName));
    }

    private buildCreatePtrStructure(record: GirRecord, recordName: string): MethodDeclarationStructure {
        const { main: mainConstructor } = this.methodBody.selectConstructors(record.constructors);

        if (!mainConstructor) {
            if (record.fields.length > 0) {
                const structSize = this.fieldBuilder.calculateStructSize(record.fields);
                const initFields = this.fieldBuilder.getWritableFields(record.fields);
                this.ctx.usesAlloc = true;

                const allocFn = record.glibTypeName
                    ? `alloc(${structSize}, "${record.glibTypeName}", "${this.options.sharedLibrary}")`
                    : `alloc(${structSize})`;

                if (initFields.length > 0) {
                    this.ctx.usesWrite = true;
                    return {
                        kind: StructureKind.Method,
                        name: "createPtr",
                        scope: Scope.Protected,
                        parameters: [{ name: "init", type: `${recordName}Init` }],
                        returnType: "ObjectId",
                        statements: this.writeCreatePtrWithFieldsBody(allocFn, record.fields),
                    };
                }
                return {
                    kind: StructureKind.Method,
                    name: "createPtr",
                    scope: Scope.Protected,
                    parameters: [{ name: "_init", type: "Record<string, unknown>" }],
                    returnType: "ObjectId",
                    statements: (writer) => {
                        writer.writeLine(`return ${allocFn} as ObjectId;`);
                    },
                };
            }
            return {
                kind: StructureKind.Method,
                name: "createPtr",
                scope: Scope.Protected,
                parameters: [{ name: "_init", type: "Record<string, unknown>" }],
                returnType: "ObjectId",
                statements: (writer) => {
                    writer.writeLine("return null as unknown as ObjectId;");
                },
            };
        }

        return {
            kind: StructureKind.Method,
            name: "createPtr",
            scope: Scope.Protected,
            parameters: [{ name: "_args", type: "unknown[]" }],
            returnType: "ObjectId",
            statements: this.writeCreatePtrWithConstructorBody(mainConstructor, record),
        };
    }

    private writeCreatePtrWithFieldsBody(allocFn: string, fields: readonly GirField[]): WriterFunction {
        return (writer) => {
            writer.writeLine(`const ptr = ${allocFn};`);
            this.fieldBuilder.writeFieldWrites(fields)(writer);
            writer.writeLine("return ptr as ObjectId;");
        };
    }

    private writeCreatePtrWithConstructorBody(
        mainConstructor: GirConstructor,
        record: GirRecord,
    ): WriterFunction {
        const filteredParams = this.methodBody.filterParameters(mainConstructor.parameters);
        const paramTypes = filteredParams.map((p) => {
            const mapped = this.ffiMapper.mapParameter(p);
            this.ctx.addTypeImports(mapped.imports);
            if (mapped.ffi.type === "ref") {
                this.ctx.usesRef = true;
            }
            return mapped.ts;
        });
        const paramNames = filteredParams.map((p) => toValidIdentifier(toCamelCase(p.name)));
        const args = this.methodBody.buildCallArgumentsArray(mainConstructor.parameters);
        const glibTypeName = record.glibTypeName ?? record.cType;
        const glibGetType = record.glibGetType;

        return (writer) => {
            if (paramNames.length > 0) {
                writer.writeLine(`const [${paramNames.join(", ")}] = _args as [${paramTypes.join(", ")}];`);
            }

            writer.write("return call(");
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

    private buildFromPtrStructure(recordName: string): MethodDeclarationStructure {
        return {
            kind: StructureKind.Method,
            name: "fromPtr",
            isStatic: true,
            parameters: [{ name: "ptr", type: "ObjectId" }],
            returnType: recordName,
            statements: buildFromPtrStatements(recordName),
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
