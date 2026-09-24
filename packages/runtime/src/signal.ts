import type { ExternalObject, Handle } from "@gtkx/native";
import { type AnyClass, toCamelIdentifier, upperFirst } from "@gtkx/utils";
import type { Descriptor } from "./descriptor-types.js";
import type { ResolvedSignalEmitMap, ResolvedSignalMap, SignalArguments, SignalResult } from "./signal-brand.js";
import { type Arg, isCallerAllocatedArg, isInoutArg, isOutputArg } from "./arg.js";
import { bind } from "./bind.js";
import { wrapCallback } from "./callback.js";
import { newCCallbackClosure, newClosure, toClosure } from "./closure.js";
import {
    arrayT,
    biguint64T,
    booleanT,
    boxedT,
    type CallbackDescriptor,
    objectT,
    refT,
    sizedArrayT,
    stringT,
    uint32T,
    voidT,
} from "./descriptors.js";
import { LIB, VALUE_SIZE, VALUE_T } from "./library.js";
import { getClassType, getHandle, getInstanceType } from "./registry.js";
import { packTupleResult } from "./tuple.js";
import { TYPE_INVALID, type TypedClass, typeInterfaces, typeParent } from "./type.js";
import {
    fromValue,
    getBoxedValue,
    inoutValueForBoxedDescriptor,
    intoValue,
    newValueForDescriptor,
    newValueForType,
    outValueForBoxedDescriptor,
    outValueForDescriptor,
    toValue,
} from "./value.js";

/** Function invoked when a connected GObject signal is emitted. */
type SignalHandler = (...args: unknown[]) => unknown;
type SignalHandlerId = bigint;
type SignalHandlerReference = { id: SignalHandlerId };
type SignalDisconnectObserver = (instance: object, handlerId: SignalHandlerId) => void;
type TrackedSignalConnection = {
    handlerId: SignalHandlerId;
    handler: SignalHandler;
    reference: SignalHandlerReference;
};
type SignalConnections = {
    bySignal: Map<string, Set<SignalHandlerId>>;
    handlers: Map<SignalHandlerId, SignalHandler>;
    references: Map<SignalHandlerId, SignalHandlerReference>;
    disconnectObservers: Map<SignalHandlerId, Set<SignalDisconnectObserver>>;
};

const isSignalHandler = (value: unknown): value is SignalHandler => typeof value === "function";

type DeclaredSignalMap<T> = T extends { __signals__?: infer TSignals } ? NonNullable<TSignals> : never;
type SignalMap<T> = ResolvedSignalMap<T, DeclaredSignalMap<T>>;
type SignalName<T> = keyof SignalMap<T> & string;
type DeclaredSignalEmitMap<T> = T extends { __signalEmit__?: infer TSignals }
    ? NonNullable<TSignals>
    : T extends { __signals__?: infer TSignals }
        ? {
                [K in keyof NonNullable<TSignals>]: NonNullable<TSignals>[K] extends (
                    ...args: infer TArgs
                ) => infer TResult
                    ? { args: TArgs; result: TResult }
                    : never;
            }
        : never;
type SignalEmitMap<T> = ResolvedSignalEmitMap<T, DeclaredSignalEmitMap<T>>;
type SignalEmitName<T> = keyof SignalEmitMap<T> & string;
type SignalEmitArguments<T, K extends SignalEmitName<T>> = SignalArguments<SignalEmitMap<T>[K]>;
type SignalEmitResult<T, K extends SignalEmitName<T>> = SignalResult<SignalEmitMap<T>[K]>;

type SignalConnector = (
    instance: object,
    signal: string,
    handler: SignalHandler,
    isAfter?: boolean,
) => SignalHandlerId;
type SignalEmitter = (instance: object, signal: string, args: unknown[]) => unknown;
type SignalDispatch = {
    connect: SignalConnector;
    emit: SignalEmitter;
};
type SignalDispatchSpec = {
    connect: SignalConnector;
    emit: SignalEmitter;
};
type PendingSignalDispatch = {
    ownerType: bigint;
    spec: SignalDispatchSpec;
};

