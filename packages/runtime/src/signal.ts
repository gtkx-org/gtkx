import { alloc, emitSignal as gSignalEmitv, type ExternalObject, type Handle } from "./native.js";
import { type AnyClass, toCamelIdentifier, upperFirst } from "@gtkx/utils";
import type { Descriptor } from "./descriptor-types.js";
import { type Arg, isCallerAllocatedArg, isInoutArg, isOutputArg } from "./arg.js";
import { bind } from "./bind.js";
import { wrapCallback } from "./callback.js";
import { newCCallbackClosure, newSignalClosure } from "./closure.js";
import {
    biguint64T,
    booleanT,
    bufferT,
    boxedT,
    type CallbackDescriptor,
    fixedArrayT,
    objectT,
    refT,
    sizedArrayT,
    stringT,
    uint32T,
    voidT,
} from "./descriptors.js";
import { read } from "./field.js";
import { LIB } from "./library.js";
import { getClassType, getHandle, getInstanceType } from "./registry.js";
import { packTupleResult } from "./tuple.js";
import { TYPE_INVALID, type TypedClass, typeInterfaces, typeName, typeParent } from "./type.js";
import {
    fromValue,
    fromValueForDescriptor,
    getBoxedValue,
    inoutValueForBoxedDescriptor,
    intoValue,
    newValueForType,
    outValueForBoxedDescriptor,
    outValueForDescriptor,
    toValue,
    toValueForType,
} from "./value.js";

/** Function invoked when a connected GObject signal is emitted. */
type SignalHandler = (...args: unknown[]) => unknown;
type SignalHandlerId = bigint;
type SignalHandlerReference = { id: SignalHandlerId };
type TrackedSignalConnection = {
    signal: string;
    handler: SignalHandler;
    reference: SignalHandlerReference;
    listener?: SignalHandler;
};
type SignalConnections = {
    bySignal: Map<string, Set<SignalHandlerId>>;
    byId: Map<SignalHandlerId, TrackedSignalConnection>;
};

const isSignalHandler = (value: unknown): value is SignalHandler => typeof value === "function";

/** Shape every emission entry has, intersected into lookups so they stay indexable on a generic receiver. */
type SignalEmission = { args: unknown[]; result: unknown };
/**
 * Maps are read by indexed access rather than conditional types, so they resolve against the
 * polymorphic `this` of a subclass body as well as against concrete instances.
 */
type SignalMap<T> = NonNullable<(T & { __signals__?: unknown })["__signals__"]>;
type SignalName<T> = keyof SignalMap<T> & string;
type SignalBaseName<K extends string> = K extends `${infer TBase}::${string}` ? TBase : K;
type SignalHandlerFor<T, K extends string> = SignalMap<T>[SignalBaseName<K> & SignalName<T>];
type SignalEmitMap<T> = NonNullable<(T & { __signalEmit__?: unknown })["__signalEmit__"]>;
type SignalEmitName<T> = keyof SignalEmitMap<T> & string;
type SignalEmitArguments<T, K extends SignalEmitName<T>> = (SignalEmitMap<T>[K] & SignalEmission)["args"];
type SignalEmitResult<T, K extends SignalEmitName<T>> = (SignalEmitMap<T>[K] & SignalEmission)["result"];

type SignalConnector = (instance: object, signal: string, handler: SignalHandler, isAfter?: boolean) => SignalHandlerId;
type SignalEmitter = (instance: object, signal: string, args: unknown[]) => unknown;
type SignalCallback = (signal: string) => CallbackDescriptor;
type SignalDispatch = {
    connect: SignalConnector;
    emit: SignalEmitter;
    callback?: SignalCallback;
};
type SignalDispatchSpec =
    | SignalDispatch
    | {
          callback: SignalCallback;
          emit: SignalEmitter;
      };
