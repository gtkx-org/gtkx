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
import { GVALUE_BORROWED, GVALUE_SIZE, LIBGOBJECT } from "./gtype.js";
import { getHandle } from "./handles.js";
import { call, t } from "./helpers.js";

const GVALUE_ARRAY = t.array(GVALUE_BORROWED, "array", "borrowed", { elementSize: GVALUE_SIZE });

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

/**
 * Emits a signal through `g_signal_emitv`, dispatching the pre-built
 * instance-and-parameter `GValue`s and writing the emission's accumulated
 * return into `returnValue` when one is supplied.
 *
 * The `return_value` slot is passed as a borrowed `GValue` so the emission
 * writes into the caller's value in place — the GIR marks it `transfer="full"`,
 * which the generated binding would copy, discarding the result. Out-parameter
 * cells in `instanceAndParams` carry pointers the default handler writes
 * through, so the generated `emit` reads them back after this returns.
 *
 * @param instanceAndParams - The emitting instance value followed by each parameter value.
 * @param signalId - The numeric signal id from `g_signal_lookup`.
 * @param detail - The detail quark, or `0` for an undetailed signal.
 * @param returnValue - An initialized `GValue` to receive the return, or `null`.
 */
export function emitSignalv(
    instanceAndParams: readonly object[],
    signalId: number,
    detail: number,
    returnValue: object | null = null,
): void {
    call(
        LIBGOBJECT,
        "g_signal_emitv",
        [
            { type: GVALUE_ARRAY, value: instanceAndParams.map(getHandle) },
            { type: t.uint32, value: signalId },
            { type: t.uint32, value: detail },
            { type: GVALUE_BORROWED, value: returnValue === null ? null : getHandle(returnValue) },
        ],
        t.void,
    );
}
