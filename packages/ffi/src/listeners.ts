import type { SignalHandler } from "./signal.js";

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
