import * as GObject from "@gtkx/gi/gobject";
import { getSignalBaseName, type SignalHandler } from "@gtkx/runtime";
import { toCamelIdentifier } from "@gtkx/utils";
import type { HandlerRecord, SignalTarget } from "./node.js";
import { type TypeInfo, typeInfoFor } from "./metadata.js";

type NotifyBinding = { property: string | null };

const NOTIFY_SIGNAL = "notify";
const NOTIFY_DETAIL_PREFIX = "notify::";
const pendingWrites: (string | null)[] = [];
const canonicalNames: Map<string, string> = new Map();

const isApplyingWrite = (): boolean => pendingWrites.length > 0;
const canonicalName = (property: string): string => canonicalNames.getOrInsertComputed(property, toCamelIdentifier);

const runWrite = <T>(property: string | null, write: () => T): T => {
    pendingWrites.push(property === null ? null : canonicalName(property));

    try {
        return write();
    } finally {
        pendingWrites.pop();
    }
};

const applyWrite = <T>(property: string, write: () => T): T => runWrite(property, write);
const applyMutation = <T>(write: () => T): T => runWrite(null, write);

const notifyBindingFor = (signal: string): NotifyBinding | null => {
    if (signal === NOTIFY_SIGNAL) {
        return { property: null };
    }

    if (!signal.startsWith(NOTIFY_DETAIL_PREFIX)) {
        return null;
    }

    return { property: canonicalName(signal.slice(NOTIFY_DETAIL_PREFIX.length)) };
};

const notifiedProperty = (notify: NotifyBinding, args: unknown[]): string | null => {
    if (notify.property !== null) {
        return notify.property;
    }

    const [pspec] = args;

    return pspec instanceof GObject.ParamSpec ? canonicalName(pspec.getName()) : null;
};

const isSuppressedNotify = (notify: NotifyBinding, args: unknown[]): boolean => {
    const notified = notifiedProperty(notify, args);

    return notified === null || pendingWrites.includes(null) || pendingWrites.includes(notified);
};

const isSuppressed = (record: HandlerRecord, notify: NotifyBinding | null, args: unknown[]): boolean => {
    if (!record.isBlockable || !isApplyingWrite()) {
        return false;
    }

    return notify === null || isSuppressedNotify(notify, args);
};

const isBlockableSignal = (info: TypeInfo, signal: string): boolean =>
    info.userEventSignals.has(getSignalBaseName(signal));

const invokeHandler = (
    target: SignalTarget,
    record: HandlerRecord,
    notify: NotifyBinding | null,
    args: unknown[],
): unknown => {
    const property = notify?.property ?? null;

    return property === null
        ? record.handler(...args, target.object)
        : record.handler(Reflect.get(target.object, property), target.object);
};

const wrapHandler = (target: SignalTarget, record: HandlerRecord, notify: NotifyBinding | null): SignalHandler =>
    (...args: unknown[]): unknown => {
        if (isSuppressed(record, notify, args)) {
            return undefined;
        }

        return target.dispatch(() => invokeHandler(target, record, notify, args));
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

    const isBlockable = isBlockableSignal(typeInfoFor(target.typeName), signal);
    const record: HandlerRecord = { signal, handler, wrapped: (): undefined => undefined, isBlockable };
    record.wrapped = wrapHandler(target, record, notifyBindingFor(signal));
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

export {
    applyMutation,
    applyWrite,
    connectHandler,
    disconnectHandler,
    disconnectAllHandlers,
};
