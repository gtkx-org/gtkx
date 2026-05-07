/**
 * Method Builder
 *
 * Builds instance method code for classes.
 */

import type { GirMethod, GirParameter } from "@gtkx/gir";
import type { Writer } from "../../../builders/writer.js";
import type { FfiGeneratorOptions } from "../../../core/generator-types.js";
import type { FfiMapper } from "../../../core/type-system/ffi-mapper.js";
import type { MappedType, SelfTypeDescriptor } from "../../../core/type-system/ffi-types.js";
import { type AsyncMethodAnalysis, analyzeAsyncMethods } from "../../../core/utils/async-analysis.js";
import { buildJsDocStructure } from "../../../core/utils/doc-formatter.js";
import { isMethodDuplicate } from "../../../core/utils/filtering.js";
import { toCamelCase } from "../../../core/utils/naming.js";
import { formatNullableReturn } from "../../../core/utils/type-qualification.js";
import { writeFfiTypeExpression } from "../../../core/writers/ffi-type-expression.js";
import {
    addTypeImports,
    createMethodBodyWriter,
    type ImportCollector,
    type MethodBodyWriter,
    type MethodStructure,
} from "../../../core/writers/index.js";

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
    private buildSyncMethodStructures(
        methods: readonly GirMethod[],
        selfTypeDescriptor: SelfTypeDescriptor,
        asyncMethods: Set<string>,
        finishMethods: Set<string>,
    ): MethodStructure[] {
        const seen = new Set<string>();
        const result: MethodStructure[] = [];

        for (const method of methods) {
            if (isMethodDuplicate(method.name, method.cIdentifier, seen)) continue;
            if (this.methodBody.hasUnsupportedCallbacks(method.parameters)) continue;
            if (this.methodBody.isReturnTypeUnsafe(method.returnType)) continue;
            if (asyncMethods.has(method.name)) continue;
            if (finishMethods.has(method.name)) continue;

            const structure = this.buildMethodStructure(method, selfTypeDescriptor);
            if (structure) result.push(structure);
        }

        return result;
    }

    private buildAsyncWrapperStructures(
        methods: readonly GirMethod[],
        selfTypeDescriptor: SelfTypeDescriptor,
        asyncPairs: Map<string, string>,
    ): MethodStructure[] {
        const result: MethodStructure[] = [];
        for (const [asyncMethodName, finishMethodName] of asyncPairs) {
            const asyncMethod = methods.find((m) => m.name === asyncMethodName);
            const finishMethod = methods.find((m) => m.name === finishMethodName);
            if (!asyncMethod || !finishMethod) continue;
            const structure = this.buildAsyncWrapperStructure(asyncMethod, finishMethod, selfTypeDescriptor);
            if (structure) result.push(structure);
        }
        return result;
    }

    buildStructures(
        methods: readonly GirMethod[],
        selfTypeDescriptor: SelfTypeDescriptor,
        asyncAnalysis?: AsyncMethodAnalysis,
    ): MethodStructure[] {
        const { asyncMethods, finishMethods, asyncPairs } = asyncAnalysis ?? analyzeAsyncMethods(methods);
        return [
            ...this.buildSyncMethodStructures(methods, selfTypeDescriptor, asyncMethods, finishMethods),
            ...this.buildAsyncWrapperStructures(methods, selfTypeDescriptor, asyncPairs),
        ];
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
     * Checks if a parameter list has unsupported callbacks.
     */
    hasUnsupportedCallbacks(parameters: readonly GirParameter[]): boolean {
        return this.methodBody.hasUnsupportedCallbacks(parameters);
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
        this.imports.addImport("../../native.js", ["call", "t"]);
        this.imports.addTypeImport("../../object.js", ["NativeHandle"]);

        const hasReturnValue = returnTypeMapping.ts !== "void";
        const wrapInfo = this.methodBody.needsObjectWrap(returnTypeMapping);
        const isNullable = finishMethod.returnType.nullable === true;
        const baseReturnType = returnTypeMapping.ts;

        if (finishMethod.throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            this.methodBody.setupGErrorImports();
        }
        if (hasReturnValue && wrapInfo.needsWrap) {
            this.imports.addImport(
                "../../registry.js",
                wrapInfo.needsInterfaceWrap ? ["getNativeObjectAsInterface"] : ["getNativeObject"],
            );
        }

        const asyncShape = this.methodBody.buildShape(asyncParams, undefined, 1);
        if (asyncShape.hiddenOuts.length > 0) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
        }

        const ctx: AsyncWrapperContext = {
            asyncMethod,
            finishMethod,
            asyncParams,
            returnTypeMapping,
            selfTypeDescriptor,
            hasReturnValue,
            wrapInfo,
            isNullable,
            baseReturnType,
            asyncShape,
        };

        return (writer) => {
            const rejectParam = finishMethod.throws ? "reject" : "_reject";
            writer.writeLine(`return new Promise((resolve, ${rejectParam}) => {`);
            writer.withIndent(() => this.writeAsyncCallBody(writer, ctx));
            writer.writeLine("});");
        };
    }

    private writeAsyncCallBody(writer: Writer, ctx: AsyncWrapperContext): void {
        for (const hidden of ctx.asyncShape.hiddenOuts) {
            this.methodBody.writeHiddenOutDeclarationFor(writer, hidden);
        }
        writer.writeLine("call(");
        writer.withIndent(() => {
            writer.writeLine(`"${this.options.sharedLibrary}",`);
            writer.writeLine(`"${ctx.asyncMethod.cIdentifier}",`);
            writer.writeLine("[");
            writer.withIndent(() => this.writeAsyncCallArguments(writer, ctx));
            writer.writeLine("],");
            writer.writeLine('{ type: "void" }');
        });
        writer.writeLine(");");
    }

    private writeAsyncCallArguments(writer: Writer, ctx: AsyncWrapperContext): void {
        writer.write("{ type: ");
        writeFfiTypeExpression(writer, ctx.selfTypeDescriptor);
        writer.writeLine(", value: this.handle },");

        const asyncArgs = this.methodBody.buildShapeCallArguments(ctx.asyncShape, ctx.asyncParams);
        this.methodBody.writeArgumentsToWriter(writer, asyncArgs);

        writer.writeLine("{");
        writer.withIndent(() => this.writeAsyncTrampolineDescriptor(writer, ctx));
        writer.writeLine("},");

        writer.writeLine('{ type: { type: "void" }, value: null },');
    }

    private writeAsyncTrampolineDescriptor(writer: Writer, ctx: AsyncWrapperContext): void {
        writer.write("type: ");
        writeFfiTypeExpression(writer, {
            type: "trampoline",
            argTypes: [
                { type: "gobject", ownership: "borrowed" },
                { type: "gobject", ownership: "borrowed" },
                { type: "uint64" },
            ],
            returnType: { type: "void" },
            userDataIndex: 2,
            scope: "async",
        });
        writer.writeLine(",");
        writer.writeLine("value: (_source: unknown, result: unknown) => {");
        writer.withIndent(() => this.writeAsyncFinishCallback(writer, ctx));
        writer.writeLine("},");
    }

    private writeAsyncFinishCallback(writer: Writer, ctx: AsyncWrapperContext): void {
        if (ctx.finishMethod.throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            writer.writeLine("const error = createRef<NativeHandle | null>(null);");
        }

        if (ctx.hasReturnValue) {
            writer.write(ctx.wrapInfo.needsWrap ? "const ptr = call(" : "const value = call(");
        } else {
            writer.write("call(");
        }
        writer.newLine();
        writer.withIndent(() => this.writeFinishCallArguments(writer, ctx));

        if (ctx.hasReturnValue) {
            if (ctx.wrapInfo.needsWrap) {
                writer.writeLine(");");
            } else {
                writer.writeLine(`) as unknown as ${ctx.baseReturnType};`);
            }
        } else {
            writer.writeLine(");");
        }

        if (ctx.finishMethod.throws) {
            this.writeAsyncErrorCheck(writer);
        }

        this.writeAsyncResolve(writer, ctx);
    }

    private writeFinishCallArguments(writer: Writer, ctx: AsyncWrapperContext): void {
        writer.writeLine(`"${this.options.sharedLibrary}",`);
        writer.writeLine(`"${ctx.finishMethod.cIdentifier}",`);
        writer.writeLine("[");
        writer.withIndent(() => {
            writer.write("{ type: ");
            writeFfiTypeExpression(writer, ctx.selfTypeDescriptor);
            writer.writeLine(", value: this.handle },");
            writer.write("{ type: ");
            writeFfiTypeExpression(writer, { type: "gobject", ownership: "borrowed" });
            writer.writeLine(", value: result },");
            if (ctx.finishMethod.throws) {
                writer.write("{ type: ");
                writeFfiTypeExpression(writer, this.methodBody.getFfiTypeWriter().createGErrorRefTypeDescriptor());
                writer.writeLine(", value: error },");
            }
        });
        writer.writeLine("],");
        writeFfiTypeExpression(writer, ctx.returnTypeMapping.ffi);
        writer.newLine();
    }

    private writeAsyncErrorCheck(writer: Writer): void {
        const gerrorRef = this.methodBody.setupGErrorImports();
        writer.writeLine("if (error.value !== null) {");
        writer.withIndent(() => {
            writer.writeLine(`reject(new NativeError(getNativeObject(error.value, ${gerrorRef})));`);
            writer.writeLine("return;");
        });
        writer.writeLine("}");
    }

    private writeAsyncResolve(writer: Writer, ctx: AsyncWrapperContext): void {
        if (!ctx.hasReturnValue) {
            writer.writeLine("resolve();");
            return;
        }
        if (!ctx.wrapInfo.needsWrap) {
            writer.writeLine("resolve(value);");
            return;
        }
        if (ctx.isNullable) {
            writer.writeLine("if (ptr === null) {");
            writer.withIndent(() => {
                writer.writeLine("resolve(null);");
                writer.writeLine("return;");
            });
            writer.writeLine("}");
        }
        if (ctx.wrapInfo.needsInterfaceWrap) {
            this.imports.addImport("../../registry.js", ["getNativeObjectAsInterface"]);
            writer.writeLine(`resolve(getNativeObjectAsInterface(ptr as NativeHandle, ${ctx.baseReturnType}));`);
        } else if (ctx.wrapInfo.needsBoxedWrap || ctx.wrapInfo.needsFundamentalWrap || ctx.wrapInfo.needsStructWrap) {
            writer.writeLine(`resolve(getNativeObject(ptr as NativeHandle, ${ctx.baseReturnType}));`);
        } else {
            writer.writeLine(`resolve(getNativeObject(ptr as NativeHandle) as ${ctx.baseReturnType});`);
        }
    }
}

interface AsyncWrapperContext {
    asyncMethod: GirMethod;
    finishMethod: GirMethod;
    asyncParams: readonly GirParameter[];
    returnTypeMapping: MappedType;
    selfTypeDescriptor: SelfTypeDescriptor;
    hasReturnValue: boolean;
    wrapInfo: ReturnType<MethodBuilder["methodBody"]["needsObjectWrap"]>;
    isNullable: boolean;
    baseReturnType: string;
    asyncShape: ReturnType<MethodBuilder["methodBody"]["buildShape"]>;
}
