/**
 * The call convention generated bindings dispatch through, exposed as `t.fn`:
 * a sugar over the native `call` primitive that owns out-parameter tupling,
 * `GError` handling, and result wrapping.
 *
 * A callable's full shape — its argument types, which positions are out- or
 * inout-parameters, whether it throws, and how its result is wrapped — is
 * compiled once by {@link ffiFn} at module load, mirroring the bind-once
 * discipline of the raw binder: the native argument array is built a single time
 * and each parameter becomes a step that refills its slot, so only the per-call
 * out-cells allocate. The returned invoker walks the steps to fill the arguments
 * and collect the surfaced out-readers, runs {@link checkError} when the callable
 * throws, and tuples the wrapped out-values with the wrapped primary return
 * through the descriptor-driven {@link wrapValue}. The wrapping needs no per-call
 * type analysis: the FFI descriptor's `type` decides the strategy and a
 * pre-resolved class is supplied only for the kinds whose descriptor carries no
 * recoverable identity.
 */

import { type Arg, type Handle, call as nativeCall, type Ref, type Type, type Value } from "@gtkx/native";
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

/** A deferred read of one surfaced out-value, evaluated after the native call has written its cell. */
type OutReader = () => unknown;

/** Fills one argument's value from the call inputs and appends any surfaced out-value reader. */
type ArgStep = (inputs: readonly unknown[], outs: OutReader[]) => void;

/**
 * Whether a parameter draws a value from the input list. Every kind does except
 * a runtime-allocated pure out, whose cell the call allocates with no input.
 */
const takesInput = (param: ArgType): boolean => !(param.direction === "out" && param.callerAllocates !== true);

/**
 * Builds the reusable native {@link Arg} for a parameter, allocated once at bind
 * time and refilled per call: an out/inout cell the runtime allocates is wrapped
 * in a `ref` of the inner type; every other argument carries its type directly.
 */
const argFor = (param: ArgType): Arg => {
    if ((param.direction === "out" || param.direction === "inout") && param.callerAllocates !== true) {
        return { type: descriptors.ref(param.type), value: undefined };
    }
    return { type: param.type, value: undefined };
};

/**
 * Compiles a parameter into its per-call {@link ArgStep}, resolving the
 * parameter shape once at bind time so the call path is a straight walk of the
 * compiled steps. A caller-allocated wrapper passes by handle and surfaces
 * itself unwrapped; a pure out allocates a fresh `{ value: null }` cell the
 * native marshaller sizes from the ref's inner type and the callee fills; an
 * inout seeds the cell from its input; a plain input passes straight through. A
 * non-`consumed` out/inout surfaces its read-back wrapped through
 * {@link wrapValue}.
 */
const compileArg = (param: ArgType, arg: Arg, inputIndex: number): ArgStep => {
    const surfaces = param.consumed !== true;
    if (param.callerAllocates === true) {
        return (inputs, outs) => {
            const input = inputs[inputIndex];
            arg.value = input == null ? input : getHandle(input as object);
            if (surfaces) outs.push(() => input);
        };
    }
    const { type, wrapperClass } = param;
    if (param.direction === "out") {
        return (_, outs) => {
            const cell: Ref = { value: null };
            arg.value = cell;
            if (surfaces) outs.push(() => wrapValue(type, cell.value, wrapperClass));
        };
    }
    if (param.direction === "inout") {
        return (inputs, outs) => {
            const cell: Ref = { value: inputs[inputIndex] as Value };
            arg.value = cell;
            if (surfaces) outs.push(() => wrapValue(type, cell.value, wrapperClass));
        };
    }
    return (inputs) => {
        arg.value = inputs[inputIndex] as Value;
    };
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
    const compiled = params.map((param, index) => {
        const arg = argFor(param);
        return { arg, step: compileArg(param, arg, params.slice(0, index).filter(takesInput).length) };
    });
    const args: Arg[] = compiled.map((entry) => entry.arg);
    const errorArg: Arg | undefined = options.throws === true ? { type: GERROR_REF, value: undefined } : undefined;
    if (errorArg !== undefined) args.push(errorArg);
    const hasPrimary = ret.type.type !== "void";

    return (...inputs) => {
        const outs: OutReader[] = [];
        for (const { step } of compiled) step(inputs, outs);
        const errorCell: { value: Handle | null } | undefined = errorArg === undefined ? undefined : { value: null };
        if (errorArg !== undefined) errorArg.value = errorCell;
        const rawResult = nativeCall(library, symbol, args, ret.type);
        if (errorCell !== undefined) checkError(errorCell);
        const primary = hasPrimary ? wrapValue(ret.type, rawResult, ret.wrapperClass) : undefined;
        return tupleResult(
            outs.map((read) => read()),
            primary,
            hasPrimary,
        );
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
