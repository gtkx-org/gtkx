import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import type { TypedClass } from "./type.js";
import { type Arg, isCallerAllocatedArg, isInoutArg, isOutputArg } from "./arg.js";
import { bind, createBindCache } from "./bind.js";
import { wrapCallback } from "./callback.js";
import {
    arrayT,
    biguint64T,
    booleanT,
    type CallbackDescriptor,
    objectT,
    stringT,
    uint32T,
    uint64T,
    voidT,
} from "./descriptors.js";
import { LIB, VALUE_SIZE, VALUE_T } from "./library.js";
import { getHandle } from "./registry.js";
import { packTupleResult } from "./tuple.js";
import {
    fromValue,
    getBoxedValue,
    inoutValueForBoxedDescriptor,
    newValueForDescriptor,
    outValueForBoxedDescriptor,
    outValueForDescriptor,
    toValue,
} from "./value.js";

/** Function invoked when a connected GObject signal is emitted. */
type SignalHandler = (...args: unknown[]) => unknown;

/** The marshalling and handler that make up a single signal connection. */
type SignalConnectSpec = {
    /**
     * Marshalling for the emission, whose `argDescriptors` lead with the emitter and include the
     * closure's user data slot.
     */
    callback: CallbackDescriptor;
    /** Called on each emission with the signal's own arguments, without the leading emitter. */
    handler: SignalHandler;
    /** When true, run the handler after the class's default handler instead of before it. */
    isAfter: boolean;
};

type EmitValues = {
    values: ExternalObject<Handle>[];
    reads: (() => unknown)[];
};

/** One argument of a signal emission: how to marshal it, plus the value to marshal. */
type EmitArg = Arg & {
    /**
     * The value to pass for an input or inout argument, or the caller-allocated storage to fill for
     * a caller-allocated output argument; omitted for a plain output argument.
     */
    value?: unknown;
};

const connectCache = createBindCache();
const connectionTable: WeakMap<object, Map<string, Set<number>>> = new WeakMap();
const gQuarkFromString = bind(LIB, "g_quark_from_string", [stringT("borrowed")], uint32T);
const gSignalLookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);

const gSignalEmitv = bind(
    LIB,
    "g_signal_emitv",
    [arrayT(VALUE_T, "array", "borrowed", { elementSize: VALUE_SIZE }), uint32T, uint32T, VALUE_T],
    voidT,
);

const gSignalHandlerIsConnected = bind(
    LIB,
    "g_signal_handler_is_connected",
    [objectT("borrowed"), uint64T],
    booleanT,
);

const gSignalHandlerDisconnect = bind(LIB, "g_signal_handler_disconnect", [objectT("borrowed"), uint64T], voidT);

/** Returns the signal name without its detail suffix (the part after `::`). */
const getSignalBaseName = (signal: string): string => {
    const detailIndex = signal.indexOf("::");

    return detailIndex === -1 ? signal : signal.slice(0, detailIndex);
};

function getSignalDetailQuark(signal: string): number {
    const detailIndex = signal.indexOf("::");

    if (detailIndex === -1) {
        return 0;
    }

    return gQuarkFromString(signal.slice(detailIndex + 2)) as number;
}

const isSignalHandlerConnected = (instance: object, handlerId: number): boolean =>
    gSignalHandlerIsConnected(getHandle(instance), handlerId) as boolean;

const trackConnection = (instance: object, signal: string, handlerId: number): void => {
    let bySignal = connectionTable.get(instance);

    if (!bySignal) {
        bySignal = new Map();
        connectionTable.set(instance, bySignal);
    }

    let handlerIds = bySignal.get(signal);

    if (!handlerIds) {
        handlerIds = new Set();
        bySignal.set(signal, handlerIds);
    }

    handlerIds.add(handlerId);
};

const untrackConnection = (instance: object, handlerId: number): void => {
    const bySignal = connectionTable.get(instance);

    if (bySignal === undefined) {
        return;
    }

    for (const [name, handlerIds] of bySignal) {
        handlerIds.delete(handlerId);

        if (handlerIds.size === 0) {
            bySignal.delete(name);
        }
    }
};

/**
 * Disconnects the handler an instance connected under the given id, and forgets the connection.
 * @param instance Emitter the handler was connected to.
 * @param handlerId Id {@link connectSignal} returned for the handler.
 */
const disconnectSignal = (instance: object, handlerId: number): void => {
    untrackConnection(instance, handlerId);
    gSignalHandlerDisconnect(getHandle(instance), handlerId);
};

