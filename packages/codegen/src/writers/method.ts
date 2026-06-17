import { quote, toCamelCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirFunction } from "../gir/function.js";
import { type GirParameter, isCallerAllocatedOut, isInoutParameter, isOutParameter } from "../gir/parameter.js";
import { qualifyTypeRef } from "../gir/qualify.js";
import type { GirTypeRef } from "../gir/type-ref.js";
import {
    arrayLengthSources,
    closureAndDestroyIndices,
    foldedLengthIndices,
    inputParameters,
    isCollectibleCallerOut,
    isHandlePassing,
    parameterIdentifier,
    passesHandleInPlace,
} from "./param-classify.js";
import { resolveWrapClass, wrapReturnValue } from "./return-wrap.js";
import { renderTsType } from "./ts-type.js";
import {
    isCellInout,
    type ResolvedCallback,
    renderFfiType,
    renderSelfFfiType,
    renderTrampolineType,
    resolveCallbackType,
} from "./value.js";

/**
 * Returns the camelCased JS export name for a callable's method or static.
 *
 * @param fn - The callable
 */
export const methodExportName = (fn: GirFunction): string => toCamelCase(fn.name);

/**
 * Renders the TypeScript parameter list for a callable.
 *
 * Drops out-only parameters, `<varargs>` slots, and array-length
 * parameters whose value is computed from a sibling array's `.length`.
 * Names follow `toCamelCase` of the GIR name, falling back to
 * `arg<index>` for unnamed positions.
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const renderMethodSignature = (context: ModuleContext, fn: GirFunction): string =>
    renderInputParameters(
        context,
        fn,
        () => false,
        () => false,
    );

const renderInputParameters = (
    context: ModuleContext,
    fn: GirFunction,
    skip: (parameter: GirParameter) => boolean,
    isOptionalExtra: (parameter: GirParameter) => boolean,
): string => {
    const parts: string[] = [];
    let sawOptional = false;
    for (const { parameter, index } of inputParameters(fn)) {
        if (skip(parameter)) continue;
        const name = parameterIdentifier(parameter, index);
        if (parameter.optional || isOptionalExtra(parameter)) {
            sawOptional = true;
        }
        const annotation = renderTsType(context, parameter.type, parameter.nullable);
        parts.push(sawOptional ? `${name}?: ${annotation}` : `${name}: ${annotation}`);
    }
    return parts.join(", ");
};

/**
 * Renders the TypeScript return-type annotation for a callable.
 *
 * Multi-out callables tuple the primary return with each out-parameter
 * (`[primary, ...outs]`); when the primary return is void the tuple
 * starts at the first out-parameter.
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const renderMethodReturnType = (context: ModuleContext, fn: GirFunction): string => {
    const folded = foldedLengthIndices(fn);
    const outs = fn.parameters.filter(
        (p, index) =>
            (isOutParameter(p) ||
                (isCallerAllocatedOut(p) && isCollectibleCallerOut(context, p)) ||
                isInoutParameter(p)) &&
            !folded.has(index),
    );
    const primaryReturnsValue = !omitsPrimaryReturn(fn);
    if (outs.length === 0) {
        return primaryReturnsValue ? renderTsType(context, fn.returnValue.type, fn.returnValue.nullable) : "void";
    }
    const outTypes = outs.map((parameter) => renderTsType(context, parameter.type, false));
    if (!primaryReturnsValue) {
        return outTypes.length === 1 ? `${outTypes[0]}` : `[${outTypes.join(", ")}]`;
    }
    const primary = renderTsType(context, fn.returnValue.type, fn.returnValue.nullable);
    return `[${primary}, ${outTypes.join(", ")}]`;
};

const isVoidReturn = (fn: GirFunction): boolean => {
    const ref = fn.returnValue.type;
    if (ref === undefined) return true;
    return ref.kind === "primitive" && ref.category === "void";
};

/**
 * Whether the callable's primary return value is dropped from the surfaced
 * result: a `void` return, or a `(skip)`-annotated one whose C value carries
 * nothing a JS caller needs. Either way the rendered return type and body
 * expose only the out-parameters.
 *
 * @param fn - The callable
 */
const omitsPrimaryReturn = (fn: GirFunction): boolean => isVoidReturn(fn) || fn.returnValue.skip;

