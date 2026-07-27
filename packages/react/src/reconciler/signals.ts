import { getSignalBaseName, type SignalHandler } from "@gtkx/runtime";
import { camelCase } from "@gtkx/utils";
import type { HandlerRecord, SignalTarget } from "./node.js";
import { type TypeInfo, typeInfoFor } from "./metadata.js";

const NOTIFY_DETAIL_PREFIX = "notify::";
let suppressionDepth = 0;

const getNotifyProperty = (signal: string): string | null =>
    signal.startsWith(NOTIFY_DETAIL_PREFIX) ? camelCase(signal.slice(NOTIFY_DETAIL_PREFIX.length)) : null;

const isBlockableSignal = (info: TypeInfo, signal: string): boolean =>
    info.userEventSignals.has(getSignalBaseName(signal));

const beginSuppression = (): void => {
    suppressionDepth += 1;
};

const endSuppression = (): void => {
    queueMicrotask(() => {
        suppressionDepth -= 1;
    });
};

const isSuppressed = (): boolean => suppressionDepth > 0;

const invokeHandler = (
    target: SignalTarget,
    record: HandlerRecord,
    notifyProperty: string | null,
    args: unknown[],
): unknown =>
    notifyProperty === null
        ? record.handler(...args, target.object)
        : record.handler(Reflect.get(target.object, notifyProperty), target.object);

const wrapHandler = (target: SignalTarget, record: HandlerRecord, notifyProperty: string | null): SignalHandler =>
    (...args: unknown[]): unknown => {
        if (record.blockable && isSuppressed()) {
            return undefined;
        }

        return target.dispatch(() => invokeHandler(target, record, notifyProperty, args));
    };

const connectHandler = (target: SignalTarget, prop: string, signal: string, handler: SignalHandler): void => {
    const existing = target.handlers.get(prop);

    if (existing?.signal === signal) {
        existing.handler = handler;

        return;
    }

    if (existing !== undefined) {
        target.object.off(existing.signal, existing.wrapped);
    }

    const blockable = isBlockableSignal(typeInfoFor(target.typeName), signal);
    const notifyProperty = getNotifyProperty(signal);
    const record: HandlerRecord = { signal, handler, wrapped: () => undefined, blockable };
    record.wrapped = wrapHandler(target, record, notifyProperty);
    target.object.on(signal, record.wrapped);
    target.handlers.set(prop, record);
};

const disconnectHandler = (target: SignalTarget, prop: string): void => {
    const record = target.handlers.get(prop);

    if (record === undefined) {
        return;
    }

    target.object.off(record.signal, record.wrapped);
    target.handlers.delete(prop);
};

const disconnectAllHandlers = (target: SignalTarget): void => {
    for (const record of target.handlers.values()) {
        target.object.off(record.signal, record.wrapped);
    }

    target.handlers.clear();
};

export { beginSuppression, endSuppression, connectHandler, disconnectHandler, disconnectAllHandlers };
