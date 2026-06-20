import type { CallbackType, Ref, Type, Value } from "@gtkx/native";
import { bind, boxedT, refT } from "./descriptors.js";
import { checkError } from "./gerror.js";
import { getHandle } from "./registry.js";
import { type UserHandler, wrapHandler } from "./handler-trampoline.js";
import { wrapValue } from "./wrap-value.js";

/**
 * Wraps a callback argument in its {@link wrapHandler} descriptor (a plain
 * callback, so the leading argument is forwarded positionally), or passes a
 * nullish callback through unchanged.
 */
const wrapCallbackValue = (spec: CallbackType, callback: unknown): Value =>
    callback == null ? (callback as Value) : wrapHandler(callback as UserHandler, spec, "none");

/**
 * One positional argument of a callable, in C-signature order (the instance
 * receiver included): a {@link Type} extended with the argument-slot
 * flags. A plain input omits `direction`.
 */
export type ArgType = {
    /** The value's FFI type. */
    readonly type: Type;
    /** The out/inout direction the argument participates in beyond a plain input. */
    readonly direction?: "out" | "inout";
    /**
     * Whether the caller allocates the out/inout wrapper. The input wrapper's
     * handle is passed as the argument — the native call fills its backing
     * memory in place — and the same wrapper joins the result tuple unwrapped,
     * in place of the runtime allocating a `{ value }` cell and re-wrapping the
     * read-back. Set for a caller-out class/boxed and for an inout passed by
     * handle in place.
     */
    readonly callerAllocates?: boolean;
    /**
     * Whether the out-parameter is dropped from the surfaced tuple. An array's
     * folded `length` companion is allocated and passed so the native
     * marshaller can size the array, but it carries nothing a caller needs.
     */
    readonly consumed?: boolean;
};

/** Optional call-shape configuration. */
export type FnOptions = {
    /**
     * Whether the callable has an implicit trailing `GError**` out-parameter.
     * When `true`, that parameter is appended and {@link checkError} runs after
     * the call, throwing the populated `GError`.
     */
    readonly throws?: boolean;
};

/**
 * Shapes a call or signal result from its surfaced out-values and primary
 * return, following the tuple convention shared by `t.fn` and signal
 * emission: a lone `primary` when there are no outs, the single out when there
 * is no primary, or `[primary, ...outs]` when both are present.
 *
 * @param outs - The surfaced out-values, in declaration order.
 * @param primary - The primary return value, used only when `hasPrimary`.
 * @param hasPrimary - Whether the callable has a non-void return.
 * @returns The assembled result.
 */
export const tupleResult = (outs: readonly unknown[], primary: unknown, hasPrimary: boolean): unknown => {
    if (hasPrimary) {
        return outs.length === 0 ? primary : [primary, ...outs];
    }
    if (outs.length === 0) return undefined;
    if (outs.length === 1) return outs[0];
    return outs;
};

/**
 * Resolves the native argument types `t.bind` is bound with: a runtime-allocated
 * out- or inout-parameter wrapped in a `ref` so the native layer writes through
 * it, the implicit trailing `GError**` ref appended when the callable throws,
 * every other argument's type passed through unchanged.
 */
const toNativeArgTypes = (argTypes: readonly ArgType[], throws: boolean): Type[] => {
    const nativeArgTypes = argTypes.map((argType) =>
        argType.direction !== undefined && argType.callerAllocates !== true ? refT(argType.type) : argType.type,
    );
    if (throws) nativeArgTypes.push(refT(boxedT("GError", "full", "libgobject-2.0.so.0", "g_error_get_type")));
    return nativeArgTypes;
};

/**
 * One argument's self-describing call plan, computed once at bind time so the
 * per-call walks read flags instead of re-deriving the direction taxonomy. A
 * runtime pure-out cell reads no input — `inputIndex` is `-1` for it — every
 * other argument consumes the input at `inputIndex`. `isOutput` marks the
 * arguments that surface in the result tuple (an out/inout that is not folded
 * away as a `consumed` array-length companion).
 */