/**
 * Renders the JS body of a promisified `*_async` method that delegates to
 * the runtime's `promisify` helper.
 *
 * The method's leading FFI args (everything before the `GCancellable*`
 * slot) and the cancellable parameter are extracted from the GIR `*_async`
 * signature; the trailing `GAsyncReadyCallback` slot is filled by
 * `promisify`. The `*_finish` companion is bound from the same class via
 * `this[finishName].bind(this)`.
 *
 * @param context - The module context
 * @param asyncFn - The `*_async` callable
 * @param finishMember - The camelCase JS name of the companion `*_finish` method
 * @param bindingExpression - Expression that evaluates to the bound async callable
 */
export const renderPromisifiedBody = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishMember: string,
    bindingExpression: string,
): string => {
    context.addRuntimeImport("promisify");
    const cancellableIndex = findCancellableIndex(asyncFn.parameters);
    const closureIndices = closureAndDestroyIndices(asyncFn);
    const lengthFor = arrayLengthSources(asyncFn);
    const leadingExpressions: string[] = [];
    if (asyncFn.instance !== undefined) {
        context.addRuntimeImport("getHandle");
        leadingExpressions.push("getHandle(this)");
    }
    let cancellableExpression = "null";
    asyncFn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (index === cancellableIndex) {
            cancellableExpression = parameterIdentifier(parameter, index);
            return;
        }
        if (isCallbackParameter(context, parameter)) return;
        if (closureIndices.has(index)) return;
        const sourceIndex = lengthFor.get(index);
        if (sourceIndex !== undefined) {
            const source = asyncFn.parameters[sourceIndex];
            if (source !== undefined) {
                leadingExpressions.push(`${parameterIdentifier(source, sourceIndex)}.length`);
                return;
            }
        }
        leadingExpressions.push(parameterCallExpression(context, parameter, index));
    });
    const leadingLiteral = `[${leadingExpressions.join(", ")}]`;
    return `return promisify(${bindingExpression}, this.${finishMember}.bind(this), ${cancellableExpression}, { leading: ${leadingLiteral} });`;
};

const findCancellableIndex = (parameters: readonly GirParameter[]): number => {
    for (let index = 0; index < parameters.length; index += 1) {
        const parameter = parameters[index];
        if (parameter === undefined) continue;
        if (parameter.type?.kind !== "named") continue;
        if (parameter.type.typeName === "Cancellable") return index;
    }
    return -1;
};

/**
 * Renders the TypeScript signature for a promisified `*_async` method.
 *
 * The signature drops the trailing `GAsyncReadyCallback` and `gpointer
 * user_data` slots, marks the cancellable optional, and returns a
 * `Promise` wrapping the finish method's return type.
 *
 * @param context - The module context
 * @param asyncFn - The `*_async` callable
 * @param finishFn - The companion `*_finish` callable
 */
export const renderPromisifiedSignature = (
    context: ModuleContext,
    asyncFn: GirFunction,
    finishFn: GirFunction,
): { readonly signature: string; readonly returnType: string } => {
    const signature = renderInputParameters(
        context,
        asyncFn,
        (parameter) => isCallbackParameter(context, parameter),
        isCancellable,
    );
    const finishReturn = renderMethodReturnType(context, finishFn);
    return { signature, returnType: `Promise<${finishReturn}>` };
};

const isCancellable = (parameter: GirParameter): boolean =>
    parameter.type?.kind === "named" && parameter.type.typeName === "Cancellable";

const isCallbackParameter = (context: ModuleContext, parameter: GirParameter): boolean => {
    const ref = parameter.type;
    if (ref === undefined) return false;
    if (ref.kind === "callback") return true;
    if (ref.kind !== "named") return false;
    const namespaceName = ref.namespaceName ?? context.namespace.name;
    const resolved = context.repository.resolveNamed(namespaceName, ref.typeName);
    return resolved !== undefined && resolved.kind === "callback";
};

/**
 * Options accepted by {@link renderMethodBody}.
 */
export type WriteMethodBodyOptions = {
    /** Bound `t.fn` callable expression to invoke. */
    readonly bindingExpression: string;
    /** True for static methods, constructors, or namespace functions. */
    readonly isStatic: boolean;
    /**
     * Overrides the cast applied to the call result — a constructor narrows it
     * to its owning class even when the GIR `<return-value>` is a parent type.
     */
    readonly returnTypeOverride?: string;
};

/**
 * Renders the JS body of a method or static: it assembles the call's input
 * values and dispatches the bound {@link t.fn} callable, which owns
 * out-parameter tupling, `GError` handling, and result wrapping. The result is
 * asserted to the rendered return type; a void callable with no out-parameters
 * is a bare statement.
 *
 * @param context - The module context
 * @param fn - The callable
 * @param options - {@link WriteMethodBodyOptions}
 */
