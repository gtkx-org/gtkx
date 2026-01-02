/**
 * Method Builder
 *
 * Builds instance method code for classes using ts-morph AST.
 */

import type { NormalizedConstructor, NormalizedMethod, NormalizedParameter } from "@gtkx/gir";
import type { MethodDeclarationStructure, WriterFunction } from "ts-morph";
import { StructureKind } from "ts-morph";
import type { GenerationContext } from "../../../core/generation-context.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import {
    type MappedType,
    SELF_TYPE_GOBJECT,
    SELF_TYPE_GPARAM,
    type SelfTypeDescriptor,
} from "../../../core/type-system/ffi-types.js";
import { type AsyncMethodAnalysis, analyzeAsyncMethods } from "../../../core/utils/async-analysis.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { isMethodDuplicate } from "../../../core/utils/filtering.js";
import { toCamelCase } from "../../../core/utils/naming.js";
import { formatNullableReturn } from "../../../core/utils/type-qualification.js";
import type { Writers } from "../../../core/writers/index.js";
import { type ConstructorSelection, MethodBodyWriter } from "../../../core/writers/method-body-writer.js";

/**
 * Builds method code for a class.
 */
export class MethodBuilder {
    private readonly methodBody: MethodBodyWriter;

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly ctx: GenerationContext,
        writers: Writers,
        private readonly options: FfiGeneratorOptions,
    ) {
        this.methodBody = new MethodBodyWriter(ffiMapper, ctx, writers.ffiTypeWriter);
    }

    /**
     * Builds method structures for all methods.
     * Returns structures for batch adding by ClassGenerator.
     *
     * @param methods - The methods to build structures for
     * @param isParamSpec - Whether this is a GParamSpec class
     * @param asyncAnalysis - Pre-computed async analysis (optional, computed if not provided)
     * @returns Array of method declaration structures
     *
     * @example
     * ```typescript
     * const builder = new MethodBuilder(ffiMapper, ctx, builders, options);
     * const structures = builder.buildStructures(cls.methods, false);
     * classDecl.addMethods(structures);
     * ```
     */
    buildStructures(
        methods: readonly NormalizedMethod[],
        isParamSpec: boolean,
        asyncAnalysis?: AsyncMethodAnalysis,
    ): MethodDeclarationStructure[] {
        const seen = new Set<string>();
        const { asyncMethods, finishMethods, asyncPairs } = asyncAnalysis ?? analyzeAsyncMethods(methods);
        const methodStructures: MethodDeclarationStructure[] = [];

        for (const method of methods) {
            if (isMethodDuplicate(method.name, method.cIdentifier, seen)) continue;
            if (this.methodBody.hasUnsupportedCallbacks(method.parameters)) continue;
            if (asyncMethods.has(method.name)) continue;
            if (finishMethods.has(method.name)) continue;

            const structure = this.buildMethodStructure(method, isParamSpec);
            if (structure) {
                methodStructures.push(structure);
            }
        }

        for (const [asyncMethodName, finishMethodName] of asyncPairs) {
            const asyncMethod = methods.find((m) => m.name === asyncMethodName);
            const finishMethod = methods.find((m) => m.name === finishMethodName);

            if (asyncMethod && finishMethod) {
                const structure = this.buildAsyncWrapperStructure(asyncMethod, finishMethod, isParamSpec);
                if (structure) {
                    methodStructures.push(structure);
                }
            }
        }

        return methodStructures;
    }

    private buildMethodStructure(method: NormalizedMethod, isParamSpec: boolean): MethodDeclarationStructure {
        const dynamicRename = this.ctx.methodRenames.get(method.cIdentifier);
        const camelName = toCamelCase(method.name);
        const methodName = dynamicRename ?? camelName;

        const selfTypeDescriptor = isParamSpec ? SELF_TYPE_GPARAM : SELF_TYPE_GOBJECT;

        return this.methodBody.buildMethodStructure(method, {
            methodName,
            selfTypeDescriptor,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
        });
    }

    /**
     * Checks if a parameter list has ref parameters.
     * Delegates to MethodBodyWriter.
     */
    hasRefParameter(parameters: readonly NormalizedParameter[]): boolean {
        return this.methodBody.hasRefParameter(parameters);
    }

    /**
     * Checks if a parameter list has unsupported callbacks.
     * Delegates to MethodBodyWriter.
     */
    hasUnsupportedCallbacks(parameters: readonly NormalizedParameter[]): boolean {
        return this.methodBody.hasUnsupportedCallbacks(parameters);
    }

    /**
     * Selects supported constructors and identifies the main constructor.
     * Delegates to MethodBodyWriter.
     */
    selectConstructors(constructors: readonly NormalizedConstructor[]): ConstructorSelection {
        return this.methodBody.selectConstructors(constructors);
    }

    /**
     * Builds a Promise-based async wrapper method structure.
     * Combines an async method and its _finish counterpart into a single Promise method.
     */
    private buildAsyncWrapperStructure(
        asyncMethod: NormalizedMethod,
        finishMethod: NormalizedMethod,
        isParamSpec: boolean,
    ): MethodDeclarationStructure {
        const baseName = asyncMethod.name.replace(/_async$/, "");
        const methodName = `${toCamelCase(baseName)}Async`;

        const asyncParams = this.filterAsyncParameters(asyncMethod.parameters);
        const params = this.methodBody.buildParameterList(asyncParams);

        const returnTypeMapping = this.ffiMapper.mapType(finishMethod.returnType, true);
        this.ctx.addTypeImports(returnTypeMapping.imports);

        const innerReturnType = formatNullableReturn(returnTypeMapping.ts, finishMethod.returnType.nullable === true);
        const promiseReturnType = `Promise<${innerReturnType}>`;

        const selfTypeDescriptor = isParamSpec ? SELF_TYPE_GPARAM : SELF_TYPE_GOBJECT;

        return {
            kind: StructureKind.Method,
            name: methodName,
            parameters: params,
            returnType: promiseReturnType,
            docs: buildJsDocStructure(asyncMethod.doc, this.options.namespace),
            statements: this.writeAsyncWrapperBody(
                asyncMethod,
                finishMethod,
                asyncParams,
                returnTypeMapping,
                selfTypeDescriptor,
            ),
        };
    }

    /**
     * Filters parameters for async wrapper.
     * Uses GIR callback metadata instead of name suffix heuristics.
     * Excludes:
     * - Varargs
     * - All callback types (GIR-defined callbacks, including AsyncReadyCallback)
     * - All closure targets (user_data for any callback)
     * - All destroy notifies (for any callback)
     */
    private filterAsyncParameters(parameters: readonly NormalizedParameter[]): NormalizedParameter[] {
        return parameters.filter((p, index) => {
            if (p.name === "..." || p.name === "") return false;

            const typeName = typeof p.type.name === "string" ? p.type.name : String(p.type.name);
            if (this.ffiMapper.isCallback(typeName)) {
                return false;
            }

            const isClosureOrDestroy = parameters.some((other) => {
                const otherTypeName = typeof other.type.name === "string" ? other.type.name : String(other.type.name);
                if (!this.ffiMapper.isCallback(otherTypeName)) return false;
                return other.closure === index || other.destroy === index;
            });
            if (isClosureOrDestroy) return false;

            if (p.name === "user_data") return false;

            return true;
        });
    }

    /**
     * Writes the async wrapper method body using ts-morph WriterFunction.
     */
    private writeAsyncWrapperBody(
        asyncMethod: NormalizedMethod,
        finishMethod: NormalizedMethod,
        asyncParams: readonly NormalizedParameter[],
        returnTypeMapping: MappedType,
        selfTypeDescriptor: SelfTypeDescriptor,
    ): WriterFunction {
        this.ctx.usesCall = true;

        const hasReturnValue = returnTypeMapping.ts !== "void";
        const wrapInfo = this.methodBody.needsObjectWrap(returnTypeMapping);
        const isNullable = finishMethod.returnType.nullable === true;
        const baseReturnType = returnTypeMapping.ts;

        return (writer) => {
            const rejectParam = finishMethod.throws ? "reject" : "_reject";
            writer.writeLine(`return new Promise((resolve, ${rejectParam}) => {`);
            writer.indent(() => {
                writer.writeLine("call(");
                writer.indent(() => {
                    writer.writeLine(`"${this.options.sharedLibrary}",`);
                    writer.writeLine(`"${asyncMethod.cIdentifier}",`);
                    writer.writeLine("[");
                    writer.indent(() => {
                        writer.write("{ type: ");
                        this.methodBody.getFfiTypeWriter().toWriter(selfTypeDescriptor)(writer);
                        writer.writeLine(", value: this.id },");

                        for (const param of asyncParams) {
                            const mapped = this.ffiMapper.mapParameter(param);
                            const jsParamName = this.methodBody.toJsParamName(param);
                            const isOptional = this.ffiMapper.isNullable(param);
                            const valueName = this.methodBody.buildValueExpression(jsParamName, mapped);
                            writer.write("{ type: ");
                            this.methodBody.getFfiTypeWriter().toWriter(mapped.ffi)(writer);
                            writer.writeLine(`, value: ${valueName}, optional: ${isOptional} },`);
                        }

                        writer.writeLine("{");
                        writer.indent(() => {
                            writer.writeLine(
                                'type: { type: "callback", trampoline: "asyncReady", sourceType: { type: "gobject", ownership: "none" }, resultType: { type: "gobject", ownership: "none" } },',
                            );
                            writer.writeLine("value: (_source: unknown, result: unknown) => {");
                            writer.indent(() => {
                                if (finishMethod.throws) {
                                    writer.writeLine("const error = { value: null as unknown };");
                                }

                                if (hasReturnValue) {
                                    writer.write(wrapInfo.needsWrap ? "const ptr = call(" : "const value = call(");
                                } else {
                                    writer.write("call(");
                                }
                                writer.newLine();
                                writer.indent(() => {
                                    writer.writeLine(`"${this.options.sharedLibrary}",`);
                                    writer.writeLine(`"${finishMethod.cIdentifier}",`);
                                    writer.writeLine("[");
                                    writer.indent(() => {
                                        writer.write("{ type: ");
                                        this.methodBody.getFfiTypeWriter().toWriter(selfTypeDescriptor)(writer);
                                        writer.writeLine(", value: this.id },");
                                        writer.writeLine(
                                            '{ type: { type: "gobject", ownership: "none" }, value: result },',
                                        );
                                        if (finishMethod.throws) {
                                            writer.write("{ type: ");
                                            this.methodBody.getFfiTypeWriter().errorArgumentWriter()(writer);
                                            writer.writeLine(", value: error },");
                                        }
                                    });
                                    writer.writeLine("],");
                                    this.methodBody.getFfiTypeWriter().toWriter(returnTypeMapping.ffi)(writer);
                                    writer.newLine();
                                });

                                if (hasReturnValue) {
                                    if (wrapInfo.needsWrap) {
                                        writer.writeLine(");");
                                    } else {
                                        writer.writeLine(`) as ${baseReturnType};`);
                                    }
                                } else {
                                    writer.writeLine(");");
                                }

                                if (finishMethod.throws) {
                                    this.ctx.usesNativeError = true;
                                    writer.writeLine("if (error.value !== null) {");
                                    writer.indent(() => {
                                        writer.writeLine("reject(new NativeError(error.value));");
                                        writer.writeLine("return;");
                                    });
                                    writer.writeLine("}");
                                }

                                if (hasReturnValue) {
                                    if (wrapInfo.needsWrap) {
                                        if (isNullable) {
                                            writer.writeLine("if (ptr === null) {");
                                            writer.indent(() => {
                                                writer.writeLine("resolve(null);");
                                                writer.writeLine("return;");
                                            });
                                            writer.writeLine("}");
                                        }
                                        this.ctx.usesGetNativeObject = true;
                                        if (
                                            wrapInfo.needsBoxedWrap ||
                                            wrapInfo.needsGVariantWrap ||
                                            wrapInfo.needsInterfaceWrap
                                        ) {
                                            writer.writeLine(`resolve(getNativeObject(ptr, ${baseReturnType})!);`);
                                        } else {
                                            writer.writeLine(`resolve(getNativeObject(ptr) as ${baseReturnType});`);
                                        }
                                    } else {
                                        writer.writeLine("resolve(value);");
                                    }
                                } else {
                                    writer.writeLine("resolve();");
                                }
                            });
                            writer.writeLine("},");
                        });
                        writer.writeLine("},");

                        writer.writeLine('{ type: { type: "null" }, value: null },');
                    });
                    writer.writeLine("],");
                    writer.writeLine('{ type: "undefined" }');
                });
                writer.writeLine(");");
            });
            writer.writeLine("});");
        };
    }
}