type ArgPlan = {
    readonly argType: ArgType;
    readonly consumesInput: boolean;
    readonly inputIndex: number;
    readonly isOutput: boolean;
};

/**
 * Classifies each argument once, threading the input cursor so each plan records
 * the input slot it consumes (or `-1` for a runtime pure-out cell, which the
 * native call fills without an input value).
 */
const planArgs = (argTypes: readonly ArgType[]): ArgPlan[] => {
    let inputCursor = 0;
    return argTypes.map((argType) => {
        const consumesInput = !(argType.direction === "out" && argType.callerAllocates !== true);
        const isOutput = argType.direction !== undefined && argType.consumed !== true;
        return { argType, consumesInput, inputIndex: consumesInput ? inputCursor++ : -1, isOutput };
    });
};

/**
 * Maps a call's inputs onto the native values, in C-signature order: a
 * caller-allocated wrapper to its handle, a runtime out- or inout-parameter to a
 * fresh `{ value }` cell (seeded from the input for an inout, which the native
 * call fills), a callback to its {@link wrapHandler}-wrapped value, a plain
 * input straight through.
 */
const toNativeValues = (plans: readonly ArgPlan[], inputs: readonly unknown[]): Value[] =>
    plans.map(({ argType, consumesInput, inputIndex }) => {
        if (argType.callerAllocates === true) {
            const wrapper = inputs[inputIndex];
            return wrapper == null ? wrapper : getHandle(wrapper as object);
        }
        if (argType.direction !== undefined) {
            return { value: consumesInput ? (inputs[inputIndex] as Value) : null };
        }
        if (argType.type.type === "callback") {
            return wrapCallbackValue(argType.type, inputs[inputIndex]);
        }
        return inputs[inputIndex] as Value;
    });

/**
 * Reads the surfaced out-values back after the call, in declaration order: a
 * caller-allocated argument yields the original wrapper it was passed (a fresh
 * wrapper would alias the same boxed pointer), a runtime out- or inout-parameter
 * yields its cell's filled value lifted through {@link wrapValue}. A `consumed`
 * out and a plain input contribute nothing.
 */
const toOutputs = (plans: readonly ArgPlan[], inputs: readonly unknown[], nativeValues: readonly Value[]): unknown[] => {
    const outputs: unknown[] = [];
    plans.forEach(({ argType, inputIndex, isOutput }, index) => {
        if (!isOutput) return;
        outputs.push(
            argType.callerAllocates === true
                ? inputs[inputIndex]
                : wrapValue(argType.type, (nativeValues[index] as Ref).value),
        );
    });
    return outputs;
};

/**
 * Binds a native callable and returns an invoker that marshals its result.
 *
 * @param library - The shared library name.
 * @param symbol - The C function symbol.
 * @param argTypes - The positional arguments in C-signature order.
 * @param returnType - The return value descriptor.
 * @param options - Optional call-shape configuration.
 * @returns An invoker taking the input values and returning the wrapped result
 *   (a lone value, or a `[primary, ...outs]` tuple when out-parameters surface).
 */
// biome-ignore lint/complexity/useMaxParams: mirrors the raw binder's (library, symbol, args, return) shape with added call-shape options
export function fn(
    library: string,
    symbol: string,
    argTypes: readonly ArgType[],
    returnType: Type,
    options: FnOptions = {},
): (...inputs: unknown[]) => unknown {
    const nativeArgTypes = toNativeArgTypes(argTypes, options.throws === true);
    const nativeFn = bind(library, symbol, nativeArgTypes, returnType);
    const hasPrimary = returnType.type !== "void";
    const plans = planArgs(argTypes);

    return (...inputs) => {
        const nativeValues = toNativeValues(plans, inputs);
        const errorCell: Ref | undefined = options.throws === true ? { value: null } : undefined;
        if (errorCell !== undefined) nativeValues.push(errorCell);
        const nativeResult = nativeFn(...nativeValues);
        if (errorCell !== undefined) checkError(errorCell);
        const primary = hasPrimary ? wrapValue(returnType, nativeResult) : undefined;
        return tupleResult(toOutputs(plans, inputs, nativeValues), primary, hasPrimary);
    };
}
