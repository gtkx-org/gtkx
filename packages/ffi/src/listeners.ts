import type { SignalHandler } from "./signal.js";

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

export function onSignal(instance: SignalConnectable, signal: string, handler: SignalHandler, after?: boolean): void {
    const handlerId = instance.connect(signal, handler, after);
    trackListener(instance, signal, handler, handlerId);
}

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

export function offSignal(instance: SignalConnectable, signal: string, handler: SignalHandler): void {
    const handlerId = findListenerHandlerId(instance, signal, handler);
    if (handlerId !== undefined) {
        instance.disconnect(handlerId);
        untrackListener(instance, signal, handler);
    }
}
