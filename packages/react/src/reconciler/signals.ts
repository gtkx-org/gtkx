import type { SignalHandler } from "@gtkx/runtime";
import { camelCase } from "@gtkx/utils";
import { isBlockableSignal, typeInfoOf } from "./metadata.js";
import type { SignalTarget } from "./node.js";

const NOTIFY_DETAIL_PREFIX = "notify::";

const notifyPropertyOf = (signal: string): string | null =>
    signal.startsWith(NOTIFY_DETAIL_PREFIX) ? camelCase(signal.slice(NOTIFY_DETAIL_PREFIX.length)) : null;

let suppressionDepth = 0;

export const beginSuppression = (): void => {
    suppressionDepth += 1;
};

export const endSuppression = (): void => {
    queueMicrotask(() => {
        suppressionDepth -= 1;
    });
};

const isSuppressed = (): boolean => suppressionDepth > 0;

let discreteRun: (fn: () => unknown) => unknown = (fn) => fn();

export const setDiscreteRun = (run: (fn: () => unknown) => unknown): void => {
    discreteRun = run;
};

export const connectHandler = (target: SignalTarget, prop: string, signal: string, handler: SignalHandler): void => {
    const existing = target.handlers.get(prop);
    if (existing !== undefined && existing.signal === signal) {
        existing.handler = handler;
        return;
    }
    if (existing !== undefined) target.object.off(existing.signal, existing.wrapped);
    const blockable = isBlockableSignal(typeInfoOf(target.typeName), signal);
    const notifyProperty = notifyPropertyOf(signal);
    const record = { signal, handler, wrapped: (() => undefined) as SignalHandler, blockable };
    record.wrapped = (...args: unknown[]): unknown => {
        if (record.blockable && isSuppressed()) return undefined;
        return discreteRun(() =>
            notifyProperty !== null
                ? record.handler(Reflect.get(target.object, notifyProperty), target.object)
                : record.handler(...args, target.object),
        );
    };
    target.object.on(signal, record.wrapped);
    target.handlers.set(prop, record);
};

export const disconnectHandler = (target: SignalTarget, prop: string): void => {
    const record = target.handlers.get(prop);
    if (record === undefined) return;
    target.object.off(record.signal, record.wrapped);
    target.handlers.delete(prop);
};

export const disconnectAllHandlers = (target: SignalTarget): void => {
    for (const record of target.handlers.values()) {
        target.object.off(record.signal, record.wrapped);
    }
    target.handlers.clear();
};
