/**
 * EventEmitter-style listener bookkeeping shared by the `GObject.Object`
 * override template the codegen pipeline embeds into the generated
 * `@gtkx/gi/gobject` namespace.
 *
 * The template's `on`/`once`/`off` methods connect through the generated
 * `connect` switch and record the `(signal, handler) → handlerId` association
 * here, so `off` can disconnect by callback reference without the caller
 * holding the handler id.
 */
import { LIBGOBJECT } from "./gtype.js";
import { getHandle } from "./handles.js";
import { t } from "./helpers.js";

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
