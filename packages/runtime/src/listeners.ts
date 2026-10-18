import {
    connectSignalByName,
    disconnectSignal,
    findSignalListener,
    type SignalHandler,
    trackSignalListener,
} from "./signal.js";

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
    trackSignalListener(instance, handlerId, handler);
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
        disconnectSignal(instance, handlerId);

        return handler(...args);
    };

    handlerId = connectSignalByName(instance, signal, wrapped, isAfter);
    trackSignalListener(instance, handlerId, handler);
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
    const handlerId = findSignalListener(instance, signal, handler);

    if (handlerId === undefined) {
        return;
    }

    disconnectSignal(instance, handlerId);
}

export { onSignal, onceSignal, offSignal };