type DeclaredSignalTypes = {
    paramTypes: bigint[];
    returnType?: bigint;
};

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

const connectionTable: WeakMap<object, SignalConnections> = new WeakMap();
const signalDispatchTable: Map<number, SignalDispatch> = new Map();
const pendingSignalDispatches: Map<string, PendingSignalDispatch[]> = new Map();
const gQuarkFromString = bind(LIB, "g_quark_from_string", [stringT("borrowed")], uint32T);
const gSignalLookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);
const gSignalName = bind(LIB, "g_signal_name", [uint32T], stringT("borrowed"));
const signalNameCache: Map<bigint, string[]> = new Map();
const gSignalListIds = bind(LIB, "g_signal_list_ids", [biguint64T, refT(uint32T)], sizedArrayT(uint32T, 1, "full"));

const gSignalEmitv = bind(
    LIB,
    "g_signal_emitv",
    [arrayT(VALUE_T, "array", "borrowed", { elementSize: VALUE_SIZE }), uint32T, uint32T, VALUE_T],
    voidT,
);

const gSignalHandlerIsConnected = bind(
    LIB,
    "g_signal_handler_is_connected",
    [objectT("borrowed"), biguint64T],
    booleanT,
);

const gSignalHandlerDisconnect = bind(
    LIB,
    "g_signal_handler_disconnect",
    [objectT("borrowed"), biguint64T],
    voidT,
);
const CLOSURE_T = boxedT("GClosure", { sharedLibrary: LIB, getTypeFnName: "g_closure_get_type" });

const gSignalConnectClosure = bind(
    LIB,
    "g_signal_connect_closure",
    [objectT("borrowed"), stringT("borrowed"), CLOSURE_T, booleanT],
    biguint64T,
);

const gSignalOverrideClassClosure = bind(
    LIB,
    "g_signal_override_class_closure",
    [uint32T, biguint64T, CLOSURE_T],
    voidT,
);

/** Returns the signal name without its detail suffix (the part after `::`). */
const getSignalBaseName = (signal: string): string => {
    const detailIndex = signal.indexOf("::");

    return detailIndex === -1 ? signal : signal.slice(0, detailIndex);
};

const canonicalSignalName = (signal: string): string => getSignalBaseName(signal).replaceAll("_", "-");

const canonicalDetailedSignalName = (signal: string): string => {
    const detailIndex = signal.indexOf("::");
    const base = canonicalSignalName(signal);

    return detailIndex === -1 ? base : `${base}${signal.slice(detailIndex)}`;
};

function getSignalDetailQuark(signal: string): number {
    const detailIndex = signal.indexOf("::");

    if (detailIndex === -1) {
        return 0;
    }

    return gQuarkFromString(signal.slice(detailIndex + 2)) as number;
}

const isSignalHandlerConnected = (instance: object, handlerId: SignalHandlerId | number): boolean =>
    gSignalHandlerIsConnected(getHandle(instance), handlerId) as boolean;

const trackConnection = (
    instance: object,
    signal: string,
    connection: TrackedSignalConnection,
): void => {
    const { handlerId, handler, reference } = connection;
    const connections = connectionTable.getOrInsertComputed(instance, () => ({
        bySignal: new Map(),
        handlers: new Map(),
        references: new Map(),
        disconnectObservers: new Map(),
    }));
    connections.bySignal.getOrInsertComputed(signal, () => new Set<SignalHandlerId>()).add(handlerId);
    connections.handlers.set(handlerId, handler);
    connections.references.set(handlerId, reference);
};

const notifySignalDisconnected = (
    instance: object,
    handlerId: SignalHandlerId,
    observers: Set<SignalDisconnectObserver> | undefined,
): void => {
    const activeObservers = observers ?? [];

    for (const observer of activeObservers) {
        observer(instance, handlerId);
    }
};

const isCurrentConnection = (
    connections: SignalConnections | undefined,
    handlerId: SignalHandlerId,
    reference: SignalHandlerReference | undefined,
): boolean =>
    reference === undefined || connections === undefined || connections.references.get(handlerId) === reference;

