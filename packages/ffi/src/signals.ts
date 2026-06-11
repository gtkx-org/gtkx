/**
 * Runtime signal-connection wrapper for generated FFI bindings.
 *
 * Generated classes implement `connect` and `emit` as `switch` statements over
 * their own signals. The `emit` path marshals arguments into `GValue`s and
 * dispatches `g_signal_emitv` entirely in generated code; the `connect` path
 * resolves the per-signal trampoline and delegates to {@link connectSignal},
 * the thin wrapper this module provides around the native `GClosure` connect
 * primitive.
 */

import type { TrampolineType } from "@gtkx/native";
import { connectSignalClosure } from "@gtkx/native";
import { getHandle } from "./handles.js";
import { t } from "./helpers.js";

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
 * Connects a wrapped handler to a signal through a native `GClosure`.
 *
 * The generated `connect` switch resolves the signal's typed trampoline
 * descriptor and the handler-marshalling closure, then hands both here. The
 * full detailed signal name (including any `::detail` suffix) is passed
 * through unchanged; the trampoline's user-data slot is dropped, since a
 * closure connection carries its state in the `GClosure` itself. GLib's
 * marshaller delivers the parameters as typed `GValue`s and takes ownership
 * of the handler's return through the signal's return `GValue`, and
 * disconnecting (or finalizing the emitter) releases the handler
 * automatically.
 *
 * @param instance - The emitting object whose native handle receives the connection
 * @param signal - The signal name, optionally carrying a `::detail` suffix
 * @param trampoline - The signal's FFI trampoline descriptor
 * @param handler - The wrapped handler invoked with the marshalled arguments
 * @param after - When true, run the handler after the default handler
 * @returns The handler connection id
 */
// biome-ignore lint/complexity/useMaxParams: the wrapper mirrors the native connect primitive's positional arguments
export function connectSignal(
    instance: object,
    signal: string,
    trampoline: TrampolineType,
    handler: SignalHandler,
    after: boolean,
): number {
    const closureArgTypes = trampoline.argTypes.filter((_, index) => index !== trampoline.userDataIndex);
    return connectSignalClosure(getHandle(instance), signal, closureArgTypes, trampoline.returnType, handler, after);
}
