/**
 * Runtime signal-connection wrapper for generated FFI bindings.
 *
 * Generated classes implement `connect` and `emit` as `switch` statements over
 * their own signals. The `emit` path marshals arguments into `GValue`s and
 * dispatches `g_signal_emitv` entirely in generated code; the `connect` path
 * resolves the per-signal trampoline and delegates to {@link connectSignal},
 * the thin wrapper this module provides around the non-introspectable
 * `g_signal_connect_data`.
 */

import type { Type } from "@gtkx/native";
import { LIBGOBJECT } from "./gtype.js";
import { getHandle } from "./handles.js";
import { call, t } from "./helpers.js";

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
    return call(
        "libgobject-2.0.so.0,libglib-2.0.so.0",
        "g_quark_from_string",
        [{ type: t.string("borrowed"), value: signal.slice(detailIndex + 2) }],
        t.uint32,
    ) as number;
}

/**
 * Connects a wrapped handler to a signal through `g_signal_connect_data`.
 *
 * A thin wrapper around the non-introspectable `g_signal_connect_data`: the
 * generated `connect` switch resolves the signal's typed trampoline and the
 * handler-marshalling closure, then hands both here. The full detailed signal
 * name (including any `::detail` suffix) is passed through unchanged.
 *
 * @param instance - The emitting object whose native handle receives the connection
 * @param signal - The signal name, optionally carrying a `::detail` suffix
 * @param trampoline - The signal's FFI trampoline descriptor
 * @param handler - The wrapped handler invoked with the marshalled arguments
 * @param after - When true, run the handler after the default handler
 * @returns The handler connection id
 */
// biome-ignore lint/complexity/useMaxParams: the wrapper mirrors g_signal_connect_data's positional arguments
export function connectSignal(
    instance: object,
    signal: string,
    trampoline: Type,
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