const removeSignalHandlerId = (connections: SignalConnections, handlerId: SignalHandlerId): void => {
    for (const [name, handlerIds] of connections.bySignal) {
        handlerIds.delete(handlerId);

        if (handlerIds.size === 0) {
            connections.bySignal.delete(name);
        }
    }
};

const untrackConnection = (
    instance: object,
    handlerId: SignalHandlerId,
    reference?: SignalHandlerReference,
): void => {
    const connections = connectionTable.get(instance);

    if (!isCurrentConnection(connections, handlerId, reference)) {
        return;
    }

    const observers = connections?.disconnectObservers.get(handlerId);

    if (connections !== undefined) {
        connections.handlers.delete(handlerId);
        connections.references.delete(handlerId);
        connections.disconnectObservers.delete(handlerId);
        removeSignalHandlerId(connections, handlerId);

        if (connections.handlers.size === 0) {
            connectionTable.delete(instance);
        }
    }

    notifySignalDisconnected(instance, handlerId, observers);
};

const releaseConnection = (
    receiver: WeakRef<object>,
    reference: SignalHandlerReference,
): (() => void) => () => {
    const instance = receiver.deref();

    if (instance !== undefined) {
        untrackConnection(instance, reference.id, reference);
    }
};

const trackSignalDisconnect = (
    instance: object,
    handlerId: SignalHandlerId,
    observer: SignalDisconnectObserver,
): void => {
    const connections = connectionTable.get(instance);

    if (!connections?.handlers.has(handlerId)) {
        observer(instance, handlerId);

        return;
    }

    connections.disconnectObservers.getOrInsertComputed(handlerId, () => new Set()).add(observer);
};

const handlerFor = (receiver: WeakRef<object>, reference: SignalHandlerReference): SignalHandler | undefined => {
    const instance = receiver.deref();
    const connections = instance === undefined ? undefined : connectionTable.get(instance);

    return connections?.references.get(reference.id) === reference
        ? connections.handlers.get(reference.id)
        : undefined;
};

const createSignalDispatcher = (
    receiver: WeakRef<object>,
    reference: SignalHandlerReference,
): SignalHandler => function (this: unknown, ...args): unknown {
    const handler = handlerFor(receiver, reference);

    return handler === undefined ? undefined : Reflect.apply(handler, this, args);
};

const createClosureDispatcher = (
    receiver: WeakRef<object>,
    reference: SignalHandlerReference,
): SignalHandler => (...args): unknown => {
    const handler = handlerFor(receiver, reference);

    return handler === undefined ? undefined : Reflect.apply(handler, null, args.slice(1));
};

/**
 * Disconnects the handler an instance connected under the given id, and forgets the connection.
 * @param instance Emitter the handler was connected to.
 * @param handlerId Id {@link connectSignal} returned for the handler.
 */
const disconnectSignal = (instance: object, handlerId: SignalHandlerId | number): void => {
    const isConnected = isSignalHandlerConnected(instance, handlerId);
    const trackedHandlerId = typeof handlerId === "bigint" ? handlerId : BigInt(handlerId);
    untrackConnection(instance, trackedHandlerId);

    if (isConnected) {
        gSignalHandlerDisconnect(getHandle(instance), handlerId);
    }
};

const hasLiveConnection = (instance: object, handlerIds: Set<SignalHandlerId>): boolean => {
    let isLive = false;

    for (const handlerId of handlerIds) {
        if (isSignalHandlerConnected(instance, handlerId)) {
            isLive = true;
        } else {
            untrackConnection(instance, handlerId);
        }
    }

    return isLive;
};

function hasSignalListener(instance: object, signals?: string[]): boolean {
    const bySignal = connectionTable.get(instance)?.bySignal;

    if (!bySignal) {
        return false;
    }

    const names =
        signals === undefined ? bySignal.keys().toArray() : signals.map((signal) => canonicalSignalName(signal));

    return names.some((name) => {
        const handlerIds = bySignal.get(name);

        return handlerIds !== undefined && hasLiveConnection(instance, handlerIds);
    });
}

