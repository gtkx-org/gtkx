/**
 * The call convention generated bindings dispatch through, exposed as `t.fn`:
 * a thin sugar over `t.bind` that adds out-parameter tupling, `GError` handling,
 * and result wrapping.
 *
 * {@link ffiFn} resolves the callable's argument types once — wrapping each
 * runtime-allocated out- or inout-parameter in a `ref` and appending the
 * implicit `GError**` slot when the callable throws — and binds them through
 * `t.bind`, which owns the reused native argument array and the `call` dispatch.
 * Each invocation maps the input values to the native values `bind` expects,
 * seeding a fresh `{ value }` cell for every runtime-allocated out- or
 * inout-parameter, runs {@link checkError} when the callable throws, then tuples
 * the wrapped primary return with the surfaced out-values. The out-wrapping
 * needs no per-call type analysis: each surfaced value carries the FFI `type`
 * that decides its strategy, plus a pre-resolved class only for the kinds whose
 * descriptor carries no recoverable identity.
 */

import type { Handle, Ref, Type, Value } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import { checkError } from "./error.js";
import { wrapValue } from "./gobject.js";
import { t as descriptors, tupleResult } from "./helpers.js";
import { getHandle } from "./registry.js";

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
export type ValueType = {
    /** The value's FFI type. */
    readonly type: Type;
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
 * receiver included): a {@link ValueType} extended with the argument-slot
 * flags. A plain input omits `direction`.
 */
export type ArgType = ValueType & {
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
export type FfiFnOptions = {
    /**
     * Whether the callable has an implicit trailing `GError**` out-parameter.
     * When `true`, that parameter is appended and {@link checkError} runs after
     * the call, throwing the populated `GError`.
     */
    readonly throws?: boolean;
};

const GERROR_REF: Type = descriptors.ref(
    descriptors.boxed("GError", "full", "libgobject-2.0.so.0", "g_error_get_type"),
);

/**
 * A surfaced out-value held until the native call has run, then assembled into
 * the result tuple. A caller-allocated argument surfaces the `wrapper` it was
 * passed, unchanged; a runtime-allocated out- or inout-parameter surfaces its
 * `cell`'s filled value, lifted through {@link wrapValue} under its FFI `type`
 * (with a pre-resolved `wrapperClass` for the kinds that need one).
 */
type SurfacedOut =
    | { readonly wrapper: unknown }
    | { readonly cell: Ref; readonly type: Type; readonly wrapperClass?: AnyClass };

/**
 * Resolves a caller-allocated argument's wrapper to the native handle passed in
 * its place, leaving a nullish wrapper untouched.
 */
const toHandle = (wrapper: unknown): Value => (wrapper == null ? (wrapper as Value) : getHandle(wrapper as object));

/**
 * Maps a call's input values onto the native values `t.bind` expects, in
 * C-signature order: a caller-allocated wrapper to its handle, a runtime
 * out/inout to a fresh `{ value }` cell (seeded from the input for an inout),
 * and a plain input straight through. Alongside, it collects the
 * {@link SurfacedOut}s a non-`consumed` out- or inout-parameter contributes to
 * the result tuple.
 */
const prepareCall = (
    params: readonly ArgType[],
    inputs: readonly unknown[],
): { readonly values: Value[]; readonly surfaced: SurfacedOut[] } => {
    const values: Value[] = [];
    const surfaced: SurfacedOut[] = [];
    let cursor = 0;
    for (const param of params) {
        const surfaces = param.consumed !== true;
        if (param.callerAllocates === true) {
            const wrapper = inputs[cursor++];
            values.push(toHandle(wrapper));
            if (surfaces) surfaced.push({ wrapper });
        } else if (param.direction !== undefined) {
            const cell: Ref = { value: param.direction === "inout" ? (inputs[cursor++] as Value) : null };
            values.push(cell);
            if (surfaces) surfaced.push({ cell, type: param.type, wrapperClass: param.wrapperClass });
        } else {
            values.push(inputs[cursor++] as Value);
        }
    }
    return { values, surfaced };
};

/**
 * Binds a native callable and returns an invoker that marshals its result.
 *
 * @param library - The shared library name.
 * @param symbol - The C function symbol.
 * @param params - The positional arguments in C-signature order.
 * @param ret - The return value descriptor.
 * @param options - Optional call-shape configuration.
 * @returns An invoker taking the input values and returning the wrapped result
 *   (a lone value, or a `[primary, ...outs]` tuple when out-parameters surface).
 */
// biome-ignore lint/complexity/useMaxParams: mirrors the raw binder's (library, symbol, args, return) shape with added call-shape options
function ffiFn(
    library: string,
    symbol: string,
    params: readonly ArgType[],
    ret: ValueType,
    options: FfiFnOptions = {},
): (...inputs: unknown[]) => unknown {
    const argTypes: { type: Type }[] = params.map((param) => ({
        type:
            param.direction !== undefined && param.callerAllocates !== true ? descriptors.ref(param.type) : param.type,
    }));
    if (options.throws === true) argTypes.push({ type: GERROR_REF });
    const invoke = descriptors.bind(library, symbol, argTypes, ret.type);
    const hasPrimary = ret.type.type !== "void";

    return (...inputs) => {
        const { values, surfaced } = prepareCall(params, inputs);
        const errorCell: { value: Handle | null } | undefined = options.throws === true ? { value: null } : undefined;
        if (errorCell !== undefined) values.push(errorCell);

        const rawResult = invoke(...values);
        if (errorCell !== undefined) checkError(errorCell);

        const primary = hasPrimary ? wrapValue(ret.type, rawResult, ret.wrapperClass) : undefined;
        const outs = surfaced.map((out) =>
            "cell" in out ? wrapValue(out.type, out.cell.value, out.wrapperClass) : out.wrapper,
        );
        return tupleResult(outs, primary, hasPrimary);
    };
}

/**
 * The binding factory the generated `@gtkx/gi` bindings and their override
 * templates call: every FFI type-descriptor helper, plus `fn` — the sugared
 * binder ({@link ffiFn}) that adds out-parameter tupling, `GError` handling, and
 * result wrapping over the native `call`.
 *
 * This is the `t` the package barrel exports. The raw binder the runtime's own
 * type-system and `GValue` marshalling use stays internal and is never surfaced
 * here, so binding code outside the runtime only ever reaches the sugared `t.fn`.
 */
export const t: typeof descriptors & { readonly fn: typeof ffiFn } = Object.freeze({ ...descriptors, fn: ffiFn });
