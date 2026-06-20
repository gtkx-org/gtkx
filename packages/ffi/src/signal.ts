import { type CallbackType, call, type Type as FfiType, type Handle } from "@gtkx/native";
import { GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import { arrayT, biguint64T, bind, objectT, stringT, uint32T, uint64T, voidT } from "./descriptors.js";
import { tupleResult } from "./fn.js";
import type { GType, GTyped } from "./gtype.js";
import {
    fromGvalue,
    inoutBoxedFromFfi,
    newValueFromFfi,
    outBoxedFromFfi,
    outValueFromFfi,
    toGvalue,
    valueGetBoxed,
} from "./gvalue.js";
import { wrapHandler } from "./handler-trampoline.js";
import { getHandle } from "./registry.js";

/**
 * Runtime signal-connection wrapper for generated FFI bindings.
 *
 * Generated classes implement `connect` and `emit` as `switch` statements over
 * their own signals. The `emit` path marshals arguments into `GValue`s and
 * dispatches `g_signal_emitv` entirely in generated code; the `connect` path
 * resolves the per-signal callback and delegates to {@link connectGobjectSignal},
 * the thin wrapper this module provides around the non-introspectable
 * `g_signal_connect_data`.
 */

/** A user-supplied signal handler. */
export type SignalHandler = (...args: unknown[]) => unknown;

/**
 * Strips a `::detail` suffix from a signal name, yielding the bare signal a
 * generated `connect` switch matches on. `"notify::active"` resolves to
 * `"notify"`; a name without a detail is returned unchanged.
 *
 * @param signal - The signal name, optionally carrying a `::detail` suffix
 * @returns The bare signal name
 */
export const signalBaseName = (signal: string): string => {
    const detailIndex = signal.indexOf("::");
    return detailIndex === -1 ? signal : signal.slice(0, detailIndex);
};

const gQuarkFromString = bind(
    "libgobject-2.0.so.0,libglib-2.0.so.0",
    "g_quark_from_string",
    [stringT("borrowed")],
    uint32T,
);

/**
 * Resolves the `GQuark` of a signal name's `::detail` suffix, for forwarding to
 * `g_signal_emitv`. A name without a detail yields `0` — the unrestricted detail
 * that matches every handler — so an undetailed emit behaves as before. The
 * quark is a runtime registration artifact, like a signal id; the generated
 * `emit` switch resolves it per emission and passes it alongside the statically
 * marshalled arguments.
 *
 * @param signal - The signal name, optionally carrying a `::detail` suffix
 * @returns The detail `GQuark`, or `0` when no detail is present
 */
export function signalDetailQuark(signal: string): number {
    const detailIndex = signal.indexOf("::");
    if (detailIndex === -1) return 0;
    return gQuarkFromString(signal.slice(detailIndex + 2)) as number;
}

/**
 * Connects a wrapped handler to a signal through `g_signal_connect_data`.
 *
 * The generated `connect` switch resolves the signal's typed callback
 * descriptor and the handler-marshalling closure, then hands both here. The
 * full detailed signal name (including any `::detail` suffix) is passed through
 * unchanged. The callback expands to the three positional arguments
 * `g_signal_connect_data` takes after the name: the handler's libffi closure,
 * its captured state as the user-data argument, and a destroy notify that
 * releases the handler when the connection is disconnected or the emitter is
 * finalized.
 *
 * @param instance - The emitting object whose native handle receives the connection
 * @param signal - The signal name, optionally carrying a `::detail` suffix
 * @param callback - The signal's FFI callback descriptor
 * @param handler - The wrapped handler invoked with the marshalled arguments
 * @param after - When true, run the handler after the default handler
 * @returns The handler connection id
 */
// biome-ignore lint/complexity/useMaxParams: mirrors the positional arguments g_signal_connect_data takes after the symbol
export function connectGobjectSignal(
    instance: object,
    signal: string,
    callback: CallbackType,
    handler: SignalHandler,
    after: boolean,
): number {
    const wrapped = wrapHandler(handler, callback, "skip");
    return call(
        LIB,
        "g_signal_connect_data",
        [
            { type: objectT("borrowed"), value: getHandle(instance) },
            { type: stringT("borrowed"), value: signal },
            { type: callback, value: wrapped },
            { type: uint32T, value: after ? 1 : 0 },
        ],
        uint64T,
    ) as number;
}

const gSignalEmitv = bind(
    LIB,
    "g_signal_emitv",
    [arrayT(GVALUE_T, "array", "borrowed", { elementSize: GVALUE_SIZE }), uint32T, uint32T, GVALUE_T],
    voidT,
);

const gSignalLookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);