export const renderMethodBody = (context: ModuleContext, fn: GirFunction, options: WriteMethodBodyOptions): string => {
    const { bindingExpression, returnTypeOverride } = options;
    const inputs = planCallArgs(context, fn)
        .map((arg) => arg.inputExpr)
        .filter((expression): expression is string => expression !== undefined);
    const callExpression = `${bindingExpression}(${inputs.join(", ")})`;
    const annotation = returnTypeOverride ?? renderMethodReturnType(context, fn);
    return annotation === "void" ? `${callExpression};` : `return ${callExpression} as ${annotation};`;
};

/**
 * One positional argument of a call: the `t.fn` parameter descriptor the
 * binding carries, paired with the input expression the body passes (absent for
 * a pure-out the runtime allocates).
 */
type CallArgPlan = {
    readonly paramLiteral: string;
    readonly inputExpr: string | undefined;
};

type FfiParamOptions = {
    readonly direction?: "out" | "inout";
    readonly callerAllocates?: boolean;
    readonly wrapClass?: string;
    readonly consumed?: boolean;
    readonly optional?: boolean;
};

const ffiParamLiteral = (ffiExpr: string, options: FfiParamOptions): string => {
    const parts = [`type: ${ffiExpr}`];
    if (options.direction !== undefined) parts.push(`direction: ${quote(options.direction)}`);
    if (options.callerAllocates === true) parts.push("callerAllocates: true");
    if (options.wrapClass !== undefined) parts.push(`wrapClass: () => ${options.wrapClass}`);
    if (options.consumed === true) parts.push("consumed: true");
    if (options.optional === true) parts.push("optional: true");
    return `{ ${parts.join(", ")} }`;
};

