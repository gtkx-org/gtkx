import * as GObject from "@gtkx/gi/gobject";
import { getSignalBaseName, offSignal, onSignal, type SignalHandler } from "@gtkx/runtime";
import { getObjectProperty } from "@gtkx/runtime/internal";
import { toCamelIdentifier } from "@gtkx/utils";
import type { Dispatch, HandlerRecord, SignalTarget } from "./node.js";
import { type TypeInfo, typeInfoFor } from "./metadata.js";

type NotifyBinding = { property: string | null };

type PendingWrite = string | null | typeof CHILD_PLACEMENT;

const NOTIFY_SIGNAL = "notify";
const NOTIFY_DETAIL_PREFIX = "notify::";
const CHILD_PLACEMENT = Symbol("child placement");
const pendingWrites: PendingWrite[] = [];
const queuedNotifies: Map<HandlerRecord, Map<string, () => unknown>> = new Map();
const canonicalNames: Map<string, string> = new Map();
let isFlushScheduled = false;

const isApplyingWrite = (): boolean => pendingWrites.length > 0;
const canonicalName = (property: string): string => canonicalNames.getOrInsertComputed(property, toCamelIdentifier);

const runWrite = <T>(pending: PendingWrite, write: () => T): T => {
    pendingWrites.push(typeof pending === "string" ? canonicalName(pending) : pending);

    try {
        return write();
    } finally {
        pendingWrites.pop();
    }
};

const applyWrite = <T>(property: string, write: () => T): T => runWrite(property, write);
const applyMutation = <T>(write: () => T): T => runWrite(null, write);
const applyPlacement = <T>(write: () => T): T => runWrite(CHILD_PLACEMENT, write);

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

const isBlockableSignal = (info: TypeInfo, signal: string): boolean =>
    info.userEventSignals.has(getSignalBaseName(signal));

const invokeHandler = (record: HandlerRecord, notify: NotifyBinding | null, args: unknown[]): unknown => {
    const property = notify?.property ?? null;

    return property === null
        ? record.handler(...args, record.object)
        : record.handler(getObjectProperty(record.object, property), record.object);
};

const queuePlacementNotify = (record: HandlerRecord, property: string, deliver: () => unknown): void => {
    queuedNotifies.getOrInsertComputed(record, () => new Map()).set(property, deliver);
};

const dropQueuedNotify = (record: HandlerRecord, property: string): void => {
    queuedNotifies.get(record)?.delete(property);
};

const flushQueuedNotifies = (): void => {
    isFlushScheduled = false;
    const deliveries = [...queuedNotifies.values()].flatMap((byProperty) => [...byProperty.values()]);
    queuedNotifies.clear();

    for (const deliver of deliveries) {
        deliver();
    }
};

/**
 * Delivers, after the commit's layout effects, the notifications that its child attaches and detaches caused and
 * that no later write in the commit superseded.
 */
const scheduleQueuedNotifies = (): void => {
    if (isFlushScheduled || queuedNotifies.size === 0) {
        return;
    }

    isFlushScheduled = true;
    queueMicrotask(flushQueuedNotifies);
};

const handleNotify = (
    record: HandlerRecord,
    notify: NotifyBinding,
    args: unknown[],
    deliver: () => unknown,
): unknown => {
    const notified = notifiedProperty(notify, args);

    if (notified === null) {
        return undefined;
    }

    if (pendingWrites.includes(notified)) {
        dropQueuedNotify(record, notified);

        return undefined;
    }

    if (pendingWrites.includes(null)) {
        return undefined;
    }

    if (pendingWrites.includes(CHILD_PLACEMENT)) {
        queuePlacementNotify(record, notified, deliver);

        return undefined;
    }

    return deliver();
};

const wrapHandler =
    (reference: WeakRef<HandlerRecord>, dispatch: Dispatch, notify: NotifyBinding | null): SignalHandler =>
    (...args: unknown[]): unknown => {
        const record = reference.deref();

        if (record === undefined) {
            return undefined;
        }

        const deliver = (): unknown => dispatch(() => invokeHandler(record, notify, args));

        if (!record.isBlockable || !isApplyingWrite()) {
            return deliver();
        }

        return notify === null ? undefined : handleNotify(record, notify, args, deliver);
    };

const connectHandler = (target: SignalTarget, prop: string, signal: string, handler: SignalHandler): void => {
    const existing = target.handlers.get(prop);

    if (existing?.signal === signal && existing.object === target.object) {
        existing.handler = handler;

        return;
    }

    if (existing !== undefined) {
        offSignal(existing.object, existing.signal, existing.wrapped);
        queuedNotifies.delete(existing);
    }

    const isBlockable = isBlockableSignal(typeInfoFor(target.typeName), signal);

    const record: HandlerRecord = {
        signal,
        handler,
        wrapped: (): undefined => undefined,
        isBlockable,
        object: target.object,
    };

    record.wrapped = wrapHandler(new WeakRef(record), target.dispatch, notifyBindingFor(signal));
    onSignal(target.object, signal, record.wrapped);
    target.handlers.set(prop, record);
};

const disconnectHandler = (target: SignalTarget, prop: string): void => {
    const record = target.handlers.get(prop);

    if (record === undefined) {
        return;
    }

    offSignal(record.object, record.signal, record.wrapped);
    queuedNotifies.delete(record);
    target.handlers.delete(prop);
};

const disconnectAllHandlers = (target: SignalTarget): void => {
    for (const record of target.handlers.values()) {
        offSignal(record.object, record.signal, record.wrapped);
        queuedNotifies.delete(record);
    }

    target.handlers.clear();
};

export {
    applyMutation,
    applyPlacement,
    applyWrite,
    connectHandler,
    disconnectHandler,
    disconnectAllHandlers,
    isApplyingWrite,
    scheduleQueuedNotifies,
};
