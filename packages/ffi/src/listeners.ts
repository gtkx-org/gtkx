import type { SignalHandler } from "./signal.js";

/**
 * An object whose signals can be connected and disconnected by handler id.
 */
type SignalConnectable = {
    connect(signal: string, handler: SignalHandler, after?: boolean): number;
    disconnect(handlerId: number): void;
};

const listenerTable = new WeakMap<object, Map<string, Map<SignalHandler, number>>>();

const findListenerHandlerId = (instance: object, signal: string, handler: SignalHandler): number | undefined =>
    listenerTable.get(instance)?.get(signal)?.get(handler);

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

const untrackListener = (instance: object, signal: string, handler: SignalHandler): void => {
    const bySignal = listenerTable.get(instance);
    const byHandler = bySignal?.get(signal);
    byHandler?.delete(handler);
    if (byHandler?.size === 0) bySignal?.delete(signal);
};

/**
 * Connects a handler to a signal and tracks it so it can later be removed with
 * {@link offSignal}.
 *
 * @param instance The object emitting the signal.
 * @param signal The signal name to connect to.
 * @param handler The callback invoked on each emission.
 * @param after When true, run the handler after the default handler.
 */
export function onSignal(instance: SignalConnectable, signal: string, handler: SignalHandler, after?: boolean): void {
    const handlerId = instance.connect(signal, handler, after);
    trackListener(instance, signal, handler, handlerId);
}

/**
 * Connects a handler that runs at most once, disconnecting itself after the first
 * emission.
 *
 * @param instance The object emitting the signal.
 * @param signal The signal name to connect to.
 * @param handler The callback invoked on the first emission.
 * @param after When true, run the handler after the default handler.
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
 * Disconnects a handler previously connected with {@link onSignal} or
 * {@link onceSignal}. Does nothing if the handler is not currently connected.
 *
 * @param instance The object the handler was connected to.
 * @param signal The signal name the handler was connected to.
 * @param handler The handler to disconnect.
 */
export function offSignal(instance: SignalConnectable, signal: string, handler: SignalHandler): void {
    const handlerId = findListenerHandlerId(instance, signal, handler);
    if (handlerId !== undefined) {
        instance.disconnect(handlerId);
        untrackListener(instance, signal, handler);
    }
}
