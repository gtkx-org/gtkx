/**
 * Callable Body Emitter
 *
 * Emits the executable body of a generated method, function, async wrapper, or
 * factory: the FFI call expression, hidden out-parameter allocations, return
 * tuple assembly, and object-wrapping of the result. It is the emission
 * collaborator of {@link MethodBodyWriter}, which owns capability detection and
 * the `build*Structure` surface and delegates body emission here.
 */

import type { Writer } from "../builders/text-writer.js";
import type { GirFunction, GirMethod, GirParameter } from "../gir/index.js";
import type { FfiMapper } from "../type-system/ffi-mapper.js";
import type { FfiTypeDescriptor, MappedType, SelfTypeDescriptor } from "../type-system/ffi-types.js";
import { type AsyncCapableCallable, findCancellableParameter } from "../utils/async-callable.js";
import { hasVarargs, isVararg } from "../utils/filtering.js";
import { createWrappedName } from "../utils/naming.js";
import { formatNullableReturn } from "../utils/type-qualification.js";
import { type CallArgument, type CallbackWrapperInfo, CallExpressionBuilder } from "./call-expression-builder.js";
import type { CallableShape, HiddenOut, ParamMapping, ShapeCallArg } from "./callable-shape.js";
import type { FfiDescriptorRegistry } from "./descriptor-registry.js";
import type { FfiTypeWriter } from "./ffi-type-writer.js";
import { addTypeImports, type ImportCollector } from "./import-collector.js";
import { resolveNamespaceImportPath } from "./namespace-import-path.js";
import { buildCallbackWrapperExpression, needsParamWrap, needsReturnUnwrap } from "./param-wrap-writer.js";

/**
 * Options for building instance method body statements.
 */
export type MethodBodyStatementsOptions = {
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** Self type descriptor for FFI marshalling */
    selfTypeDescriptor: SelfTypeDescriptor;
    /** Class name for object wrapping (e.g., "GtkButton") */
    className?: string;
};

/**
 * Options for building function body statements.
 */
export type FunctionBodyStatementsOptions = {
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** Class name for own-class returns */
    className?: string;
    /** Whether the function returns its own class type */
    returnsOwnClass?: boolean;
};

/**
 * Unified options for callable body generation.
 * Used internally by writeCallableBody to handle both methods and functions.
 */
export type CallableBodyOptions = {
    /** The shared library (e.g., "libgtk-4.so.1") */
    sharedLibrary: string;
    /** C identifier for the FFI call */
    cIdentifier: string;
    /** Pre-computed callable shape covering signature/hidden/tuple decisions. */
    shape: CallableShape;
    /** Original GIR parameters — required for resolving callback wrappers. */
    parameters: readonly GirParameter[];
    /** Whether the callable can throw */
    throws?: boolean;
    /** Self options for instance methods */
    self?: { type: SelfTypeDescriptor; value: string };
    /** Class name for own-class returns (static functions on records) */
    ownClassName?: string;
    /** Whether this callable has varargs */
    hasVarargs?: boolean;
};

type CallableBodyContext = {
    options: CallableBodyOptions;
    callArguments: CallArgument[];
    wrapInfo: ObjectWrapInfo;
    ownClassName: string | undefined;
    hasReturnValue: boolean;
};

/**
 * Options for building a Promise-returning wrapper for a GIO-style async
 * callable.
 */
export type AsyncCallableStructureOptions = {
    /** The `*_async` callable to wrap. */
    asyncCallable: AsyncCapableCallable;
    /** The companion `*_finish` callable whose return type is the Promise value. */
    finishCallable: AsyncCapableCallable;
    /** The `GAsyncReadyCallback` parameter dropped from the wrapper signature. */
    callbackParameter: GirParameter;
    /** The TypeScript member name to emit for the wrapper. */
    memberName: string;
    /** The TypeScript member name of the companion `*_finish` member. */
    finishMemberName: string;
    /** Whether the wrapper is a static member. */
    isStatic: boolean;
    /** The shared library (e.g., "libgtk-4.so.1"). */
    sharedLibrary: string;
    /** Current namespace for documentation links. */
    namespace: string;
    /** Self options for instance-method wrappers; omitted for functions. */
    self?: { type: SelfTypeDescriptor; value: string };
    /** Class name when `*_finish` returns the wrapper's own class type. */
    finishOwnClassName?: string;
};