/**
 * How a signal parameter is marshalled into its emission `GValue` beyond a
 * plain input:
 *
 * - `"out"` — a pointer-backed cell the handler writes through; read back after.
 * - `"inout"` — a scalar cell seeded from `value`, read back after.
 * - `"boxedOut"` — a caller-allocated boxed record (`value`) copied into a
 *   `G_TYPE_BOXED` cell the handler fills; the owned copy is read back.
 * - `"boxedInout"` — a boxed record (`value`) shared in place, so the handler's
 *   mutation lands on the caller's wrapper and surfaces through it, not the result.
 */
type EmitArgRole = "out" | "inout" | "boxedOut" | "boxedInout";

/** One argument of a signal emission. A plain input omits `role`. */
export type EmitArg = {
    /** The argument's FFI type descriptor. */
    readonly ffi: FfiType;
    /** How the argument is marshalled beyond a plain input. */
    readonly role?: EmitArgRole;
    /**
     * The input value for an in/inout argument, or the caller-allocated wrapper
     * for a boxed out/inout argument. Omitted for a pure `"out"`.
     */
    readonly value?: unknown;
};

/**
 * Emits a GObject signal and returns its result.
 *
 * Resolves the signal id from the instance's runtime GType and the detail quark
 * from any `::detail` suffix on `sigName`, marshals the emitter and each
 * argument into the `GValue` array `g_signal_emitv` consumes, dispatches, then
 * assembles the result following the tuple convention: a lone return value, a
 * single out-value, or `[primary, ...outs]` when both are present.
 *
 * @param instance - The emitting object.
 * @param sigName - The signal name, optionally carrying a `::detail` suffix.
 * @param args - The signal's argument descriptors, in declaration order.
 * @param returnFfi - The return value's FFI type, or `undefined` for a void signal.
 * @returns The signal's result.
 */
export function emitGobjectSignal(
    instance: object,
    sigName: string,
    args: readonly EmitArg[],
    returnFfi?: FfiType,
): unknown {
    const gtype: GType = (instance as GTyped).__gtype__;
    const signalId = gSignalLookup(signalBaseName(sigName), gtype) as number;
    const detail = signalDetailQuark(sigName);

    const values: Handle[] = [toGvalue(objectT("full"), instance)];
    const reads: (() => unknown)[] = [];
    for (const arg of args) {
        switch (arg.role) {
            case "out": {
                const cell = outValueFromFfi(arg.ffi);
                values.push(cell.value);
                reads.push(cell.read);
                break;
            }
            case "inout": {
                const cell = outValueFromFfi(arg.ffi, arg.value);
                values.push(cell.value);
                reads.push(cell.read);
                break;
            }
            case "boxedOut": {
                const value = outBoxedFromFfi(arg.ffi, arg.value as object);
                values.push(value);
                reads.push(() => valueGetBoxed(value));
                break;
            }
            case "boxedInout":
                values.push(inoutBoxedFromFfi(arg.ffi, arg.value as object));
                break;
            default:
                values.push(toGvalue(arg.ffi, arg.value));
        }
    }

    if (returnFfi !== undefined) {
        const returnValue = newValueFromFfi(returnFfi);
        gSignalEmitv(values, signalId, detail, returnValue);
        return tupleResult(
            reads.map((emit) => emit()),
            fromGvalue(returnValue),
            true,
        );
    }
    gSignalEmitv(values, signalId, detail, undefined);
    return tupleResult(
        reads.map((emit) => emit()),
        undefined,
        false,
    );
}
