import type { Type as FfiType, TrampolineType } from "@gtkx/native";
import {
    emptyValueFromFfi,
    type GValue,
    getGvalueBoxed,
    inoutBoxedFromFfi,
    outBoxedFromFfi,
    outValueFromFfi,
    valueFromFfi,
    valueToJS,
} from "./gobject.js";
import { type GType, GVALUE_BORROWED, LIBGOBJECT } from "./gtype.js";
import { call, t } from "./helpers.js";
import { type GTyped, getHandle } from "./registry.js";

/**
 * Runtime signal-connection wrapper for generated FFI bindings.
 *
 * Generated classes implement `connect` and `emit` as `switch` statements over
 * their own signals. The `emit` path marshals arguments into `GValue`s and
 * dispatches `g_signal_emitv` entirely in generated code; the `connect` path
 * resolves the per-signal trampoline and delegates to {@link connectGobjectSignal},
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

const g_quark_from_string = t.fn(
    "libgobject-2.0.so.0,libglib-2.0.so.0",
    "g_quark_from_string",
    [{ type: t.string("borrowed") }],
    t.uint32,
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
    return g_quark_from_string(signal.slice(detailIndex + 2)) as number;
}

/**
 * Connects a wrapped handler to a signal through `g_signal_connect_data`.
 *
 * The generated `connect` switch resolves the signal's typed trampoline
 * descriptor and the handler-marshalling closure, then hands both here. The
 * full detailed signal name (including any `::detail` suffix) is passed through
 * unchanged. The trampoline expands to the three positional arguments
 * `g_signal_connect_data` takes after the name: the handler's libffi closure,
 * its captured state as the user-data argument, and a destroy notify that
 * releases the handler when the connection is disconnected or the emitter is
 * finalized.
 *
 * @param instance - The emitting object whose native handle receives the connection
 * @param signal - The signal name, optionally carrying a `::detail` suffix
 * @param trampoline - The signal's FFI trampoline descriptor
 * @param handler - The wrapped handler invoked with the marshalled arguments
 * @param after - When true, run the handler after the default handler
 * @returns The handler connection id
 */
export function connectGobjectSignal(
    instance: object,
    signal: string,
    trampoline: TrampolineType,
    handler: SignalHandler,
    after: boolean,
): number {
    return call(
        LIBGOBJECT,
        "g_signal_connect_data",
        [
            { type: t.object("borrowed"), value: getHandle(instance) },
            { type: t.string("borrowed"), value: signal },
            { type: trampoline, value: handler },
            { type: t.uint32, value: after ? 1 : 0 },
        ],
        t.uint64,
    ) as number;
}

const GVALUE_INLINE: FfiType = t.boxed("GValue", "borrowed", LIBGOBJECT, "g_value_get_type");

const g_signal_emitv = t.fn(
    LIBGOBJECT,
    "g_signal_emitv",
    [
        { type: t.array(GVALUE_INLINE, "array", "borrowed", { elementSize: 24 }) },
        { type: t.uint32 },
        { type: t.uint32 },
        { type: GVALUE_BORROWED },
    ],
    t.void,
);

const g_signal_lookup = t.fn(
    LIBGOBJECT,
    "g_signal_lookup",
    [{ type: t.string("borrowed") }, { type: t.uint64 }],
    t.uint32,
);

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

const assembleResult = (primary: unknown, hasPrimary: boolean, reads: readonly (() => unknown)[]): unknown => {
    const outs = reads.map((read) => read());
    if (hasPrimary) {
        return outs.length === 0 ? primary : [primary, ...outs];
    }
    if (outs.length === 0) return undefined;
    if (outs.length === 1) return outs[0];
    return outs;
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
    const signalId = g_signal_lookup(signalBaseName(sigName), gtype) as number;
    const detail = signalDetailQuark(sigName);

    const values: GValue[] = [valueFromFfi(t.object("full"), instance)];
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
                reads.push(() => getGvalueBoxed(value));
                break;
            }
            case "boxedInout":
                values.push(inoutBoxedFromFfi(arg.ffi, arg.value as object));
                break;
            default:
                values.push(valueFromFfi(arg.ffi, arg.value));
        }
    }

    const handles = values.map(getHandle);
    if (returnFfi !== undefined) {
        const returnValue = emptyValueFromFfi(returnFfi);
        g_signal_emitv(handles, signalId, detail, getHandle(returnValue));
        return assembleResult(valueToJS(returnValue), true, reads);
    }
    g_signal_emitv(handles, signalId, detail, undefined);
    return assembleResult(undefined, false, reads);
}
/** A signal callback tracked by the listener table. */
// biome-ignore lint/suspicious/noExplicitAny: handler signature is per-signal
export type Listener = (...args: any[]) => any;

const listenerTable = new WeakMap<object, Map<string, Map<Listener, number>>>();

/**
 * Records a connected handler so {@link findListenerHandlerId} can resolve it
 * by callback reference later.
 *
 * @param instance - The GObject wrapper the handler is connected on.
 * @param signal - The signal name the handler is connected to.
 * @param handler - The callback reference used as the lookup key.
 * @param handlerId - The handler id returned by `connect`.
 */
export const trackListener = (instance: object, signal: string, handler: Listener, handlerId: number): void => {
    let bySignal = listenerTable.get(instance);
    if (!bySignal) {
        bySignal = new Map();
        listenerTable.set(instance, bySignal);
    }
    let byHandler = bySignal.get(signal);
    if (!byHandler) {
        byHandler = new Map();
        bySignal.set(signal, byHandler);
    }
    byHandler.set(handler, handlerId);
};

/**
 * Resolves the handler id a callback was connected with, or `undefined` when
 * the callback was never tracked (or already untracked).
 *
 * @param instance - The GObject wrapper the handler was connected on.
 * @param signal - The signal name the handler was connected to.
 * @param handler - The callback reference used at connect time.
 * @returns The tracked handler id, or `undefined`.
 */
export const findListenerHandlerId = (instance: object, signal: string, handler: Listener): number | undefined =>
    listenerTable.get(instance)?.get(signal)?.get(handler);

/**
 * Removes a tracked handler association.
 *
 * @param instance - The GObject wrapper the handler was connected on.
 * @param signal - The signal name the handler was connected to.
 * @param handler - The callback reference to untrack.
 */
export const untrackListener = (instance: object, signal: string, handler: Listener): void => {
    const bySignal = listenerTable.get(instance);
    const byHandler = bySignal?.get(signal);
    byHandler?.delete(handler);
    if (byHandler?.size === 0) bySignal?.delete(signal);
};

const g_signal_handler_disconnect = t.fn(
    LIBGOBJECT,
    "g_signal_handler_disconnect",
    [{ type: t.object("borrowed") }, { type: t.uint64 }],
    t.void,
);

/**
 * Disconnects a signal handler by id.
 *
 * @param instance - The GObject wrapper the handler is connected on.
 * @param handlerId - The handler id returned by `connect`/`on`/`once`.
 */
export const disconnectSignalHandler = (instance: object, handlerId: number): void => {
    g_signal_handler_disconnect(getHandle(instance), handlerId);
};
