import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import { type Arg, isCallerAllocatedArg, isInoutArg, isOutputArg } from "./arg.js";
import { bind, createBindCache } from "./bind.js";
import { wrapCallback } from "./callback.js";
import {
    arrayT,
    biguint64T,
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
import type { TypedClass } from "./type.js";
import {
    fromValue,
    getBoxedValue,
    inoutValueForBoxedDescriptor,
    newValueForDescriptor,
    outValueForBoxedDescriptor,
    outValueForDescriptor,
    toValue,
} from "./value.js";

export type SignalHandler = (...args: unknown[]) => unknown;

type SignalConnectSpec = {
    callback: CallbackDescriptor;
    handler: SignalHandler;
    after: boolean;
};

type EmitArg = Arg & { value?: unknown };

const connectCache = createBindCache();
const gQuarkFromString = bind(LIB, "g_quark_from_string", [stringT("borrowed")], uint32T);
const gSignalLookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);

const gSignalEmitv = bind(
    LIB,
    "g_signal_emitv",
    [arrayT(VALUE_T, "array", "borrowed", { elementSize: VALUE_SIZE }), uint32T, uint32T, VALUE_T],
    voidT,
);

const gSignalHandlersBlockMatched = bind(
    LIB,
    "g_signal_handlers_block_matched",
    [objectT("borrowed"), uint32T, uint32T, uint32T, objectT("borrowed"), objectT("borrowed"), objectT("borrowed")],
    uint32T,
);

export const getSignalBaseName = (signal: string): string => {
    const detailIndex = signal.indexOf("::");
    return detailIndex === -1 ? signal : signal.slice(0, detailIndex);
};

function getQuarkForSignalDetail(signal: string): number {
    const detailIndex = signal.indexOf("::");
    if (detailIndex === -1) return 0;
    return gQuarkFromString(signal.slice(detailIndex + 2)) as number;
}

function connectBind(type: bigint, signal: string, callback: CallbackDescriptor): (...values: unknown[]) => unknown {
    const key = `${type}\0${getSignalBaseName(signal)}`;
    return connectCache(
        key,
        LIB,
        "g_signal_connect_data",
        [objectT("borrowed"), stringT("borrowed"), callback, uint32T],
        uint64T,
    );
}

export function connectSignal(instance: object, signal: string, spec: SignalConnectSpec): number {
    const { callback, handler, after } = spec;
    const wrapped = wrapCallback(handler, callback, "emitter");
    const type: bigint = (instance as TypedClass).__type__;
    const connect = connectBind(type, signal, callback);
    return connect(getHandle(instance), signal, wrapped, after ? 1 : 0) as number;
}

export function blockMatchedSignalHandlers(instance: object, signal: string): void {
    const type: bigint = (instance as TypedClass).__type__;
    const signalId = gSignalLookup(getSignalBaseName(signal), type) as number;
    gSignalHandlersBlockMatched(getHandle(instance), 1, signalId, 0, undefined, undefined, undefined);
}

const createEmitValue = (arg: EmitArg): { value: ExternalObject<Handle>; read?: () => unknown } => {
    if (!isOutputArg(arg)) return { value: toValue(arg.type, arg.value) };
    if (isCallerAllocatedArg(arg)) {
        if (isInoutArg(arg)) return { value: inoutValueForBoxedDescriptor(arg.type, arg.value as object) };
        const value = outValueForBoxedDescriptor(arg.type, arg.value as object);
        return { value, read: () => getBoxedValue(value) };
    }
    return isInoutArg(arg) ? outValueForDescriptor(arg.type, arg.value) : outValueForDescriptor(arg.type);
};

export function emitSignal(instance: object, signal: string, args: EmitArg[], returnDescriptor?: Descriptor): unknown {
    const type: bigint = (instance as TypedClass).__type__;
    const signalId = gSignalLookup(getSignalBaseName(signal), type) as number;
    const detail = getQuarkForSignalDetail(signal);
    const values: ExternalObject<Handle>[] = [toValue(objectT("full"), instance)];
    const reads: (() => unknown)[] = [];

    for (const arg of args) {
        const { value, read } = createEmitValue(arg);
        values.push(value);
        if (read) reads.push(read);
    }

    if (returnDescriptor !== undefined) {
        const returnValue = newValueForDescriptor(returnDescriptor);
        gSignalEmitv(values, signalId, detail, returnValue);
        return packTupleResult(
            reads.map((read) => read()),
            fromValue(returnValue),
            true,
        );
    }

    gSignalEmitv(values, signalId, detail, undefined);

    return packTupleResult(
        reads.map((read) => read()),
        undefined,
        false,
    );
}
