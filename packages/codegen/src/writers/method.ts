import { quote, toCamelCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import type { GirFunction } from "../gir/function.js";
import { type GirParameter, isCallerAllocatedOut, isInoutParameter, isOutParameter } from "../gir/parameter.js";
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
import { renderTsType } from "./ts-type.js";
import { omitsPrimaryReturn, renderCallbackType, renderFfiType, renderSelfFfiType } from "./value.js";

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
    for (const { parameter, index } of inputParameters(context.repository, fn)) {
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
    const folded = foldedLengthIndices(context.repository, fn);
    const outs = fn.parameters.filter(
        (p, index) =>
            (isOutParameter(p) ||
                (isCallerAllocatedOut(p) && isCollectibleCallerOut(context, p)) ||
                isInoutParameter(p)) &&
            !folded.has(index),
    );
    const primaryReturnsValue = !omitsPrimaryReturn(context.repository, fn.returnValue);
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
    const cancellableIndex = findCancellableIndex(context, asyncFn.parameters);
    const closureIndices = closureAndDestroyIndices(asyncFn);
    const lengthFor = arrayLengthSources(context.repository, asyncFn);
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

const findCancellableIndex = (context: ModuleContext, parameters: readonly GirParameter[]): number => {
    for (let index = 0; index < parameters.length; index += 1) {
        const parameter = parameters[index];
        if (parameter === undefined) continue;
        if (isCancellable(context, parameter)) return index;
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
        (parameter) => isCancellable(context, parameter),
    );
    const finishReturn = renderMethodReturnType(context, finishFn);
    return { signature, returnType: `Promise<${finishReturn}>` };
};

const isCancellable = (context: ModuleContext, parameter: GirParameter): boolean =>
    parameter.type !== undefined && context.repository.nameOf(parameter.type)?.typeName === "Cancellable";

const isCallbackParameter = (context: ModuleContext, parameter: GirParameter): boolean => {
    const ref = parameter.type;
    if (ref === undefined) return false;
    return context.repository.typeOf(ref)?.kind === "callback";
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
    readonly consumed?: boolean;
};

const ffiParamLiteral = (ffiExpr: string, options: FfiParamOptions): string => {
    const parts = [`type: ${ffiExpr}`];
    if (options.direction !== undefined) parts.push(`direction: ${quote(options.direction)}`);
    if (options.callerAllocates === true) parts.push("callerAllocates: true");
    if (options.consumed === true) parts.push("consumed: true");
    return `{ ${parts.join(", ")} }`;
};

/**
 * Renders the FFI return-type descriptor an {@link t.fn} binding carries: the
 * FFI type of the primary return, passed directly as the binding's return type.
 * The descriptor self-resolves the wrapper class the value lifts into.
 *
 * @param context - The module context
 * @param fn - The callable
 */
export const renderReturnDescriptor = (context: ModuleContext, fn: GirFunction): string => {
    const instanceOffset = fn.instance === undefined ? 0 : 1;
    return renderFfiType(context, fn.returnValue.type, fn.returnValue.transferOwnership, {
        argIndexOffset: instanceOffset,
    });
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
 * callback's descriptor and excluded.
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
    const lengthFor = arrayLengthSources(context.repository, fn);
    const closureIndices = closureAndDestroyIndices(fn);
    const folded = foldedLengthIndices(context.repository, fn);
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
            const ffi = renderFfiType(context, parameter.type, parameter.transferOwnership, {
                argIndexOffset: instanceOffset,
            });
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
    const ffi = renderFfiType(context, parameter.type, parameter.transferOwnership, { argIndexOffset: instanceOffset });
    return { paramLiteral: ffiParamLiteral(ffi, { direction: "out", consumed }), inputExpr: undefined };
};

const planCallerOut = (context: ModuleContext, parameter: GirParameter, instanceOffset: number): CallArgPlan => {
    const ffi = renderFfiType(context, parameter.type, "none", { argIndexOffset: instanceOffset });
    const name = parameter.type === undefined ? undefined : context.repository.nameOf(parameter.type);
    if (name !== undefined && isCollectibleCallerOut(context, parameter)) {
        context.addRuntimeImport("getHandle");
        const classExpression = context.qualify(name.namespaceName, name.typeName);
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
        const ffi = renderFfiType(context, parameter.type, "none", { argIndexOffset: instanceOffset });
        return {
            paramLiteral: ffiParamLiteral(ffi, { direction: "inout", callerAllocates: true, consumed }),
            inputExpr: parameterIdentifier(parameter, index),
        };
    }
    const ffi = renderFfiType(context, parameter.type, parameter.transferOwnership, { argIndexOffset: instanceOffset });
    return {
        paramLiteral: ffiParamLiteral(ffi, { direction: "inout", consumed }),
        inputExpr: parameterCallExpression(context, parameter, index),
    };
};

const planInParam = (
    context: ModuleContext,
    parameter: GirParameter,
    index: number,
    instanceOffset: number,
): CallArgPlan => {
    const callback = renderCallbackType(context, parameter.type, parameter);
    const ffi =
        callback ??
        renderFfiType(context, parameter.type, parameter.transferOwnership, { argIndexOffset: instanceOffset });
    return {
        paramLiteral: ffiParamLiteral(ffi, {}),
        inputExpr: parameterCallExpression(context, parameter, index),
    };
};

const parameterCallExpression = (context: ModuleContext, parameter: GirParameter, index: number): string => {
    const name = parameterIdentifier(parameter, index);
    const ref = parameter.type;
    if (ref === undefined) return name;
    const nullable = parameter.nullable || parameter.optional;
    if (isHandlePassing(context, ref)) {
        if (nullable) {
            context.addRuntimeImport("tryGetHandle");
            return `tryGetHandle(${name})`;
        }
        context.addRuntimeImport("getHandle");
        return `getHandle(${name})`;
    }
    const type = context.repository.typeOf(ref);
    if ((type?.kind === "carray" || type?.kind === "list") && isHandlePassing(context, type.element)) {
        context.addRuntimeImport("getHandle");
        return nullable ? `${name}?.map((item) => getHandle(item))` : `${name}.map((item) => getHandle(item))`;
    }
    if (type?.kind === "hashtable") {
        if (isHandlePassing(context, type.value)) {
            context.addRuntimeImport("tryGetHandle");
            return `${name} ? globalThis.Array.from(${name}).map(([k, v]) => [k, tryGetHandle(v)]) : null`;
        }
        return `${name} ? globalThis.Array.from(${name}) : null`;
    }
    return name;
};