/**
 * Object-wrapping decisions for a callable's return value.
 */
export type ObjectWrapInfo = {
    needsWrap: boolean;
    needsGObjectWrap: boolean;
    needsBoxedWrap: boolean;
    needsFundamentalWrap: boolean;
    needsInterfaceWrap: boolean;
    needsStructWrap: boolean;
    needsArrayItemWrap: boolean;
    arrayItemType: string | undefined;
    arrayItemIsInterface: boolean;
    needsHashTableWrap: boolean;
};

const computeResultSuffix = (
    needsResultPtr: boolean,
    needsArrayWrapVar: unknown,
    needsHashTableVar: boolean,
): string => {
    if (needsResultPtr) return "Ptr";
    if (needsArrayWrapVar) return "Arr";
    if (needsHashTableVar) return "Tuples";
    return "";
};

/**
 * Emits the executable body of generated callables.
 */
export class CallableBodyEmitter {
    private readonly callExpression: CallExpressionBuilder;
    private selfNames: ReadonlySet<string> = new Set();

    constructor(
        private readonly ffiMapper: FfiMapper,
        private readonly imports: ImportCollector,
        private readonly ffiTypeWriter: FfiTypeWriter,
        descriptors?: FfiDescriptorRegistry,
    ) {
        this.callExpression = new CallExpressionBuilder(descriptors, imports);
    }

    /**
     * Sets names that should be excluded from type imports.
     * Use this to prevent a class from importing itself.
     */
    setSelfNames(names: ReadonlySet<string>): void {
        this.selfNames = names;
    }

    private filterParameters(parameters: readonly GirParameter[]): GirParameter[] {
        return parameters.filter((p) => !isVararg(p) && !this.ffiMapper.isClosureTarget(p, parameters));
    }

    /**
     * Determines if a return type needs object wrapping (getNativeObject call).
     */
    needsObjectWrap(returnTypeMapping: MappedType): ObjectWrapInfo {
        const baseReturnType = returnTypeMapping.ts === "void" ? "void" : returnTypeMapping.ts;

        const needsGObjectWrap =
            returnTypeMapping.ffi.type === "gobject" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";

        const needsBoxedWrap =
            returnTypeMapping.ffi.type === "boxed" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";

        const needsFundamentalWrap =
            returnTypeMapping.ffi.type === "fundamental" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";

        const needsInterfaceWrap =
            (returnTypeMapping.ffi.type === "gobject" || returnTypeMapping.ffi.type === "fundamental") &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind === "interface";

        const needsStructWrap =
            returnTypeMapping.ffi.type === "struct" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";

        const itemType = returnTypeMapping.ffi.itemType;
        const needsArrayItemWrap =
            returnTypeMapping.ffi.type === "array" &&
            itemType !== undefined &&
            (itemType.type === "gobject" || itemType.type === "boxed" || itemType.type === "fundamental");

        const arrayItemType = needsArrayItemWrap ? baseReturnType.replace(/\[\]$/, "") : undefined;
        const arrayItemIsInterface = returnTypeMapping.itemKind === "interface";

        const needsHashTableWrap = returnTypeMapping.ffi.type === "hashtable";

        return {
            needsWrap:
                needsGObjectWrap || needsBoxedWrap || needsFundamentalWrap || needsInterfaceWrap || needsStructWrap,
            needsGObjectWrap,
            needsBoxedWrap,
            needsFundamentalWrap,
            needsInterfaceWrap,
            needsStructWrap,
            needsArrayItemWrap,
            arrayItemType,
            arrayItemIsInterface,
            needsHashTableWrap,
        };
    }

    writeCallbackWrapperDeclarations(writer: Writer, args: readonly CallArgument[]): void {
        for (const arg of args) {
            if (arg.callbackWrapper) {
                writer.write(`const ${arg.callbackWrapper.wrappedName} = `);
                arg.callbackWrapper.wrapExpression(writer);
                writer.write(";");
                writer.newLine();
            }
        }
    }

    /**
     * Builds CallArgument entries from a callable shape.
     *
     * Resolves callback wrappers and translates {@link ShapeCallArg} into
     * the {@link CallArgument} form consumed by {@link CallExpressionBuilder}.
     */
    buildShapeCallArguments(shape: CallableShape, parameters: readonly GirParameter[]): CallArgument[] {
        return shape.callArgs.map((arg) => this.toCallArgument(arg, parameters, shape));
    }