const hasLiveConnection = (instance: object, handlerIds: Set<number>): boolean => {
    let isLive = false;

    for (const handlerId of handlerIds) {
        if (isSignalHandlerConnected(instance, handlerId)) {
            isLive = true;
        } else {
            handlerIds.delete(handlerId);
        }
    }

    return isLive;
};

function hasSignalListener(instance: object, signals?: string[]): boolean {
    const bySignal = connectionTable.get(instance);

    if (!bySignal) {
        return false;
    }

    const names =
        signals === undefined ? bySignal.keys().toArray() : signals.map((signal) => getSignalBaseName(signal));

    return names.some((name) => {
        const handlerIds = bySignal.get(name);

        return handlerIds !== undefined && hasLiveConnection(instance, handlerIds);
    });
}

const getSignalId = (instance: object, signal: string): number => {
    const type: bigint = (instance as TypedClass).__type__;

    return gSignalLookup(getSignalBaseName(signal), type) as number;
};

function connectBind(type: bigint, signal: string, callback: CallbackDescriptor): (...values: unknown[]) => unknown {
    const key = `${String(type)}\0${getSignalBaseName(signal)}`;

    return connectCache(
        key,
        LIB,
        "g_signal_connect_data",
        [objectT("borrowed"), stringT("borrowed"), callback, uint32T],
        uint64T,
    );
}

/**
 * Connects a handler to a GObject signal on an instance and returns the handler id.
 * @param instance Emitter to connect to.
 * @param signal Signal name, optionally including a `::detail` suffix.
 * @param spec Callback descriptor, handler function, and whether to run after the default handler.
 */
function connectSignal(instance: object, signal: string, spec: SignalConnectSpec): number {
    const { callback, handler, isAfter } = spec;
    const wrapped = wrapCallback(handler, callback, "signal");
    const type: bigint = (instance as TypedClass).__type__;
    const connect = connectBind(type, signal, callback);
    const handlerId = connect(getHandle(instance), signal, wrapped, isAfter ? 1 : 0) as number;
    trackConnection(instance, getSignalBaseName(signal), handlerId);

    return handlerId;
}

const createEmitValue = (arg: EmitArg): { value: ExternalObject<Handle>; read?: () => unknown } => {
    if (!isOutputArg(arg)) {
        return { value: toValue(arg.type, arg.value) };
    }

    if (isCallerAllocatedArg(arg)) {
        if (isInoutArg(arg)) {
            return { value: inoutValueForBoxedDescriptor(arg.type, arg.value as object) };
        }

        const value = outValueForBoxedDescriptor(arg.type, arg.value as object);

        return { value, read: () => getBoxedValue(value) };
    }

    return isInoutArg(arg) ? outValueForDescriptor(arg.type, arg.value) : outValueForDescriptor(arg.type);
};

const collectEmitValues = (instance: object, args: EmitArg[]): EmitValues => {
    const collected: EmitValues = { values: [toValue(objectT("full"), instance)], reads: [] };

    for (const arg of args) {
        const { value, read } = createEmitValue(arg);
        collected.values.push(value);

        if (read) {
            collected.reads.push(read);
        }
    }

    return collected;
};

const readEmitOutputs = (reads: (() => unknown)[]): unknown[] => reads.map((read) => read());

/**
 * Emits a signal on an instance with the given arguments and returns its result
 * combined with any output-argument values.
 * @param instance Emitter to emit the signal on.
 * @param signal Signal name, optionally including a `::detail` suffix.
 * @param args Arguments to pass, including output and inout arguments.
 * @param returns Descriptor for the signal's return value, omitted when it returns void.
 */
function emitSignal(instance: object, signal: string, args: EmitArg[], returns?: Descriptor): unknown {
    const signalId = getSignalId(instance, signal);
    const detail = getSignalDetailQuark(signal);
    const { values, reads } = collectEmitValues(instance, args);

    if (returns === undefined) {
        gSignalEmitv(values, signalId, detail, undefined);

        return packTupleResult(readEmitOutputs(reads), undefined, false);
    }

    const returnValue = newValueForDescriptor(returns);
    gSignalEmitv(values, signalId, detail, returnValue);

    return packTupleResult(readEmitOutputs(reads), fromValue(returnValue), true);
}

export {
    getSignalBaseName,
    connectSignal,
    disconnectSignal,
    emitSignal,
    hasSignalListener,
    isSignalHandlerConnected,
    untrackConnection,
    type SignalHandler,
};
