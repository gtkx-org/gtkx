import { isSignalHandlerConnected, type SignalHandler } from "./signal.js";

/**
 * The connect and disconnect surface {@link onSignal}, {@link onceSignal} and {@link offSignal}
 * drive on an emitter.
 */
type SignalConnectable = {
    /** Connects a handler to a signal and returns its handler id. */
    connect(signal: string, handler: SignalHandler, isAfter?: boolean): number;
    /** Disconnects the handler previously connected under the given id. */
    disconnect(handlerId: number): void;
};

const listenerTable: WeakMap<object, Map<string, Map<SignalHandler, number>>> = new WeakMap();

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

const untrackHandlerId = (instance: object, signal: string, handlerId: number): void => {
    const bySignal = listenerTable.get(instance);
    const byHandler = bySignal?.get(signal);

    if (byHandler === undefined) {
        return;
    }

    for (const [handler, id] of byHandler) {
        if (id === handlerId) {
            byHandler.delete(handler);
        }
    }

    if (byHandler.size === 0) {
        bySignal?.delete(signal);
    }
};

const hasSignalListener = (instance: object): boolean => (listenerTable.get(instance)?.size ?? 0) > 0;

/**
 * Connects a handler to a signal and tracks it so it can later be removed with
 * {@link offSignal}.
 *
 * @param instance The object emitting the signal.
 * @param signal The signal name to connect to.
 * @param handler The callback invoked on each emission.
 * @param isAfter When true, run the handler after the default handler.
 */
function onSignal(instance: SignalConnectable, signal: string, handler: SignalHandler, isAfter?: boolean): void {
    const handlerId = instance.connect(signal, handler, isAfter);
    trackListener(instance, signal, handler, handlerId);
}

/**
 * Connects a handler that runs at most once, disconnecting itself after the first
 * emission.
 *
 * @param instance The object emitting the signal.
 * @param signal The signal name to connect to.
 * @param handler The callback invoked on the first emission.
 * @param isAfter When true, run the handler after the default handler.
 */
function onceSignal(instance: SignalConnectable, signal: string, handler: SignalHandler, isAfter?: boolean): void {
    let handlerId = 0;

    const wrapped: SignalHandler = (...args) => {
        untrackHandlerId(instance, signal, handlerId);
        instance.disconnect(handlerId);

        return handler(...args);
    };

    handlerId = instance.connect(signal, wrapped, isAfter);
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
function offSignal(instance: SignalConnectable, signal: string, handler: SignalHandler): void {
    const handlerId = findListenerHandlerId(instance, signal, handler);

    if (handlerId === undefined) {
        return;
    }

    untrackHandlerId(instance, signal, handlerId);

    if (!isSignalHandlerConnected(instance, handlerId)) {
        return;
    }

    instance.disconnect(handlerId);
}

export { hasSignalListener, onSignal, onceSignal, offSignal };