    /**
     * Emits the Promise-returning body of a GIO-style async wrapper.
     */
    writeAsyncCallableBody(
        shape: CallableShape,
        options: AsyncCallableStructureOptions,
        callbackJsName: string,
    ): (writer: Writer) => void {
        this.imports.addImport("../../runtime.js", ["promisify"]);
        if (shape.hiddenOuts.length > 0) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
        }

        const split = this.splitAsyncCallArguments(shape, options, callbackJsName);
        const finishExpression = options.self
            ? `this.${options.finishMemberName}.bind(this)`
            : options.finishMemberName;

        return (writer) => {
            for (const hidden of shape.hiddenOuts) {
                this.writeHiddenOutDeclaration(writer, hidden);
            }
            const argFields = [`leading: [${split.leadingArgs.join(", ")}]`];
            if (split.trailingArgs.length > 0) {
                argFields.push(`trailing: [${split.trailingArgs.join(", ")}]`);
            }
            writer.writeLine(
                `return promisify(${split.asyncFnExpression}, ${finishExpression}, ${split.cancellableExpression}, { ${argFields.join(", ")} });`,
            );
        };
    }

    /**
     * Splits the FFI call arguments of a GIO async callable into the inputs
     * the {@link promisify} runtime helper expects: the native `*_async`
     * binding, the leading arguments preceding the `GCancellable*` slot, the
     * `cancellable` expression, and any trailing arguments between that slot
     * and the dropped `GAsyncReadyCallback`.
     */
    private splitAsyncCallArguments(
        shape: CallableShape,
        options: AsyncCallableStructureOptions,
        callbackJsName: string,
    ): {
        asyncFnExpression: string;
        leadingArgs: string[];
        cancellableExpression: string;
        trailingArgs: string[];
    } {
        const callArguments = this.buildShapeCallArguments(shape, options.asyncCallable.parameters);
        const filteredParams = this.filterParameters(options.asyncCallable.parameters);
        const cancellableParam = findCancellableParameter(options.asyncCallable);
        const cancellableGirIndex = cancellableParam ? filteredParams.indexOf(cancellableParam) : -1;
        const callbackMapping = shape.paramMappings.find((m) => m.jsName === callbackJsName);
        const callbackGirIndex = callbackMapping?.girIndex ?? -1;
        const cancellableMapping =
            cancellableGirIndex >= 0 ? shape.paramMappings.find((m) => m.girIndex === cancellableGirIndex) : undefined;

        const leadingArgs: string[] = options.self ? [options.self.value] : [];
        const trailingArgs: string[] = [];
        shape.callArgs.forEach((shapeArg, index) => {
            const sourceIndex = shapeArg.sourceParamIndex;
            if (sourceIndex === callbackGirIndex || sourceIndex === cancellableGirIndex) return;
            const value = callArguments[index]?.value;
            if (value === undefined) return;
            const afterCancellable =
                cancellableGirIndex >= 0 && sourceIndex !== null && sourceIndex > cancellableGirIndex;
            (afterCancellable ? trailingArgs : leadingArgs).push(value);
        });

        return {
            asyncFnExpression: this.resolveAsyncFnExpression(shape, options),
            leadingArgs,
            cancellableExpression: cancellableMapping?.jsName ?? "undefined",
            trailingArgs,
        };
    }

    /**
     * Resolves the JavaScript expression naming the native `*_async` start
     * callable handed to {@link promisify}.
     *
     * A GIO async callable carries a `GAsyncReadyCallback` and a closure
     * target rather than C varargs, so its descriptor always hoists to a
     * curried `t.fn(...)` binding whose identifier is returned here.
     */
    private resolveAsyncFnExpression(shape: CallableShape, options: AsyncCallableStructureOptions): string {
        const binding = this.callExpression.registerBinding({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: options.asyncCallable.cIdentifier,
            args: this.buildShapeCallArguments(shape, options.asyncCallable.parameters),
            returnType: shape.returnTypeMapping.ffi,
            selfArg: options.self,
            hasVarargs: hasVarargs(options.asyncCallable.parameters),
        });
        if (binding === null || binding.varargs === true) {
            throw new Error(`Async callable ${options.asyncCallable.cIdentifier} cannot be hoisted to an FFI binding`);
        }
        return binding.name;
    }

    /**
     * Writes method body using the precomputed shape.
     */
    writeMethodBody(
        method: GirMethod,
        shape: CallableShape,
        options: MethodBodyStatementsOptions,
    ): (writer: Writer) => void {
        return this.writeCallableBody({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: method.cIdentifier,
            shape,
            parameters: method.parameters,
            throws: method.throws,
            self: { type: options.selfTypeDescriptor, value: "getHandle(this)" },
            hasVarargs: hasVarargs(method.parameters),
        });
    }

    /**
     * Writes function body using the precomputed shape.
     */
    writeFunctionBody(
        func: GirFunction,
        shape: CallableShape,
        options: FunctionBodyStatementsOptions,
    ): (writer: Writer) => void {
        return this.writeCallableBody({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: func.cIdentifier,
            shape,
            parameters: func.parameters,
            throws: func.throws,
            ownClassName: options.returnsOwnClass ? options.className : undefined,
            hasVarargs: hasVarargs(func.parameters),
        });
    }

    writeCallableBody(options: CallableBodyOptions): (writer: Writer) => void {
        this.imports.addTypeImport("../../handles.js", ["NativeHandle"]);

        const { shape } = options;
        const ownClassName = options.ownClassName;
        const wrapInfo = this.needsObjectWrap(shape.returnTypeMapping);
        const hasReturnValue = shape.hasOriginalReturn;
        const hasRefHandleHidden = shape.hiddenOuts.some((h) => h.kind === "ref-handle");

        if (options.throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            this.setupGErrorImports();
        }

        if (hasRefHandleHidden) {
            this.imports.addImport("../../registry.js", ["getNativeObject"]);
        }

        if (shape.hiddenOuts.length > 0) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
        }

        return (writer) => {
            const callArguments = this.buildShapeCallArguments(shape, options.parameters);
            this.writeCallableBodyContent(writer, {
                options,
                callArguments,
                wrapInfo,
                ownClassName,
                hasReturnValue,
            });
        };
    }

    private writeCallableBodyContent(writer: Writer, ctx: CallableBodyContext): void {
        const { options, callArguments, wrapInfo, ownClassName, hasReturnValue } = ctx;
        const shape = options.shape;
        this.writeCallbackWrapperDeclarations(writer, callArguments);

        if (options.throws) {
            writer.writeLine("const error = createRef(null);");
        }

        for (const hidden of shape.hiddenOuts) {
            this.writeHiddenOutDeclaration(writer, hidden);
        }

        if (options.throws) {
            callArguments.push({
                type: this.ffiTypeWriter.createGErrorRefTypeDescriptor(),
                value: "error",
            });
        }

        const returnTupleNeedsBuild = shape.returnTupleEntries.length > 0;
        const hasRefHandleHidden = shape.hiddenOuts.some((h) => h.kind === "ref-handle");
        if (returnTupleNeedsBuild || options.throws || hasRefHandleHidden) {
            this.emitTupleReturningBody(writer, ctx);
            return;
        }

        const writeCall = this.makeCallEmitter(writer, options, callArguments);
        const hasOwnClassReturn = ownClassName !== undefined;
        const hasObjectWrapReturn = wrapInfo.needsWrap && hasReturnValue;

        if (hasOwnClassReturn || hasObjectWrapReturn) {
            writeCall("ptr", null);
            this.writeObjectReturnFromPtr(writer, shape, wrapInfo, ownClassName);
            return;
        }

        if (wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType) {
            writeCall("arr", "unknown[]");
            this.writeArrayItemReturn(writer, shape, wrapInfo);
            return;
        }

        if (wrapInfo.needsHashTableWrap) {
            writeCall("tuples", null);
            this.writeRefHandleRewrap(writer, shape);
            if (shape.originalReturnNullable) {
                writer.writeLine("if (tuples === null) return null;");
            }
            writer.writeLine("return new Map(tuples);");
            return;
        }

        this.writeSimpleCall(writer, ctx);
    }

    /**
     * Emits the FFI call expression for a callable into `writer`, without a
     * trailing statement terminator.
     */
    private emitFfiCall(writer: Writer, options: CallableBodyOptions, callArguments: CallArgument[]): void {
        this.callExpression.toWriter({
            sharedLibrary: options.sharedLibrary,
            cIdentifier: options.cIdentifier,
            args: callArguments,
            returnType: options.shape.returnTypeMapping.ffi,
            selfArg: options.self,
            hasVarargs: options.hasVarargs,
        })(writer);
    }

    private makeCallEmitter(
        writer: Writer,
        options: CallableBodyOptions,
        callArguments: CallArgument[],
    ): (target: string | null, cast: string | null) => void {
        return (target, _cast) => {
            if (target === null) {
                writer.write("return ");
            } else {
                writer.write(`const ${target} = `);
            }
            this.emitFfiCall(writer, options, callArguments);
            writer.write(";");
            writer.newLine();
        };
    }

    private writeObjectReturnFromPtr(
        writer: Writer,
        shape: CallableShape,
        wrapInfo: ObjectWrapInfo,
        ownClassName: string | undefined,
    ): void {
        this.writeRefHandleRewrap(writer, shape);
        const baseReturnType = ownClassName ?? shape.originalReturnTsType;
        if (ownClassName === undefined && shape.originalReturnNullable) {
            writer.writeLine("if (ptr === null) return null;");
        }
        if (wrapInfo.needsInterfaceWrap) {
            this.imports.addImport("../../registry.js", ["getNativeObjectAsInterface"]);
            writer.writeLine(`return getNativeObjectAsInterface(ptr, ${baseReturnType});`);
            return;
        }
        this.imports.addImport("../../registry.js", ["getNativeObject"]);
        const needsTypedWrap = wrapInfo.needsBoxedWrap || wrapInfo.needsFundamentalWrap || wrapInfo.needsStructWrap;
        if (needsTypedWrap) {
            writer.writeLine(`return getNativeObject(ptr, ${baseReturnType});`);
        } else {
            writer.writeLine("return getNativeObject(ptr);");
        }
    }

    private writeArrayItemReturn(writer: Writer, shape: CallableShape, wrapInfo: ObjectWrapInfo): void {
        this.writeRefHandleRewrap(writer, shape);
        if (wrapInfo.arrayItemIsInterface) {
            this.imports.addImport("../../registry.js", ["getNativeObjectAsInterface"]);
            writer.writeLine(`return arr.map((item) => getNativeObjectAsInterface(item, ${wrapInfo.arrayItemType}));`);
        } else {
            this.imports.addImport("../../registry.js", ["getNativeObject"]);
            writer.writeLine("return arr.map((item) => getNativeObject(item));");
        }
    }

    private writeSimpleCall(writer: Writer, ctx: CallableBodyContext): void {
        if (ctx.hasReturnValue) {
            writer.write("return ");
        }
        this.emitFfiCall(writer, ctx.options, ctx.callArguments);
        writer.write(";");
        writer.newLine();
    }

    private emitTupleReturningBody(writer: Writer, ctx: CallableBodyContext): void {
        const { options, callArguments, wrapInfo, ownClassName } = ctx;
        const shape = options.shape;
        const baseReturnType = ownClassName ?? shape.originalReturnTsType;
        const tsReturnType = formatNullableReturn(baseReturnType, shape.originalReturnNullable);
        const hasReturnValue = shape.hasOriginalReturn;
        const hasOwnClassReturn = ownClassName !== undefined;
        const needsResultPtr = hasReturnValue && (wrapInfo.needsWrap || hasOwnClassReturn);
        const needsArrayWrapVar = hasReturnValue && wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType !== undefined;
        const needsHashTableVar = hasReturnValue && wrapInfo.needsHashTableWrap;

        const resultExpression = this.emitTupleCallStatement(writer, options, callArguments, {
            hasReturnValue,
            needsResultPtr,
            needsArrayWrapVar,
            needsHashTableVar,
            tsReturnType,
        });

        if (options.throws) {
            this.writeErrorCheck(writer);
        }

        const rewrapBindings = this.writeRefHandleRewrap(writer, shape);

        const originalReturnExpression = this.buildOriginalReturnExpression(writer, shape, wrapInfo, {
            resultExpression,
            hasReturnValue,
            ownClassName,
            baseReturnType,
        });

        if (shape.returnTupleEntries.length === 0) {
            if (originalReturnExpression !== null) {
                writer.writeLine(`return ${originalReturnExpression};`);
            }
            return;
        }

        this.writeTupleReturn(writer, shape, originalReturnExpression, rewrapBindings);
    }

    private emitTupleCallStatement(
        writer: Writer,
        options: CallableBodyOptions,
        callArguments: CallArgument[],
        info: {
            hasReturnValue: boolean;
            needsResultPtr: boolean;
            needsArrayWrapVar: boolean;
            needsHashTableVar: boolean;
            tsReturnType: string;
        },
    ): string | null {
        const writeCall = () => {
            this.emitFfiCall(writer, options, callArguments);
        };

        if (!info.hasReturnValue) {
            writeCall();
            writer.write(";");
            writer.newLine();
            return null;
        }

        const baseVar = this.uniqueResultVarName(options.shape, "result");
        const suffix = computeResultSuffix(info.needsResultPtr, info.needsArrayWrapVar, info.needsHashTableVar);
        const resultExpression = `${baseVar}${suffix}`;
        writer.write(`const ${resultExpression} = `);
        writeCall();
        writer.write(";");
        writer.newLine();
        return resultExpression;
    }

    private buildOriginalReturnExpression(
        writer: Writer,
        shape: CallableShape,
        wrapInfo: ObjectWrapInfo,
        info: {
            resultExpression: string | null;
            hasReturnValue: boolean;
            ownClassName: string | undefined;
            baseReturnType: string;
        },
    ): string | null {
        const { resultExpression, hasReturnValue, ownClassName, baseReturnType } = info;
        if (!hasReturnValue || resultExpression === null) return null;

        if (ownClassName !== undefined || wrapInfo.needsWrap) {
            const targetType = ownClassName ?? baseReturnType;
            const wrapped = this.formatObjectWrap(resultExpression, targetType, wrapInfo);
            if (ownClassName === undefined && shape.originalReturnNullable) {
                writer.writeLine(
                    `const ${resultExpression}Wrapped = ${resultExpression} === null ? null : ${wrapped};`,
                );
                return `${resultExpression}Wrapped`;
            }
            return wrapped;
        }

        if (wrapInfo.needsArrayItemWrap && wrapInfo.arrayItemType) {
            if (wrapInfo.arrayItemIsInterface) {
                this.imports.addImport("../../registry.js", ["getNativeObjectAsInterface"]);
                return `${resultExpression}.map((item) => getNativeObjectAsInterface(item, ${wrapInfo.arrayItemType}))`;
            }
            this.imports.addImport("../../registry.js", ["getNativeObject"]);
            return `${resultExpression}.map((item) => getNativeObject(item))`;
        }

        if (wrapInfo.needsHashTableWrap) {
            return shape.originalReturnNullable
                ? `(${resultExpression} === null ? null : new Map(${resultExpression}))`
                : `new Map(${resultExpression})`;
        }

        return resultExpression;
    }

    private writeTupleReturn(
        writer: Writer,
        shape: CallableShape,
        originalReturnExpression: string | null,
        rewrapBindings: Map<string, string>,
    ): void {
        const tupleParamMappings = shape.paramMappings.filter((m) => m.isOut && !m.isLengthParam);
        const tupleExprs: string[] = [];
        let outIndex = 0;
        for (const entry of shape.returnTupleEntries) {
            if (entry.kind === "original-return") {
                tupleExprs.push(originalReturnExpression ?? "undefined");
                continue;
            }
            const mapping = tupleParamMappings[outIndex];
            tupleExprs.push(this.expressionForOutMapping(shape, mapping, rewrapBindings));
            outIndex++;
        }

        if (shape.returnTupleEntries.length === 1 && !shape.hasOriginalReturn) {
            writer.writeLine(`return ${tupleExprs[0]};`);
            return;
        }
        writer.writeLine(`return [${tupleExprs.join(", ")}];`);
    }

    private expressionForOutMapping(
        shape: CallableShape,
        mapping: ParamMapping | undefined,
        rewrapBindings: Map<string, string>,
    ): string {
        if (!mapping) return "undefined";

        if (mapping.hiddenOutIndex === null) {
            return mapping.nullable || mapping.optional ? `(${mapping.jsName} ?? null)` : mapping.jsName;
        }

        const hidden = shape.hiddenOuts[mapping.hiddenOutIndex];
        if (!hidden) return "undefined";

        if (hidden.kind === "alloc-struct" || hidden.kind === "factory-struct") {
            return hidden.varName;
        }
        if (hidden.kind === "ref-handle") {
            return rewrapBindings.get(hidden.varName) ?? `${hidden.varName}.value`;
        }
        return `${hidden.varName}.value`;
    }

    private uniqueResultVarName(shape: CallableShape, base: string): string {
        const usedNames = new Set<string>();
        for (const param of shape.signatureParams) {
            usedNames.add(param.name);
        }
        for (const hidden of shape.hiddenOuts) {
            usedNames.add(hidden.varName);
        }
        if (!usedNames.has(base)) return base;
        let suffix = 2;
        while (usedNames.has(`${base}${suffix}`)) suffix++;
        return `${base}${suffix}`;
    }

    /**
     * Public alias for the hidden-out declaration emitter.
     * Used by the constructor builder to seed factory bodies.
     */
    writeHiddenOutDeclarationFor(writer: Writer, hidden: HiddenOut): void {
        this.writeHiddenOutDeclaration(writer, hidden);
    }

    private writeHiddenOutDeclaration(writer: Writer, hidden: HiddenOut): void {
        if (hidden.kind === "factory-struct") {
            writer.writeLine(`const ${hidden.varName} = ${hidden.factoryCIdentifier}();`);
            return;
        }
        if (hidden.kind === "alloc-struct") {
            if (hidden.wrapClassName) {
                writer.writeLine(`const ${hidden.varName} = new ${hidden.wrapClassName}();`);
            } else {
                writer.writeLine(`const ${hidden.varName} = createRef(null);`);
            }
            return;
        }
        if (hidden.kind === "ref-handle") {
            writer.writeLine(`const ${hidden.varName} = createRef(null);`);
            return;
        }
        writer.writeLine(`const ${hidden.varName} = createRef(${hidden.initialValue});`);
    }

    private writeRefHandleRewrap(writer: Writer, shape: CallableShape): Map<string, string> {
        const bindings = new Map<string, string>();
        for (const hidden of shape.hiddenOuts) {
            if (hidden.kind !== "ref-handle") continue;
            const wrappedName = `${hidden.varName}Wrapped`;
            bindings.set(hidden.varName, wrappedName);
            const className = hidden.wrapClassName;
            if (!className) {
                writer.writeLine(`const ${wrappedName} = ${hidden.varName}.value;`);
                continue;
            }
            if (hidden.nullable) {
                writer.writeLine(
                    `const ${wrappedName} = ${hidden.varName}.value === null ? null : ${
                        hidden.wrapAsBoxed
                            ? `getNativeObject(${hidden.varName}.value, ${className})`
                            : `getNativeObject(${hidden.varName}.value)`
                    };`,
                );
            } else {
                writer.writeLine(
                    `const ${wrappedName} = ${
                        hidden.wrapAsBoxed
                            ? `getNativeObject(${hidden.varName}.value, ${className})`
                            : `getNativeObject(${hidden.varName}.value)`
                    };`,
                );
            }
        }
        return bindings;
    }

    private formatObjectWrap(ptrExpr: string, baseReturnType: string, wrapInfo: ObjectWrapInfo): string {
        if (wrapInfo.needsInterfaceWrap) {
            this.imports.addImport("../../registry.js", ["getNativeObjectAsInterface"]);
            return `getNativeObjectAsInterface(${ptrExpr}, ${baseReturnType})`;
        }
        this.imports.addImport("../../registry.js", ["getNativeObject"]);
        if (wrapInfo.needsBoxedWrap || wrapInfo.needsFundamentalWrap || wrapInfo.needsStructWrap) {
            return `getNativeObject(${ptrExpr}, ${baseReturnType})`;
        }
        return `getNativeObject(${ptrExpr})`;
    }

    private toCallArgument(arg: ShapeCallArg, parameters: readonly GirParameter[], shape: CallableShape): CallArgument {
        if (arg.sourceParamIndex !== null) {
            const filtered = parameters.length > 0 ? this.filterParameters(parameters) : [];
            const param = filtered[arg.sourceParamIndex];
            if (param) {
                const mapping = shape.paramMappings.find((m) => m.girIndex === arg.sourceParamIndex);
                if (mapping?.isSignatureParam && !mapping.isOut) {
                    const callbackWrapper = this.buildCallbackWrapper(param, mapping.jsName, mapping.nullable);
                    return {
                        type: arg.ffi,
                        value: callbackWrapper ? callbackWrapper.wrappedName : arg.value,
                        optional: arg.optional,
                        callbackWrapper,
                    };
                }
            }
        }
        return {
            type: arg.ffi,
            value: arg.value,
            optional: arg.optional,
        };
    }

    private buildCallbackWrapper(
        param: GirParameter,
        jsParamName: string,
        isOptional: boolean,
    ): CallbackWrapperInfo | undefined {
        const callbackParams = this.ffiMapper.getCallbackParamMappings(param);
        const callbackReturnType = this.ffiMapper.getCallbackReturnType(param);
        const returnUnwrapInfo = needsReturnUnwrap(callbackReturnType);

        const wrapInfos = callbackParams
            ? callbackParams.map((p) => ({
                  ...p,
                  wrapInfo: needsParamWrap(p.mapped),
              }))
            : [];

        const anyParamNeedsWrap = wrapInfos.some((w) => w.wrapInfo.needsWrap);
        const needsWrapper = anyParamNeedsWrap || returnUnwrapInfo.needsUnwrap;

        if (!needsWrapper) {
            return undefined;
        }

        for (const w of wrapInfos) {
            if (w.wrapInfo.needsWrap) {
                this.imports.addImport(
                    "../../registry.js",
                    w.wrapInfo.isInterface ? ["getNativeObjectAsInterface"] : ["getNativeObject"],
                );
            }
            this.addTypeImportsFromMapping(w.mapped);
        }

        const wrappedName = createWrappedName(jsParamName);
        const wrapExpression = buildCallbackWrapperExpression(jsParamName, wrapInfos, returnUnwrapInfo);

        return {
            paramName: jsParamName,
            wrappedName,
            wrapExpression,
            isOptional,
        };
    }

    /**
     * Sets up GError import tracking and returns the appropriate GError reference.
     */
    setupGErrorImports(currentNamespace?: string): string {
        this.imports.addImport("../../native.js", ["checkError"]);

        const namespace = currentNamespace ?? this.ffiMapper.getCurrentNamespace();
        const isGLibNamespace = namespace === "GLib";

        if (isGLibNamespace) {
            this.imports.addImport("./error.js", ["Error"]);
            return "Error";
        }
        this.imports.addNamespaceImport(resolveNamespaceImportPath("GLib"), "GLib");
        return "GLib.Error";
    }

    private writeErrorCheck(writer: Writer): void {
        const gerrorRef = this.setupGErrorImports();
        writer.writeLine(`checkError(error, ${gerrorRef});`);
    }

    /**
     * Writes a static factory method body.
     *
     * Out and inout parameters from the original GIR signature are hidden
     * behind internal allocations (passed via {@link hiddenOuts}); their
     * post-call values are discarded — factory methods always return the
     * constructed object.
     */
    writeFactoryMethodBody(options: {
        sharedLibrary: string;
        cIdentifier: string;
        args: CallArgument[];
        returnTypeDescriptor: FfiTypeDescriptor;
        wrapClassName: string;
        throws: boolean;
        useClassInWrap: boolean;
        hiddenOuts?: readonly HiddenOut[];
    }): (writer: Writer) => void {
        this.imports.addTypeImport("../../handles.js", ["NativeHandle"]);
        this.imports.addImport("../../registry.js", ["getNativeObject"]);
        const { sharedLibrary, cIdentifier, args, returnTypeDescriptor, wrapClassName, throws, useClassInWrap } =
            options;
        const hiddenOuts = options.hiddenOuts ?? [];

        if (throws) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
            this.setupGErrorImports();
        }
        if (hiddenOuts.length > 0) {
            this.imports.addImport("@gtkx/native", ["createRef"]);
        }

        const allArgs = throws
            ? [...args, { type: this.ffiTypeWriter.createGErrorRefTypeDescriptor(), value: "error" }]
            : args;

        const callWriter = this.callExpression.toWriter({
            sharedLibrary,
            cIdentifier,
            args: allArgs,
            returnType: returnTypeDescriptor,
        });

        return (writer) => {
            this.writeCallbackWrapperDeclarations(writer, args);

            if (throws) {
                writer.writeLine("const error = createRef(null);");
            }

            for (const hidden of hiddenOuts) {
                this.writeHiddenOutDeclaration(writer, hidden);
            }

            writer.write("const ptr = ");
            callWriter(writer);
            writer.writeLine(";");

            if (throws) {
                this.writeErrorCheck(writer);
            }

            if (useClassInWrap) {
                writer.writeLine(`return getNativeObject(ptr, ${wrapClassName});`);
            } else {
                writer.writeLine("return getNativeObject(ptr);");
            }
        };
    }

    private addTypeImportsFromMapping(mapped: MappedType): void {
        addTypeImports(this.imports, mapped.imports, this.selfNames);
    }
}