/**
 * Renders the `{ type, wrapClass? }` return descriptor an {@link t.fn}
 * binding carries: the FFI type of the primary return and, for an interface,
 * boxed, struct, or fundamental value, its pre-resolved wrapper class.
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const renderReturnDescriptor = (context: ModuleContext, fn: GirFunction): string => {
    const instanceOffset = fn.instance === undefined ? 0 : 1;
    const ffi = renderFfiType(context, fn.returnValue.type, fn.returnValue.transferOwnership, instanceOffset);
    const wrapClass = resolveWrapClass(context, fn.returnValue.type);
    return wrapClass === undefined ? `{ type: ${ffi} }` : `{ type: ${ffi}, wrapClass: () => ${wrapClass} }`;
};

/**
 * Plans a callable's positional arguments for both the {@link t.fn} binding
 * and the method body.
 *
 * Each FFI argument — the instance receiver, every regular parameter, the
 * out/inout cells, the caller-allocated outs, and folded array-length
 * companions — yields its binding descriptor and the body input expression that
 * feeds it. Pure out-parameters carry no input: the runtime allocates and reads
 * their cell. Closure, destroy, and `<varargs>` slots are folded into a
 * callback's trampoline descriptor and excluded.
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const planCallArgs = (context: ModuleContext, fn: GirFunction): CallArgPlan[] => {
    const plan: CallArgPlan[] = [];
    if (fn.instance !== undefined) {
        context.addRuntimeImport("getHandle");
        plan.push({
            paramLiteral: `{ type: ${renderSelfFfiType(context, fn.instance)} }`,
            inputExpr: "getHandle(this)",
        });
    }
    const instanceOffset = fn.instance === undefined ? 0 : 1;
    const lengthFor = arrayLengthSources(fn);
    const closureIndices = closureAndDestroyIndices(fn);
    const folded = foldedLengthIndices(fn);
    fn.parameters.forEach((parameter, index) => {
        if (parameter.isVarargs) return;
        if (closureIndices.has(index)) return;
        if (isOutParameter(parameter)) {
            plan.push(planOutParam(context, parameter, instanceOffset, folded.has(index)));
            return;
        }
        if (isCallerAllocatedOut(parameter)) {
            plan.push(planCallerOut(context, parameter, instanceOffset));
            return;
        }
        if (isInoutParameter(parameter)) {
            plan.push(planInoutParam(context, parameter, { index, instanceOffset, consumed: folded.has(index) }));
            return;
        }
        const sourceIndex = lengthFor.get(index);
        if (sourceIndex !== undefined) {
            const source = fn.parameters[sourceIndex];
            const ffi = renderFfiType(context, parameter.type, parameter.transferOwnership, instanceOffset);
            plan.push({
                paramLiteral: ffiParamLiteral(ffi, {}),
                inputExpr: source === undefined ? "0" : `${parameterIdentifier(source, sourceIndex)}.length`,
            });
            return;
        }
        plan.push(planInParam(context, parameter, index, instanceOffset));
    });
    return plan;
};

const planOutParam = (
    context: ModuleContext,
    parameter: GirParameter,
    instanceOffset: number,
    consumed: boolean,
): CallArgPlan => {
    const ffi = renderFfiType(context, parameter.type, parameter.transferOwnership, instanceOffset);
    const wrapClass = resolveWrapClass(context, parameter.type);
    return { paramLiteral: ffiParamLiteral(ffi, { direction: "out", wrapClass, consumed }), inputExpr: undefined };
};

const planCallerOut = (context: ModuleContext, parameter: GirParameter, instanceOffset: number): CallArgPlan => {
    const ffi = renderFfiType(context, parameter.type, "none", instanceOffset);
    if (parameter.type?.kind === "named" && isCollectibleCallerOut(context, parameter)) {
        context.addRuntimeImport("getHandle");
        const owner = parameter.type.namespaceName ?? context.namespace.name;
        const classExpression = context.qualify(owner, parameter.type.typeName);
        return {
            paramLiteral: ffiParamLiteral(ffi, { direction: "out", callerAllocates: true }),
            inputExpr: `new ${classExpression}()`,
        };
    }
    return { paramLiteral: ffiParamLiteral(ffi, {}), inputExpr: "undefined" };
};

const planInoutParam = (
    context: ModuleContext,
    parameter: GirParameter,
    options: { readonly index: number; readonly instanceOffset: number; readonly consumed: boolean },
): CallArgPlan => {
    const { index, instanceOffset, consumed } = options;
    if (passesHandleInPlace(context, parameter)) {
        const ffi = renderFfiType(context, parameter.type, "none", instanceOffset);
        return {
            paramLiteral: ffiParamLiteral(ffi, { direction: "inout", callerAllocates: true, consumed }),
            inputExpr: parameterIdentifier(parameter, index),
        };
    }
    const ffi = renderFfiType(context, parameter.type, parameter.transferOwnership, instanceOffset);
    const wrapClass = resolveWrapClass(context, parameter.type);
    return {
        paramLiteral: ffiParamLiteral(ffi, { direction: "inout", wrapClass, consumed }),
        inputExpr: parameterCallExpression(context, parameter, index),
    };
};

const planInParam = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    instanceOffset: number,
): CallArgPlan => {
    const trampoline = renderTrampolineType(context, parameter.type, parameter);
    const ffi = trampoline ?? renderFfiType(context, parameter.type, parameter.transferOwnership, instanceOffset);
    const optional = parameter.nullable || parameter.optional;
    return {
        paramLiteral: ffiParamLiteral(ffi, { optional }),
        inputExpr: parameterCallExpression(context, parameter, index),
    };
};

const parameterCallExpression = (context: ModuleContext, parameter: GirParameter, index: number): string => {
    const name = parameterIdentifier(parameter, index);
    const ref = parameter.type;
    if (ref === undefined) return name;
    const callback = resolveCallbackType(context, ref);
    if (callback !== undefined) return renderCallbackArgument(context, callback, name);
    const nullable = parameter.nullable || parameter.optional;
    if (isHandlePassing(context, ref)) {
        if (nullable) {
            context.addRuntimeImport("tryGetHandle");
            return `tryGetHandle(${name})`;
        }
        context.addRuntimeImport("getHandle");
        return `getHandle(${name})`;
    }
    if ((ref.kind === "array" || ref.kind === "list") && isHandlePassing(context, ref.element)) {
        context.addRuntimeImport("getHandle");
        return nullable ? `${name}?.map((item) => getHandle(item))` : `${name}.map((item) => getHandle(item))`;
    }
    if (ref.kind === "hashtable") {
        if (isHandlePassing(context, ref.value)) {
            context.addRuntimeImport("tryGetHandle");
            return `${name} ? globalThis.Array.from(${name}).map(([k, v]) => [k, tryGetHandle(v)]) : null`;
        }
        return `${name} ? globalThis.Array.from(${name}) : null`;
    }
    return name;
};

/**
 * The marshalling plan for a callback or signal trampoline's incoming
 * arguments: the rendered comma-separated handler call arguments and the
 * trampoline-arg indices of any out-parameter cells.
 */
