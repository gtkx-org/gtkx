/**
 * Method Builder
 *
 * Builds instance method code for classes.
 */

import type { GirConstructor, GirMethod, GirParameter } from "@gtkx/gir";
import type { Writer } from "../../../builders/writer.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import type { MappedType, SelfTypeDescriptor } from "../../../core/type-system/ffi-types.js";
import { type AsyncMethodAnalysis, analyzeAsyncMethods } from "../../../core/utils/async-analysis.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { isMethodDuplicate } from "../../../core/utils/filtering.js";
import { toCamelCase } from "../../../core/utils/naming.js";
import { formatNullableReturn } from "../../../core/utils/type-qualification.js";
import {
    addTypeImports,
    createMethodBodyWriter,
    type ImportCollector,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../../core/writers/index.js";
import type { ConstructorSelection } from "../../../core/writers/method-body-writer.js";

/**
 * Builds method code for a class.
 */
export class MethodBuilder {
    private readonly methodBody: MethodBodyWriter;

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly imports: ImportCollector,
        private readonly methodRenames: Map<string, string>,
        private readonly options: FfiGeneratorOptions,
        selfNames?: ReadonlySet<string>,
    ) {
        this.methodBody = createMethodBodyWriter(ffiMapper, imports, {
            sharedLibrary: options.sharedLibrary,
            glibLibrary: options.glibLibrary,
            selfNames,
        });
    }

    /**
     * Builds method structures for all methods.
     * Returns structures for batch adding by ClassGenerator.
     *
     * @param methods - The methods to build structures for
     * @param selfTypeDescriptor - The self type descriptor for instance methods
     * @param asyncAnalysis - Pre-computed async analysis (optional, computed if not provided)
     * @returns Array of method structures
     */
    buildStructures(
        methods: readonly GirMethod[],
        selfTypeDescriptor: SelfTypeDescriptor,
        asyncAnalysis?: AsyncMethodAnalysis,
    ): MethodStructure[] {
        const seen = new Set<string>();
        const { asyncMethods, finishMethods, asyncPairs } = asyncAnalysis ?? analyzeAsyncMethods(methods);
        const methodStructures: MethodStructure[] = [];

        for (const method of methods) {
            if (isMethodDuplicate(method.name, method.cIdentifier, seen)) continue;
            if (this.methodBody.hasUnsupportedCallbacks(method.parameters)) continue;
            if (asyncMethods.has(method.name)) continue;
            if (finishMethods.has(method.name)) continue;

            const structure = this.buildMethodStructure(method, selfTypeDescriptor);
            if (structure) {
                methodStructures.push(structure);
            }
        }

        for (const [asyncMethodName, finishMethodName] of asyncPairs) {
            const asyncMethod = methods.find((m) => m.name === asyncMethodName);
            const finishMethod = methods.find((m) => m.name === finishMethodName);

            if (asyncMethod && finishMethod) {
                const structure = this.buildAsyncWrapperStructure(asyncMethod, finishMethod, selfTypeDescriptor);
                if (structure) {
                    methodStructures.push(structure);
                }
            }
        }

        return methodStructures;
    }

    private buildMethodStructure(method: GirMethod, selfTypeDescriptor: SelfTypeDescriptor): MethodStructure {
        return this.methodBody.buildMethodStructure(method, {
            methodName: this.methodBody.resolveMethodName(method, this.methodRenames),
            selfTypeDescriptor,
            sharedLibrary: this.options.sharedLibrary,
            namespace: this.options.namespace,
        });
    }

    /**
     * Checks if a parameter list has ref parameters.
     * Delegates to MethodBodyWriter.
     */
    hasRefParameter(parameters: readonly GirParameter[]): boolean {
        return this.methodBody.hasRefParameter(parameters);
    }

    /**
     * Checks if a parameter list has unsupported callbacks.
     * Delegates to MethodBodyWriter.
     */
    hasUnsupportedCallbacks(parameters: readonly GirParameter[]): boolean {
        return this.methodBody.hasUnsupportedCallbacks(parameters);
    }

    /**
     * Selects supported constructors and identifies the main constructor.
     * Delegates to MethodBodyWriter.
     */
    selectConstructors(constructors: readonly GirConstructor[]): ConstructorSelection {
        return this.methodBody.selectConstructors(constructors);
    }

    /**
     * Builds a Promise-based async wrapper method structure.
     * Combines an async method and its _finish counterpart into a single Promise method.
     */
    private buildAsyncWrapperStructure(
        asyncMethod: GirMethod,
        finishMethod: GirMethod,
        selfTypeDescriptor: SelfTypeDescriptor,
    ): MethodStructure {
        const baseName = asyncMethod.name.replace(/_async$/, "");
        const methodName = `${toCamelCase(baseName)}Async`;

        const asyncParams = this.filterAsyncParameters(asyncMethod.parameters);
        const params = this.methodBody.buildParameterList(asyncParams);

        const returnTypeMapping = this.ffiMapper.mapType(
            finishMethod.returnType,
            true,
            finishMethod.returnType.transferOwnership,
        );
        addTypeImports(this.imports, returnTypeMapping.imports);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);

        const innerReturnType = formatNullableReturn(returnTypeMapping.ts, finishMethod.returnType.nullable === true);
        const promiseReturnType = `Promise<${innerReturnType}>`;

        return {
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
     * Uses GIR callback metadata to exclude:
     * - Varargs
     * - All callback types (GIR-defined callbacks, including AsyncReadyCallback)
     * - All closure targets (user_data for any callback)
     * - All destroy notifies (for any callback)
     */
    private filterAsyncParameters(parameters: readonly GirParameter[]): GirParameter[] {
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
     * Writes the async wrapper method body.
     */
    private writeAsyncWrapperBody(
        asyncMethod: GirMethod,
        finishMethod: GirMethod,
        asyncParams: readonly GirParameter[],
        returnTypeMapping: MappedType,
        selfTypeDescriptor: SelfTypeDescriptor,
    ): (writer: Writer) => void {
        this.imports.addImport("../../native.js", ["call"]);
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);

        const hasReturnValue = returnTypeMapping.ts !== "void";
        const wrapInfo = this.methodBody.needsObjectWrap(returnTypeMapping);
        const isNullable = finishMethod.returnType.nullable === true;
        const baseReturnType = returnTypeMapping.ts;

        if (finishMethod.throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            this.methodBody.setupGErrorImports();
        }
        if (
            hasReturnValue &&
            (wrapInfo.needsWrap ||
                wrapInfo.needsBoxedWrap ||
                wrapInfo.needsFundamentalWrap ||
                wrapInfo.needsStructWrap ||
                wrapInfo.needsInterfaceWrap)
        ) {
            this.imports.addImport("../../registry.js", ["getNativeObject"]);
        }

        return (writer) => {
            const rejectParam = finishMethod.throws ? "reject" : "_reject";
            writer.writeLine(`return new Promise((resolve, ${rejectParam}) => {`);
            writer.withIndent(() => {
                writer.writeLine("call(");
                writer.withIndent(() => {
                    writer.writeLine(`"${this.options.sharedLibrary}",`);
                    writer.writeLine(`"${asyncMethod.cIdentifier}",`);
                    writer.writeLine("[");
                    writer.withIndent(() => {
                        writer.write("{ type: ");
                        writer.write(JSON.stringify(selfTypeDescriptor));
                        writer.writeLine(", value: this.handle },");

                        const asyncArgs = this.methodBody.buildCallArgumentsArray(asyncParams, 1);
                        this.methodBody.writeArgumentsToWriter(writer, asyncArgs);

                        writer.writeLine("{");
                        writer.withIndent(() => {
                            writer.writeLine(
                                'type: { type: "trampoline", argTypes: [{ type: "gobject", ownership: "borrowed" }, { type: "gobject", ownership: "borrowed" }, { type: "uint64" }], returnType: { type: "void" }, userDataIndex: 2, scope: "async" },',
                            );
                            writer.writeLine("value: (_source: unknown, result: unknown) => {");
                            writer.withIndent(() => {
                                if (finishMethod.throws) {
                                    this.imports.addImport("@gtkx/native", ["createRef"]);
                                    writer.writeLine("const error = createRef<NativeHandle | null>(null);");
                                }

                                if (hasReturnValue) {
                                    writer.write(wrapInfo.needsWrap ? "const ptr = call(" : "const value = call(");
                                } else {
                                    writer.write("call(");
                                }
                                writer.newLine();
                                writer.withIndent(() => {
                                    writer.writeLine(`"${this.options.sharedLibrary}",`);
                                    writer.writeLine(`"${finishMethod.cIdentifier}",`);
                                    writer.writeLine("[");
                                    writer.withIndent(() => {
                                        writer.write("{ type: ");
                                        writer.write(JSON.stringify(selfTypeDescriptor));
                                        writer.writeLine(", value: this.handle },");
                                        writer.writeLine(
                                            '{ type: { type: "gobject", ownership: "borrowed" }, value: result },',
                                        );
                                        if (finishMethod.throws) {
                                            writer.write("{ type: ");
                                            writer.write(
                                                JSON.stringify(
                                                    this.methodBody.getFfiTypeWriter().createGErrorRefTypeDescriptor(),
                                                ),
                                            );
                                            writer.writeLine(", value: error },");
                                        }
                                    });
                                    writer.writeLine("],");
                                    writer.write(JSON.stringify(returnTypeMapping.ffi));
                                    writer.newLine();
                                });

                                if (hasReturnValue) {
                                    if (wrapInfo.needsWrap) {
                                        writer.writeLine(");");
                                    } else {
                                        writer.writeLine(`) as unknown as ${baseReturnType};`);
                                    }
                                } else {
                                    writer.writeLine(");");
                                }

                                if (finishMethod.throws) {
                                    const gerrorRef = this.methodBody.setupGErrorImports();
                                    writer.writeLine("if (error.value !== null) {");
                                    writer.withIndent(() => {
                                        writer.writeLine(
                                            `reject(new NativeError(getNativeObject(error.value, ${gerrorRef})));`,
                                        );
                                        writer.writeLine("return;");
                                    });
                                    writer.writeLine("}");
                                }

                                if (hasReturnValue) {
                                    if (wrapInfo.needsWrap) {
                                        if (isNullable) {
                                            writer.writeLine("if (ptr === null) {");
                                            writer.withIndent(() => {
                                                writer.writeLine("resolve(null);");
                                                writer.writeLine("return;");
                                            });
                                            writer.writeLine("}");
                                        }
                                        if (
                                            wrapInfo.needsBoxedWrap ||
                                            wrapInfo.needsFundamentalWrap ||
                                            wrapInfo.needsStructWrap ||
                                            wrapInfo.needsInterfaceWrap
                                        ) {
                                            writer.writeLine(
                                                `resolve(getNativeObject(ptr as NativeHandle, ${baseReturnType}));`,
                                            );
                                        } else {
                                            writer.writeLine(
                                                `resolve(getNativeObject(ptr as NativeHandle) as ${baseReturnType});`,
                                            );
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

                        writer.writeLine('{ type: { type: "void" }, value: null },');
                    });
                    writer.writeLine("],");
                    writer.writeLine('{ type: "void" }');
                });
                writer.writeLine(");");
            });
            writer.writeLine("});");
        };
    }
}
