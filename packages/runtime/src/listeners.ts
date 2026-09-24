import {
    canonicalDetailedSignalName,
    connectSignalByName,
    disconnectSignal,
    type SignalHandler,
    type SignalHandlerId,
    trackSignalDisconnect,
} from "./signal.js";

const listenerTable: WeakMap<object, Map<string, Map<SignalHandler, SignalHandlerId[]>>> = new WeakMap();

const findListenerHandlerId = (instance: object, signal: string, handler: SignalHandler): SignalHandlerId | undefined =>
    listenerTable.get(instance)?.get(canonicalDetailedSignalName(signal))?.get(handler)?.at(-1);

const trackListener = (instance: object, signal: string, handler: SignalHandler, handlerId: SignalHandlerId): void => {
    const key = canonicalDetailedSignalName(signal);
    let bySignal = listenerTable.get(instance);

    if (!bySignal) {
        bySignal = new Map();
        listenerTable.set(instance, bySignal);
    }

    let byHandler = bySignal.get(key);

    if (!byHandler) {
        byHandler = new Map();
        bySignal.set(key, byHandler);
    }

    let handlerIds = byHandler.get(handler);

    if (!handlerIds) {
        handlerIds = [];
        byHandler.set(handler, handlerIds);
    }

    handlerIds.push(handlerId);
    trackSignalDisconnect(instance, handlerId, untrackHandlerId);
};

const removeTrackedHandlerId = (handlerIds: SignalHandlerId[], handlerId: SignalHandlerId): number => {
    const index = handlerIds.lastIndexOf(handlerId);

    if (index !== -1) {
        handlerIds.splice(index, 1);
    }

    return handlerIds.length;
};

const removeHandlerIdFrom = (
    byHandler: Map<SignalHandler, SignalHandlerId[]>,
    handlerId: SignalHandlerId,
): void => {
    for (const [handler, handlerIds] of byHandler) {
        if (removeTrackedHandlerId(handlerIds, handlerId) === 0) {
            byHandler.delete(handler);
        }
    }
};

function untrackHandlerId(instance: object, handlerId: SignalHandlerId): void {
    const bySignal = listenerTable.get(instance);

    if (bySignal === undefined) {
        return;
    }

    for (const [signal, byHandler] of bySignal) {
        removeHandlerIdFrom(byHandler, handlerId);

        if (byHandler.size === 0) {
            bySignal.delete(signal);
        }
    }

    if (bySignal.size === 0) {
        listenerTable.delete(instance);
    }
}

/**
 * Connects a handler to a signal and tracks it so it can later be removed with
 * {@link offSignal}.
 *
 * @param instance The object emitting the signal.
 * @param signal The signal name to connect to.
 * @param handler The callback invoked on each emission.
 * @param isAfter When true, run the handler after the default handler.
 */
function onSignal(instance: object, signal: string, handler: SignalHandler, isAfter?: boolean): void {
    const handlerId = connectSignalByName(instance, signal, handler, isAfter);
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
function onceSignal(instance: object, signal: string, handler: SignalHandler, isAfter?: boolean): void {
    let handlerId = 0n;

    const wrapped: SignalHandler = (...args) => {
        untrackHandlerId(instance, handlerId);
        disconnectSignal(instance, handlerId);

        return handler(...args);
    };

    handlerId = connectSignalByName(instance, signal, wrapped, isAfter);
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
function offSignal(instance: object, signal: string, handler: SignalHandler): void {
    const handlerId = findListenerHandlerId(instance, signal, handler);

    if (handlerId === undefined) {
        return;
    }

    untrackHandlerId(instance, handlerId);
    disconnectSignal(instance, handlerId);
}

export { onSignal, onceSignal, offSignal };