export type TrampolineArgPlan = {
    readonly callArgs: string;
    readonly outArgIndices: number[];
};

/**
 * Plans how a callback or signal trampoline forwards its raw arguments to the
 * user handler.
 *
 * In-parameters are wrapped via {@link wrapReturnValue} and joined into the
 * handler call; out-parameters are dropped from the call and their trampoline
 * cell indices collected for write-back. `argOffset` shifts every `args[...]`
 * access: callbacks read from index `0`, while signal trampolines reserve
 * index `0` for the emitting instance and so pass `1`.
 *
 * @param context - The module context
 * @param parameters - The callback or signal parameters, varargs excluded
 * @param namespaceName - The namespace the parameter type references resolve against
 * @param argOffset - Added to each parameter's positional index
 */
export const planTrampolineArgs = (
    context: ModuleContext,
    parameters: readonly GirParameter[],
    namespaceName: string,
    argOffset: number,
): TrampolineArgPlan => {
    const callArgs = parameters
        .map((parameter, index) =>
            isOutParameter(parameter)
                ? undefined
                : wrapReturnValue(context, {
                      ref: qualifyTypeRef(parameter.type, namespaceName),
                      nullable: parameter.nullable,
                      valueExpression: isCellInout(context, parameter)
                          ? `args[${index + argOffset}].value`
                          : `args[${index + argOffset}]`,
                  }),
        )
        .filter((expression): expression is string => expression !== undefined)
        .join(", ");
    const outArgIndices = parameters
        .map((parameter, index) =>
            isOutParameter(parameter) || isCellInout(context, parameter) ? index + argOffset : -1,
        )
        .filter((index) => index >= 0);
    return { callArgs, outArgIndices };
};

const renderCallbackArgument = (context: ModuleContext, resolved: ResolvedCallback, name: string): string => {
    const { callback, namespaceName } = resolved;
    const { callArgs, outArgIndices } = planTrampolineArgs(context, callback.parameters, namespaceName, 0);
    const returnRef = qualifyTypeRef(callback.returnValue.type, namespaceName);
    if (outArgIndices.length > 0) {
        const body = renderTupleWriteback(context, `${name}(${callArgs})`, outArgIndices, returnRef);
        return `${name} ? (...args: unknown[]) => {\n    ${body}\n} : null`;
    }
    if (returnRef !== undefined && isHandlePassing(context, returnRef)) {
        context.addRuntimeImport("getHandle");
        return `${name} ? (...args: unknown[]) => {\n    const _result = ${name}(${callArgs});\n    return _result != null ? getHandle(_result) : null;\n} : null`;
    }
    return `${name} ? (...args: unknown[]) => ${name}(${callArgs}) : null`;
};

/**
 * Renders the body of a native→JS callback wrapper that returns out-parameters
 * as a tuple.
 *
 * The wrapped user function returns `[primary, ...outs]` (or the scalar out
 * alone for a void return with a single out, or an out-only tuple otherwise).
 * This emits `const _result = …;`, writes each out value into its `{ value }`
 * cell's `value` slot (`args[i].value = …`), and returns the primary — keeping the
 * tuple convention entirely in generated code so the native layer only flushes
 * cells through their out-pointers. Shared by signal and callback writers.
 *
 * @param context - The module context
 * @param callExpression - The expression that invokes the user function
 * @param outArgIndices - Argument indices of the out-parameter cells
 * @param returnRef - The primary return type, or `undefined` for void
 */
export const renderTupleWriteback = (
    context: ModuleContext,
    callExpression: string,
    outArgIndices: readonly number[],
    returnRef: GirTypeRef | undefined,
): string => {
    const lines = [`const _result = ${callExpression};`];
    const isVoid = returnRef === undefined || (returnRef.kind === "primitive" && returnRef.category === "void");
    if (!isVoid) {
        outArgIndices.forEach((argIndex, position) => {
            lines.push(`args[${argIndex}].value = _result[${position + 1}];`);
        });
        if (returnRef !== undefined && isHandlePassing(context, returnRef)) {
            context.addRuntimeImport("tryGetHandle");
            lines.push("return tryGetHandle(_result[0]);");
        } else {
            lines.push("return _result[0];");
        }
    } else if (outArgIndices.length === 1) {
        lines.push(`args[${outArgIndices[0]}].value = _result;`);
    } else {
        outArgIndices.forEach((argIndex, position) => {
            lines.push(`args[${argIndex}].value = _result[${position}];`);
        });
    }
    return lines.join("\n    ");
};
