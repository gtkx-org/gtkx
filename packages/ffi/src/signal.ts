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
import { call, t, tupleResult } from "./helpers.js";
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

/**
 * The connection surface the EventEmitter-style helpers drive: the per-class
 * `connect` switch and the `disconnect` primitive every generated GObject
 * carries on its prototype.
 */
interface SignalConnectable {
    connect(signal: string, handler: SignalHandler, after?: boolean): number;
    disconnect(handlerId: number): void;
}

const listenerTable = new WeakMap<object, Map<string, Map<SignalHandler, number>>>();

const trackListener = (instance: object, signal: string, handler: SignalHandler, handlerId: number): void => {
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

const findListenerHandlerId = (instance: object, signal: string, handler: SignalHandler): number | undefined =>
    listenerTable.get(instance)?.get(signal)?.get(handler);

const untrackListener = (instance: object, signal: string, handler: SignalHandler): void => {
    const bySignal = listenerTable.get(instance);
    const byHandler = bySignal?.get(signal);
    byHandler?.delete(handler);
    if (byHandler?.size === 0) bySignal?.delete(signal);
};

/**
 * Connects `handler` to `signal`, tracking the connection by callback reference
 * so {@link offSignal} can later disconnect it without the handler id. Backs the
 * EventEmitter-style `on` method every generated GObject carries.
 *
 * @param instance - The emitting GObject.
 * @param signal - The signal name, optionally carrying a `::detail` suffix.
 * @param handler - The callback to invoke on each emission.
 * @param after - When true, run the handler after the default handler.
 * @example
 * ```ts
 * onSignal(button, "clicked", () => console.log("clicked"));
 * ```
 */
export function onSignal(instance: SignalConnectable, signal: string, handler: SignalHandler, after?: boolean): void {
    const handlerId = instance.connect(signal, handler, after);
    trackListener(instance, signal, handler, handlerId);
}

/**
 * Connects `handler` to `signal` for a single emission, disconnecting and
 * untracking it as it fires. Backs the `once` method every generated GObject
 * carries.
 *
 * @param instance - The emitting GObject.
 * @param signal - The signal name, optionally carrying a `::detail` suffix.
 * @param handler - The callback to invoke once, on the next emission.
 * @param after - When true, run the handler after the default handler.
 * @example
 * ```ts
 * onceSignal(dialog, "response", (id) => console.log("answered", id));
 * ```
 */
export function onceSignal(instance: SignalConnectable, signal: string, handler: SignalHandler, after?: boolean): void {
    let handlerId = 0;
    const wrapped: SignalHandler = (...args) => {
        untrackListener(instance, signal, wrapped);
        untrackListener(instance, signal, handler);
        instance.disconnect(handlerId);
        return handler(...args);
    };
    handlerId = instance.connect(signal, wrapped, after);
    trackListener(instance, signal, wrapped, handlerId);
    trackListener(instance, signal, handler, handlerId);
}

/**
 * Disconnects a handler previously registered through {@link onSignal} or
 * {@link onceSignal}, located by its callback reference. Backs the `off` method
 * every generated GObject carries; a handler that was never registered is
 * ignored.
 *
 * @param instance - The emitting GObject.
 * @param signal - The signal name the handler was registered under.
 * @param handler - The exact callback reference passed to `on`/`once`.
 * @example
 * ```ts
 * offSignal(button, "clicked", onClicked);
 * ```
 */
export function offSignal(instance: SignalConnectable, signal: string, handler: SignalHandler): void {
    const handlerId = findListenerHandlerId(instance, signal, handler);
    if (handlerId !== undefined) {
        instance.disconnect(handlerId);
        untrackListener(instance, signal, handler);
    }
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

const assembleResult = (primary: unknown, hasPrimary: boolean, reads: readonly (() => unknown)[]): unknown =>
    tupleResult(
        reads.map((read) => read()),
        primary,
        hasPrimary,
    );

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