const signalIdFor = (type: bigint, signal: string): number =>
    gSignalLookup(getSignalBaseName(signal), type) as number;

const ownSignalNames = (type: bigint): string[] => {
    const countRef = { value: 0 };

    return (gSignalListIds(type, countRef) as number[]).map((id) => gSignalName(id) as string);
};

const addSignalNames = (names: Set<string>, type: bigint): void => {
    for (const name of ownSignalNames(type)) {
        names.add(name);
    }
};

const handlerNameFor = (signal: string): string => `on${upperFirst(toCamelIdentifier(signal))}`;

/** The signal a generated `on…` handler prop names on the given type, or `undefined` when it carries none. */
const signalForHandlerName = (type: bigint, handlerName: string): string | undefined =>
    signalNamesFor(type).find((signal) => handlerNameFor(signal) === handlerName);

const buildSignalNames = (type: bigint): string[] => {
    const names: Set<string> = new Set();

    for (let current = type; current !== TYPE_INVALID; current = typeParent(current)) {
        addSignalNames(names, current);

        for (const iface of typeInterfaces(current)) {
            addSignalNames(names, iface);
        }
    }

    return [...names];
};

const signalNamesFor = (type: bigint): string[] => signalNameCache.getOrInsertComputed(type, buildSignalNames);

const getSignalId = (instance: object, signal: string): number =>
    signalIdFor((instance as TypedClass).__type__, signal);

/**
 * Connects a handler to a GObject signal on an instance and returns the handler id.
 * @param instance Emitter to connect to.
 * @param signal Signal name, optionally including a `::detail` suffix.
 * @param spec Callback descriptor, handler function, and whether to run after the default handler.
 */
function connectSignal(instance: object, signal: string, spec: SignalConnectSpec): SignalHandlerId {
    const { callback, handler, isAfter } = spec;
    const receiver = new WeakRef(instance);
    const reference: SignalHandlerReference = { id: 0n };
    const wrapped = wrapCallback(createSignalDispatcher(receiver, reference), callback, "signal");
    const type: bigint = (instance as TypedClass).__type__;
    const key = `${String(type)}\0${getSignalBaseName(signal)}`;
    const closure = newCCallbackClosure(key, callback, wrapped, releaseConnection(receiver, reference));
    const handlerId = gSignalConnectClosure(getHandle(instance), signal, closure, isAfter) as SignalHandlerId;
    reference.id = handlerId;
    trackConnection(instance, canonicalSignalName(signal), { handlerId, handler, reference });

    return handlerId;
}

function overrideSignalClassClosure(type: bigint, signalId: number, handler: SignalHandler): void {
    gSignalOverrideClassClosure(signalId, type, toClosure(handler));
}

function connectClosureSignal(
    instance: object,
    signal: string,
    handler: SignalHandler,
    isAfter: boolean,
): SignalHandlerId {
    const receiver = new WeakRef(instance);
    const reference: SignalHandlerReference = { id: 0n };
    const closure = newClosure(
        createClosureDispatcher(receiver, reference),
        releaseConnection(receiver, reference),
    );
    const handlerId = gSignalConnectClosure(getHandle(instance), signal, closure, isAfter) as SignalHandlerId;
    reference.id = handlerId;
    trackConnection(instance, canonicalSignalName(signal), { handlerId, handler, reference });

    return handlerId;
}