type PendingSignalDispatch = {
    ownerType: bigint;
    spec: SignalDispatch;
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
const gSignalQuery = bind(LIB, "g_signal_query", [uint32T, bufferT], voidT);
const signalTypesCache: Map<number, { paramTypes: bigint[]; returnType: bigint }> = new Map();
const signalNameCache: Map<bigint, string[]> = new Map();
const gSignalListIds = bind(LIB, "g_signal_list_ids", [biguint64T, refT(uint32T)], sizedArrayT(uint32T, 1, "full"));

const signalTypes = (signalId: number): { paramTypes: bigint[]; returnType: bigint } =>
    signalTypesCache.getOrInsertComputed(signalId, () => {
        const query = alloc(56);
        gSignalQuery(signalId, query);
        const count = read(query, uint32T, 40) as number;
        const paramTypes = read(query, fixedArrayT(biguint64T, count), 48) as bigint[];
        const returnType = read(query, biguint64T, 32) as bigint;
        return { paramTypes: paramTypes.map((type) => type & ~1n), returnType: returnType & ~1n };
    });

const gSignalHandlerIsConnected = bind(
    LIB,
    "g_signal_handler_is_connected",
    [objectT("borrowed"), biguint64T],
    booleanT,
);

const gSignalHandlerDisconnect = bind(LIB, "g_signal_handler_disconnect", [objectT("borrowed"), biguint64T], voidT);
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
    handler: SignalHandler,
    reference: SignalHandlerReference,
): void => {
    untrackConnection(instance, reference.id);
    const connections = connectionTable.getOrInsertComputed(instance, () => ({
        bySignal: new Map(),
        byId: new Map(),
    }));
    connections.bySignal.getOrInsertComputed(canonicalSignalName(signal), () => new Set()).add(reference.id);
    connections.byId.set(reference.id, { signal: canonicalDetailedSignalName(signal), handler, reference });
};

const untrackConnection = (instance: object, handlerId: SignalHandlerId, reference?: SignalHandlerReference): void => {
    const connections = connectionTable.get(instance);
    const connection = connections?.byId.get(handlerId);

    if (
        connections === undefined ||
        connection === undefined ||
        (reference !== undefined && connection.reference !== reference)
    ) {
        return;
    }

    connections.byId.delete(handlerId);
    const signal = canonicalSignalName(connection.signal);
    const handlerIds = connections.bySignal.get(signal);
    handlerIds?.delete(handlerId);

    if (handlerIds?.size === 0) {
        connections.bySignal.delete(signal);
    }

    if (connections.byId.size === 0) {
        connectionTable.delete(instance);
    }
};

const releaseConnection =
    (receiver: WeakRef<object>, reference: SignalHandlerReference): (() => void) =>
    () => {
        const instance = receiver.deref();

        if (instance !== undefined) {
            untrackConnection(instance, reference.id, reference);
        }
    };

const trackSignalListener = (instance: object, handlerId: SignalHandlerId, handler: SignalHandler): void => {
    const connection = connectionTable.get(instance)?.byId.get(handlerId);

    if (connection !== undefined) {
        connection.listener = handler;
    }
};

const findSignalListener = (instance: object, signal: string, handler: SignalHandler): SignalHandlerId | undefined => {
    const connections = connectionTable.get(instance);
    const handlerIds = connections?.bySignal.get(canonicalSignalName(signal));
    const detailedSignal = canonicalDetailedSignalName(signal);
    let found: SignalHandlerId | undefined;

    for (const handlerId of handlerIds ?? []) {
        const connection = connections?.byId.get(handlerId);

        if (connection?.signal === detailedSignal && connection.listener === handler) {
            found = handlerId;
        }
    }

    return found;
};

const handlerFor = (receiver: WeakRef<object>, reference: SignalHandlerReference): SignalHandler | undefined => {
    const instance = receiver.deref();
    const connection = instance === undefined ? undefined : connectionTable.get(instance)?.byId.get(reference.id);

    return connection?.reference === reference ? connection.handler : undefined;
};

const createSignalDispatcher = (receiver: WeakRef<object>, reference: SignalHandlerReference): SignalHandler =>
    function (this: unknown, ...args): unknown {
        const handler = handlerFor(receiver, reference);

        return handler === undefined ? undefined : Reflect.apply(handler, this, args);
    };

const createClosureDispatcher =
    (receiver: WeakRef<object>, reference: SignalHandlerReference): SignalHandler =>
    (...args): unknown => {
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

const signalIdFor = (type: bigint, signal: string): number => gSignalLookup(getSignalBaseName(signal), type) as number;

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
    trackConnection(instance, signal, handler, reference);

    return handlerId;
}

function overrideSignalClassClosure(type: bigint, signalId: number, handler: SignalHandler): void {
    const signal = gSignalName(signalId) as string;
    const dispatch = signalDispatchForId(signalId, signal);
    const callback = dispatch?.callback?.(signal);
    const closure =
        callback === undefined
            ? newSignalClosure((...args: unknown[]) => handler.apply(args[0], args.slice(1)))
            : newCCallbackClosure(
                  `${String(type)}\0${signal}`,
                  callback,
                  wrapCallback(handler, callback, "signal-class"),
              );
    gSignalOverrideClassClosure(signalId, type, closure);
}

