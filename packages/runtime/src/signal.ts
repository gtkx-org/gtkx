import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import { type AnyClass, toCamelIdentifier, upperFirst } from "@gtkx/utils";
import type { ResolvedSignalEmitMap, ResolvedSignalMap } from "./signal-brand.js";
import { type Arg, isCallerAllocatedArg, isInoutArg, isOutputArg } from "./arg.js";
import { bind } from "./bind.js";
import { wrapCallback } from "./callback.js";
import { newCCallbackClosure, toClosure } from "./closure.js";
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
    uint64T,
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

const isSignalHandler = (value: unknown): value is SignalHandler => typeof value === "function";

type DeclaredSignalMap<T> = T extends { __signals__?: infer TSignals } ? NonNullable<TSignals> : never;
type SignalMap<T> = ResolvedSignalMap<T, DeclaredSignalMap<T>>;
type SignalName<T> = Extract<keyof SignalMap<T>, string>;
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
type SignalEmitName<T> = Extract<keyof SignalEmitMap<T>, string>;
type SignalEmitArguments<T, K extends SignalEmitName<T>> = SignalEmitMap<T>[K] extends {
    args: infer TArgs extends unknown[];
}
    ? TArgs
    : never;
type SignalEmitResult<T, K extends SignalEmitName<T>> = SignalEmitMap<T>[K] extends {
    result: infer TResult;
}
    ? TResult
    : never;

type SignalConnector = (
    instance: object,
    signal: string,
    handler: SignalHandler,
    isAfter?: boolean,
) => number;
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

const connectionTable: WeakMap<object, Map<string, Set<number>>> = new WeakMap();
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
    [objectT("borrowed"), uint64T],
    booleanT,
);

const gSignalHandlerDisconnect = bind(LIB, "g_signal_handler_disconnect", [objectT("borrowed"), uint64T], voidT);
const CLOSURE_T = boxedT("GClosure", { sharedLibrary: LIB, getTypeFnName: "g_closure_get_type" });

const gSignalConnectClosure = bind(
    LIB,
    "g_signal_connect_closure",
    [objectT("borrowed"), stringT("borrowed"), CLOSURE_T, booleanT],
    uint64T,
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

const isSignalHandlerConnected = (instance: object, handlerId: number): boolean =>
    gSignalHandlerIsConnected(getHandle(instance), handlerId) as boolean;

const trackConnection = (instance: object, signal: string, handlerId: number): void => {
    const bySignal = connectionTable.getOrInsertComputed(instance, () => new Map<string, Set<number>>());
    bySignal.getOrInsertComputed(signal, () => new Set<number>()).add(handlerId);
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
function connectSignal(instance: object, signal: string, spec: SignalConnectSpec): number {
    const { callback, handler, isAfter } = spec;
    const wrapped = wrapCallback(handler, callback, "signal");
    const type: bigint = (instance as TypedClass).__type__;
    const key = `${String(type)}\0${getSignalBaseName(signal)}`;
    const closure = newCCallbackClosure(key, callback, wrapped);
    const handlerId = gSignalConnectClosure(getHandle(instance), signal, closure, isAfter) as number;
    trackConnection(instance, canonicalSignalName(signal), handlerId);

    return handlerId;
}

function overrideSignalClassClosure(type: bigint, signalId: number, handler: SignalHandler): void {
    gSignalOverrideClassClosure(signalId, type, toClosure(handler));
}

function connectClosureSignal(instance: object, signal: string, handler: SignalHandler, isAfter: boolean): number {
    const closure = toClosure((...args: unknown[]) => Reflect.apply(handler, null, args.slice(1)));
    const handlerId = gSignalConnectClosure(getHandle(instance), signal, closure, isAfter) as number;
    trackConnection(instance, canonicalSignalName(signal), handlerId);

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
): number {
    return connectSignalByName(instance, signal, handler, isAfter);
}

function connectSignalByName(
    instance: object,
    signal: string,
    handler: unknown,
    isAfter?: boolean,
): number {
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
    isSignalHandlerConnected,
    installSignalDispatch,
    overrideSignalClassClosure,
    signalConnect,
    signalEmit,
    type SignalHandler,
};