function emitDeclaredSignal(instance: object, signal: string, types: DeclaredSignalTypes, args: unknown[]): unknown {
    const { paramTypes, returnType } = types;

    if (args.length !== paramTypes.length) {
        throw new TypeError(
            `emit: signal '${signal}' takes ${String(paramTypes.length)} arguments, got ${String(args.length)}`,
        );
    }

    const signalId = getSignalId(instance, signal);
    const detail = getSignalDetailQuark(signal);
    const values = [toValue(objectT("full"), instance)];

    for (const [index, paramType] of paramTypes.entries()) {
        const value = newValueForType(paramType);
        intoValue(value, args[index]);
        values.push(value);
    }

    if (returnType === undefined) {
        gSignalEmitv(values, signalId, detail, undefined);

        return undefined;
    }

    const returnValue = newValueForType(returnType);
    gSignalEmitv(values, signalId, detail, returnValue);

    return fromValue(returnValue);
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

function installSignalDispatch(
    klass: AnyClass,
    names: readonly string[],
    spec: SignalDispatchSpec,
): void {
    const ownerType = getClassType(klass);

    for (const rawName of names) {
        const name = canonicalSignalName(rawName);
        pendingSignalDispatches.getOrInsertComputed(name, () => []).push({ ownerType, spec });
    }
}

const resolvePendingSignalDispatch = (signalId: number, name: string): SignalDispatch | undefined => {
    const pending = pendingSignalDispatches.get(name) ?? [];

    for (let index = pending.length - 1; index >= 0; index -= 1) {
        const entry = pending[index];

        if (
            entry !== undefined &&
            entry.ownerType !== TYPE_INVALID &&
            signalIdFor(entry.ownerType, name) === signalId
        ) {
            signalDispatchTable.set(signalId, entry.spec);

            return entry.spec;
        }
    }

    return undefined;
};

const signalDispatchFor = (instance: object, signal: string): SignalDispatch | undefined => {
    const name = canonicalSignalName(signal);
    const instanceType = getInstanceType(instance);

    if (instanceType === TYPE_INVALID) {
        return undefined;
    }

    const signalId = signalIdFor(instanceType, name);

    if (signalId === 0) {
        return undefined;
    }

    return signalDispatchTable.get(signalId) ?? resolvePendingSignalDispatch(signalId, name);
};

const connectDispatcherFor = (instance: object, signal: string): SignalConnector => {
    const dispatch = signalDispatchFor(instance, signal);

    if (dispatch === undefined) {
        throw new TypeError("connectSignal: unknown signal");
    }

    return dispatch.connect;
};

const emitDispatcherFor = (instance: object, signal: string): SignalEmitter => {
    const dispatch = signalDispatchFor(instance, signal);

    if (dispatch === undefined) {
        throw new TypeError("emitSignal: unknown signal");
    }

    return dispatch.emit;
};

function signalConnect<T extends object, K extends SignalName<NoInfer<T>>>(
    instance: T,
    signal: K,
    handler: SignalMap<NoInfer<T>>[K],
    isAfter?: boolean,
): SignalHandlerId {
    return connectSignalByName(instance, signal, handler, isAfter);
}

function connectSignalByName(
    instance: object,
    signal: string,
    handler: unknown,
    isAfter?: boolean,
): SignalHandlerId {
    if (!isSignalHandler(handler)) {
        throw new TypeError("connectSignal: handler must be a function");
    }

    return connectDispatcherFor(instance, signal)(instance, signal, handler, isAfter);
}

function emitSignalByName(instance: object, signal: string, args: unknown[]): unknown {
    return emitDispatcherFor(instance, signal)(instance, signal, args);
}

function signalEmit<T extends object, K extends SignalEmitName<NoInfer<T>>>(
    instance: T,
    signal: K,
    ...args: SignalEmitArguments<NoInfer<T>, K>
): SignalEmitResult<NoInfer<T>, K> {
    return emitSignalByName(instance, signal, args) as SignalEmitResult<NoInfer<T>, K>;
}

export {
    canonicalDetailedSignalName,
    canonicalSignalName,
    signalForHandlerName,
    getSignalBaseName,
    signalIdFor,
    connectClosureSignal,
    connectSignal,
    connectSignalByName,
    type DeclaredSignalTypes,
    disconnectSignal,
    emitDeclaredSignal,
    emitSignal,
    emitSignalByName,
    hasSignalListener,
    installSignalDispatch,
    overrideSignalClassClosure,
    signalConnect,
    signalEmit,
    type SignalEmitArguments,
    type SignalEmitName,
    type SignalEmitResult,
    type SignalHandler,
    type SignalHandlerId,
    type SignalMap,
    type SignalName,
    trackSignalDisconnect,
};