function connectClosureSignal(
    instance: object,
    signal: string,
    handler: SignalHandler,
    isAfter: boolean,
): SignalHandlerId {
    const receiver = new WeakRef(instance);
    const reference: SignalHandlerReference = { id: 0n };
    const closure = newSignalClosure(
        createClosureDispatcher(receiver, reference),
        releaseConnection(receiver, reference),
    );
    const handlerId = gSignalConnectClosure(getHandle(instance), signal, closure, isAfter) as SignalHandlerId;
    reference.id = handlerId;
    trackConnection(instance, signal, handler, reference);

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

const createEmitValue = (arg: EmitArg, type: bigint): { value: ExternalObject<Handle>; read?: () => unknown } => {
    if (!isOutputArg(arg)) {
        return { value: toValueForType(arg.type, arg.value, type) };
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

const collectEmitValues = (instance: object, args: EmitArg[], paramTypes: bigint[]): EmitValues => {
    const collected: EmitValues = { values: [toValue(objectT("full"), instance)], reads: [] };

    if (args.length !== paramTypes.length) {
        throw new TypeError(`emit: signal takes ${String(paramTypes.length)} arguments, got ${String(args.length)}`);
    }

    for (const [index, arg] of args.entries()) {
        const type = paramTypes[index];
        if (type === undefined) throw new TypeError("emit: missing native signal argument type");
        const { value, read } = createEmitValue(arg, type);
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
    const { paramTypes, returnType } = signalTypes(signalId);
    const { values, reads } = collectEmitValues(instance, args, paramTypes);

    if (returns === undefined) {
        gSignalEmitv(values, signalId, detail, undefined);

        return packTupleResult(readEmitOutputs(reads), undefined, false);
    }

    const returnValue = newValueForType(returnType);
    gSignalEmitv(values, signalId, detail, returnValue);
    const result = fromValueForDescriptor(returns, returnValue);

    return packTupleResult(readEmitOutputs(reads), result, true);
}

const createSignalDispatch = (spec: SignalDispatchSpec): SignalDispatch => {
    if ("connect" in spec) {
        return spec;
    }

    return {
        ...spec,
        connect(instance, signal, handler, isAfter): SignalHandlerId {
            return connectSignal(instance, signal, {
                callback: spec.callback(signal),
                handler,
                isAfter: isAfter ?? false,
            });
        },
    };
};

function installSignalDispatch(klass: AnyClass, names: readonly string[], spec: SignalDispatchSpec): void {
    const ownerType = getClassType(klass);
    const dispatch = createSignalDispatch(spec);

    for (const rawName of names) {
        const name = canonicalSignalName(rawName);
        pendingSignalDispatches.getOrInsertComputed(name, () => []).push({ ownerType, spec: dispatch });
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

const signalDispatchForId = (signalId: number, name: string): SignalDispatch | undefined =>
    signalDispatchTable.get(signalId) ?? resolvePendingSignalDispatch(signalId, name);

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

    return signalDispatchForId(signalId, name);
};

const unknownSignalError = (operation: string, instance: object, signal: string): TypeError => {
    const instanceType = getInstanceType(instance);
    const owner = instanceType === TYPE_INVALID ? null : typeName(instanceType);

    return new TypeError(`${operation}: unknown signal '${signal}' on ${owner ?? "a non-GObject value"}`);
};

const connectDispatcherFor = (instance: object, signal: string): SignalConnector => {
    const dispatch = signalDispatchFor(instance, signal);

    if (dispatch === undefined) {
        throw unknownSignalError("connectSignal", instance, signal);
    }

    return dispatch.connect;
};

const emitDispatcherFor = (instance: object, signal: string): SignalEmitter => {
    const dispatch = signalDispatchFor(instance, signal);

    if (dispatch === undefined) {
        throw unknownSignalError("emitSignal", instance, signal);
    }

    return dispatch.emit;
};

function signalConnect<T extends object, K extends SignalName<NoInfer<T>>>(
    instance: T,
    signal: K,
    handler: SignalHandlerFor<NoInfer<T>, K>,
    isAfter?: boolean,
): SignalHandlerId {
    return connectSignalByName(instance, signal, handler, isAfter);
}

function connectSignalByName(instance: object, signal: string, handler: unknown, isAfter?: boolean): SignalHandlerId {
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
    findSignalListener,
    hasSignalListener,
    installSignalDispatch,
    overrideSignalClassClosure,
    signalConnect,
    signalEmit,
    type SignalEmitArguments,
    type SignalEmitName,
    type SignalEmitResult,
    type SignalHandler,
    type SignalHandlerFor,
    type SignalHandlerId,
    type SignalMap,
    type SignalName,
    trackSignalListener,
};
