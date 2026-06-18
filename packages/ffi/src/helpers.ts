/**
 * The call convention generated bindings dispatch through, exposed as `t.fn`:
 * a thin sugar over `t.bind` that adds out-parameter tupling, `GError` handling,
 * and result wrapping.
 *
 * {@link fn} resolves the callable's native argument types once — wrapping each
 * runtime-allocated out- or inout-parameter in a `ref` and appending the
 * implicit `GError**` slot when the callable throws — and binds them through
 * `t.bind`, which owns the reused native argument array and the `call` dispatch.
 * Each invocation maps its inputs to the native values `bind` expects — a fresh
 * `{ value }` cell for a runtime-allocated out- or inout-parameter, the handle
 * for a caller-allocated wrapper, the value itself otherwise — runs
 * {@link checkError} when the callable throws, then tuples the wrapped primary
 * return with the surfaced out-values read back from those same cells. A
 * caller-allocated out surfaces the wrapper it was passed, unchanged; every
 * other surfaced value is lifted through {@link wrapValue} under its FFI `type`.
 */

import type { Type as NativeType, Ref, Value } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { t as descriptors, tupleResult } from "./descriptors.js";
import { checkError } from "./error.js";
import { getHandle } from "./registry.js";
import { wrapValue } from "./wrap-value.js";

/**
 * The out-direction an argument participates in beyond a plain input:
 *
 * - `"out"` — the native layer writes the result through a `{ value }` cell
 *   this call allocates; the read-back value joins the result tuple.
 * - `"inout"` — a scalar cell seeded from the input value, read back after.
 *
 * Either direction may pair with {@link ArgType.callerAllocates}, which
 * passes the caller's own wrapper by handle in place of allocating a cell.
 */
type ArgDirection = "out" | "inout";

/**
 * An FFI value's marshalling identity: its type descriptor paired with the
 * wrapper class its produced value is lifted into. Carried by a callable's
 * return and by each out-direction argument — anywhere a native value is read
 * back and wrapped. A `t.void` type denotes no value.
 */
export type Type = {
    /** The value's FFI type. */
    readonly type: NativeType;
    /**
     * The wrapper class the value is lifted into, supplied only for the kinds
     * whose FFI descriptor carries no recoverable identity — a plain struct or a
     * GType-less fundamental. Every other kind self-resolves its class from the
     * descriptor's runtime `GType`, leaving this undefined.
     */
    readonly wrapperClass?: AnyClass;
};

/**
 * One positional argument of a callable, in C-signature order (the instance
 * receiver included): a {@link Type} extended with the argument-slot
 * flags. A plain input omits `direction`.
 */
export type ArgType = Type & {
    /** The out/inout direction the argument participates in beyond a plain input. */
    readonly direction?: ArgDirection;
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
 * Resolves the native argument types `t.bind` is bound with: a runtime-allocated
 * out- or inout-parameter wrapped in a `ref` so the native layer writes through
 * it, the implicit trailing `GError**` ref appended when the callable throws,
 * every other argument's type passed through unchanged.
 */
const toNativeArgTypes = (argTypes: readonly ArgType[], throws: boolean): NativeType[] => {
    const nativeArgTypes = argTypes.map((argType) =>
        argType.direction !== undefined && argType.callerAllocates !== true
            ? descriptors.ref(argType.type)
            : argType.type,
    );
    if (throws)
        nativeArgTypes.push(
            descriptors.ref(descriptors.boxed("GError", "full", "libgobject-2.0.so.0", "g_error_get_type")),
        );
    return nativeArgTypes;
};

/**
 * Maps a call's inputs onto the native values, in C-signature order: a
 * caller-allocated wrapper to its handle, a runtime out- or inout-parameter to a
 * fresh `{ value }` cell (seeded from the input for an inout, which the native
 * call fills), a plain input straight through.
 */
const toNativeValues = (argTypes: readonly ArgType[], inputs: readonly unknown[]): Value[] => {
    const nativeValues: Value[] = [];
    let cursor = 0;
    for (const argType of argTypes) {
        if (argType.callerAllocates === true) {
            const wrapper = inputs[cursor++];
            nativeValues.push(wrapper == null ? wrapper : getHandle(wrapper as object));
        } else if (argType.direction !== undefined) {
            nativeValues.push({ value: argType.direction === "inout" ? (inputs[cursor++] as Value) : null });
        } else {
            nativeValues.push(inputs[cursor++] as Value);
        }
    }
    return nativeValues;
};

/**
 * Reads the surfaced out-values back after the call, in declaration order: a
 * caller-allocated argument yields the original wrapper it was passed (a fresh
 * wrapper would alias the same boxed pointer), a runtime out- or inout-parameter
 * yields its cell's filled value lifted through {@link wrapValue}. A `consumed`
 * out and a plain input contribute nothing.
 */
const toOutputs = (
    argTypes: readonly ArgType[],
    inputs: readonly unknown[],
    nativeValues: readonly Value[],
): unknown[] => {
    const outputs: unknown[] = [];
    let cursor = 0;
    argTypes.forEach((argType, index) => {
        const consumesInput = !(argType.direction === "out" && argType.callerAllocates !== true);
        const input = consumesInput ? inputs[cursor++] : undefined;
        if (argType.direction === undefined || argType.consumed === true) return;
        outputs.push(
            argType.callerAllocates === true
                ? input
                : wrapValue(argType.type, (nativeValues[index] as Ref).value, argType.wrapperClass),
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
function fn(
    library: string,
    symbol: string,
    argTypes: readonly ArgType[],
    returnType: Type,
    options: FnOptions = {},
): (...inputs: unknown[]) => unknown {
    const nativeArgTypes = toNativeArgTypes(argTypes, options.throws === true);
    const nativeFn = descriptors.bind(library, symbol, nativeArgTypes, returnType.type);
    const hasPrimary = returnType.type.type !== "void";

    return (...inputs) => {
        const nativeValues = toNativeValues(argTypes, inputs);
        const errorCell: Ref | undefined = options.throws === true ? { value: null } : undefined;
        if (errorCell !== undefined) nativeValues.push(errorCell);
        const nativeResult = nativeFn(...nativeValues);
        if (errorCell !== undefined) checkError(errorCell);
        const primary = hasPrimary ? wrapValue(returnType.type, nativeResult, returnType.wrapperClass) : undefined;
        return tupleResult(toOutputs(argTypes, inputs, nativeValues), primary, hasPrimary);
    };
}

/**
 * The binding factory the generated `@gtkx/gi` bindings and their override
 * templates call: every FFI type-descriptor helper, plus `fn` — the sugared
 * binder ({@link fn}) that adds out-parameter tupling, `GError` handling, and
 * result wrapping over the native `call`.
 *
 * This is the `t` the package barrel exports. The raw binder the runtime's own
 * type-system and `GValue` marshalling use stays internal and is never surfaced
 * here, so binding code outside the runtime only ever reaches the sugared `t.fn`.
 */
export const t: typeof descriptors & { fn: typeof fn } = Object.freeze({ ...descriptors, fn });
