/**
 * The call convention generated bindings dispatch through, exposed as `t.fn`:
 * a sugar over the native `call` primitive that owns out-parameter tupling,
 * `GError` handling, and result wrapping.
 *
 * A callable's full shape — its argument types, which positions are out- or
 * inout-parameters, whether it throws, and how its result is wrapped — is
 * captured once by {@link ffiFn} at module load, mirroring the bind-once
 * discipline of the raw binder: the native argument array is built a single time and
 * only the per-call out-cells allocate. The returned invoker takes the input
 * values, splices the out-cells the native marshaller writes through, runs
 * {@link checkError} when the callable throws, and assembles the
 * `[primary, ...outs]` result, wrapping each slot through the descriptor-driven
 * {@link wrapValue}. The wrapping needs no per-call type analysis: the FFI
 * descriptor's `type` decides the strategy and a pre-resolved class is supplied
 * only for the kinds whose descriptor carries no recoverable identity.
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
    /**
     * Whether a nullable input may be omitted: the native marshaller then
     * encodes an absent value as a NULL pointer rather than rejecting it.
     */
    readonly optional?: boolean;
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

type SurfacedOut = { readonly param: ArgType; readonly cell?: Ref; readonly raw?: unknown };

const GERROR_REF: Type = descriptors.ref(
    descriptors.boxed("GError", "full", "libgobject-2.0.so.0", "g_error_get_type"),
);

/**
 * The value a pure-out `{ value }` cell is seeded with before the call. The
 * native marshaller encodes the cell against the ref's inner FFI type, so the
 * seed must be assignable to it: booleans `false`, strings `""`, pointer-shaped
 * values `null`, and every numeric, enum, or flags cell `0`.
 */
const seedForOutCell = (ffiType: Type): Value => {
    switch (ffiType.type) {
        case "boolean":
            return false;
        case "string":
            return "";
        case "gobject":
        case "boxed":
        case "struct":
        case "fundamental":
        case "array":
        case "hashtable":
        case "ref":
        case "trampoline":
        case "void":
            return null;
        default:
            return 0;
    }
};

const assembleResult = (surfaced: readonly SurfacedOut[], primary: unknown, hasPrimary: boolean): unknown =>
    tupleResult(
        surfaced.map((slot) =>
            slot.cell === undefined ? slot.raw : wrapValue(slot.param.type, slot.cell.value, slot.param.wrapperClass),
        ),
        primary,
        hasPrimary,
    );

/**
 * Binds one positional argument's value for a call: coerces a caller-allocated
 * wrapper to its handle, seeds an out-cell, seeds an inout cell from the input,
 * or passes a plain input through — recording any surfaced out and returning how
 * many inputs were consumed (`0` for a pure out, `1` otherwise).
 */
const bindArg = (param: ArgType, arg: Arg, input: unknown, surfaced: SurfacedOut[]): number => {
    if (param.callerAllocates === true) {
        arg.value = input == null ? input : getHandle(input as object);
        if (param.consumed !== true) surfaced.push({ param, raw: input });
        return 1;
    }
    switch (param.direction) {
        case "out": {
            const cell: Ref = { value: seedForOutCell(param.type) };
            arg.value = cell;
            if (param.consumed !== true) surfaced.push({ param, cell });
            return 0;
        }
        case "inout": {
            const cell: Ref = { value: input as Value };
            arg.value = cell;
            if (param.consumed !== true) surfaced.push({ param, cell });
            return 1;
        }
        default:
            arg.value = input as Value;
            return 1;
    }
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
    const args: Arg[] = params.map((param) => {
        if ((param.direction === "out" || param.direction === "inout") && param.callerAllocates !== true) {
            return { type: descriptors.ref(param.type), value: undefined };
        }
        return param.optional === true
            ? { type: param.type, value: undefined, optional: true }
            : { type: param.type, value: undefined };
    });
    const throws = options.throws === true;
    const errorArgIndex = throws ? args.push({ type: GERROR_REF, value: undefined }) - 1 : -1;
    const hasPrimary = ret.type.type !== "void";

    return (...inputs) => {
        let inputIndex = 0;
        const surfaced: SurfacedOut[] = [];
        params.forEach((param, i) => {
            const arg = args[i];
            if (arg !== undefined) inputIndex += bindArg(param, arg, inputs[inputIndex], surfaced);
        });

        let errorCell: { value: Handle | null } | undefined;
        if (errorArgIndex >= 0) {
            errorCell = { value: null };
            const errorArg = args[errorArgIndex];
            if (errorArg !== undefined) errorArg.value = errorCell;
        }

        const rawResult = nativeCall(library, symbol, args, ret.type);

        if (errorCell !== undefined) {
            checkError(errorCell);
        }

        const primary = hasPrimary ? wrapValue(ret.type, rawResult, ret.wrapperClass) : undefined;
        return assembleResult(surfaced, primary, hasPrimary);
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
