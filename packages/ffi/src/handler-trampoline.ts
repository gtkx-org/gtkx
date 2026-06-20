import type { Type as FfiType, RefType, Value } from "@gtkx/native";
import { valueCopyInto } from "./gvalue.js";
import { getHandle } from "./registry.js";
import { unwrapValue, wrapValue } from "./wrap-value.js";

/** A scalar out/inout parameter the native trampoline marshals through a `{ value }` cell. */
const isOutCell = (argType: FfiType): argType is RefType => argType.type === "ref";

/** A caller-allocated out parameter: a borrowed boxed/struct buffer filled in place. */
const isCallerAllocatedBuffer = (argType: FfiType): boolean =>
    (argType.type === "boxed" || argType.type === "struct") && argType.callerAllocated === true;

/**
 * Copies every accessor-backed field from `source` into `target` through the
 * wrapper's own setters, which deep-copy owned fields (a string duplicates, a
 * boxed copies, an object refs). Fills a caller-allocated out parameter's buffer
 * in place from the value a handler returns.
 */
const copyBoxedFields = (target: object, source: object): void => {
    let proto: object | null = Object.getPrototypeOf(target);
    while (proto !== null && proto !== Object.prototype) {
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
            if (descriptor.get !== undefined && descriptor.set !== undefined) {
                (target as Record<string, unknown>)[key] = (source as Record<string, unknown>)[key];
            }
        }
        proto = Object.getPrototypeOf(proto);
    }
};

/**
 * Fills a caller-allocated out parameter's buffer in place from a handler's
 * returned value. A `GValue` is deep-copied through {@link valueCopyInto}
 * (`g_value_copy`), the only ownership-correct fill for its `GType`-tagged
 * union payload; every other boxed or struct copies field-by-field through its
 * deep-copying setters.
 */
const fillCallerAllocatedBuffer = (argType: FfiType, target: object, source: object): void => {
    if (argType.type === "boxed" && argType.innerType === "GValue") {
        valueCopyInto(getHandle(target), getHandle(source));
        return;
    }
    copyBoxedFields(target, source);
};

/**
 * Splits a handler's result into the primary return and the out-parameter
 * values, following the tuple convention the generated public method uses: a
 * lone primary when there are no out parameters, the single out value bare for a
 * void return with one out, otherwise `[primary?, ...outs]`.
 */
const splitHandlerResult = (
    result: unknown,
    hasPrimary: boolean,
    outCount: number,
): { primary: unknown; outValues: unknown[] } => {
    if (hasPrimary) {
        const tuple = result as unknown[];
        return { primary: tuple[0], outValues: tuple.slice(1) };
    }
    if (outCount === 1) {
        return { primary: undefined, outValues: [result] };
    }
    return { primary: undefined, outValues: result as unknown[] };
};

/**
 * How a handler's leading native argument is treated by {@link wrapHandler}:
 * `"this"` binds it as the receiver (vfuncs), `"skip"` drops it (a signal's
 * emitter), `"none"` forwards it positionally (plain callbacks).
 */
export type HandlerReceiver = "this" | "skip" | "none";

/** The wrapped native→JS handler the trampoline invokes with raw FFI argument values. */
export type Handler = (...args: Value[]) => Value;

/** A user-supplied handler — a vfunc override, signal handler, or callback — of any shape. */
export type UserHandler = (...args: never[]) => unknown;

/**
 * The callback descriptor {@link wrapHandler} marshals against. {@link CallbackType}
 * satisfies it directly; a vfunc supplies the argument and return types alone.
 */
export type HandlerSpec = {
    readonly argTypes: readonly FfiType[];
    readonly returnType: FfiType;
    readonly userDataIndex?: number;
};

/** One out parameter resolved from a handler's arguments, plus its lifted wrapper. */
type OutParam = { readonly value: unknown; readonly argType: FfiType };

/**
 * Splits a handler's lifted arguments into the inputs it receives and the out
 * parameters written back. A scalar `inout` cell is both — its incoming value
 * is an input and its slot an output. A caller-allocated buffer is an output for
 * a vfunc (filled from the return) but an input for a signal/callback (mutated
 * in place). Everything else is a plain input.
 */
const partitionHandlerArgs = (
    effectiveTypes: readonly FfiType[],
    wrapped: readonly unknown[],
    start: number,
    receiver: HandlerReceiver,
): { inputs: unknown[]; outParams: OutParam[] } => {
    const inputs: unknown[] = [];
    const outParams: OutParam[] = [];
    for (let i = start; i < effectiveTypes.length; i++) {
        const argType = effectiveTypes[i];
        if (argType !== undefined && isOutCell(argType)) {
            if (argType.inout === true) inputs.push((wrapped[i] as { value: unknown }).value);
            outParams.push({ value: wrapped[i], argType });
        } else if (argType !== undefined && isCallerAllocatedBuffer(argType) && receiver === "this") {
            outParams.push({ value: wrapped[i], argType });
        } else {
            inputs.push(wrapped[i]);
        }
    }
    return { inputs, outParams };
};

/** Writes each out value back into its cell or caller-allocated buffer. */
const writeOutParams = (outParams: readonly OutParam[], outValues: readonly unknown[]): void => {
    outParams.forEach((outParam, position) => {
        const outValue = outValues[position];
        if (isOutCell(outParam.argType)) {
            (outParam.value as { value: unknown }).value = outValue;
        } else if (outValue != null && outParam.value != null) {
            fillCallerAllocatedBuffer(outParam.argType, outParam.value as object, outValue as object);
        }
    });
};

/**
 * Wraps a native→JS handler (a vfunc override, signal handler, or callback) in
 * the shared marshalling the trampoline boundary needs.
 *
 * Each native argument is lifted to its typed JavaScript wrapper through
 * {@link wrapValue}, partitioned into inputs and out parameters by
 * {@link partitionHandlerArgs}, and the handler is invoked with the inputs. Out
 * values surface the way the public method does — a lone value or a
 * `[primary, ...outs]` tuple — and are written back through {@link writeOutParams};
 * the primary return is lowered through {@link unwrapValue}.
 *
 * @param fn - The user handler.
 * @param spec - The callback descriptor (argument types, return type, user-data index).
 * @param receiver - How the leading argument is treated.
 */
export function wrapHandler(fn: UserHandler, spec: HandlerSpec, receiver: HandlerReceiver): Handler {
    const { returnType, userDataIndex } = spec;
    const effectiveTypes =
        userDataIndex === undefined ? spec.argTypes : spec.argTypes.filter((_, i) => i !== userDataIndex);
    const start = receiver === "none" ? 0 : 1;
    return (...rawArgs: Value[]): Value => {
        const wrapped = effectiveTypes.map((argType, i) => wrapValue(argType, rawArgs[i]));
        const thisArg = receiver === "this" ? (wrapped[0] ?? null) : null;
        const { inputs, outParams } = partitionHandlerArgs(effectiveTypes, wrapped, start, receiver);
        const result = (fn as (this: unknown, ...args: unknown[]) => unknown).apply(thisArg, inputs);
        if (outParams.length === 0) {
            return unwrapValue(returnType, result);
        }
        const { primary, outValues } = splitHandlerResult(result, returnType.type !== "void", outParams.length);
        writeOutParams(outParams, outValues);
        return unwrapValue(returnType, primary);
    };
}
