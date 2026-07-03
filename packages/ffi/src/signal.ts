import type { Descriptor, ExternalObject, Handle } from "@gtkx/native";
import { isCallerAllocatedArg, isInoutArg, isOutputArg } from "./arg.js";
import { wrapCallback } from "./callback.js";
import { LIB, VALUE_SIZE, VALUE_T } from "./constants.js";
import {
    arrayT,
    biguint64T,
    bind,
    type CallbackDescriptor,
    createBindCache,
    objectT,
    stringT,
    uint32T,
    uint64T,
    voidT,
} from "./descriptors.js";
import type { GTyped } from "./gtype.js";
import {
    fromGValue,
    inoutBoxedForDescriptor,
    newGValueForDescriptor,
    outBoxedForDescriptor,
    outValueForDescriptor,
    toGValue,
    valueGetBoxed,
} from "./gvalue.js";
import { getHandle } from "./registry.js";
import { packTupleResult } from "./tuple.js";

export type SignalHandler = (...args: unknown[]) => unknown;

export const signalBaseName = (signal: string): string => {
    const detailIndex = signal.indexOf("::");
    return detailIndex === -1 ? signal : signal.slice(0, detailIndex);
};

const gQuarkFromString = bind(LIB, "g_quark_from_string", [stringT("borrowed")], uint32T);

function signalDetailQuark(signal: string): number {
    const detailIndex = signal.indexOf("::");
    if (detailIndex === -1) return 0;
    return gQuarkFromString(signal.slice(detailIndex + 2)) as number;
}

type SignalConnectSpec = {
    callback: CallbackDescriptor;
    handler: SignalHandler;
    after: boolean;
};

const connectCache = createBindCache();

function connectBind(gtype: bigint, signal: string, callback: CallbackDescriptor): (...values: unknown[]) => unknown {
    const key = `${gtype}\0${signalBaseName(signal)}`;
    return connectCache(
        key,
        LIB,
        "g_signal_connect_data",
        [objectT("borrowed"), stringT("borrowed"), callback, uint32T],
        uint64T,
    );
}

export function connectGObjectSignal(instance: object, signal: string, spec: SignalConnectSpec): number {
    const { callback, handler, after } = spec;
    const wrapped = wrapCallback(handler, callback, "emitter");
    const gtype: bigint = (instance as GTyped).__gtype__;
    const connect = connectBind(gtype, signal, callback);
    return connect(getHandle(instance), signal, wrapped, after ? 1 : 0) as number;
}

const gSignalEmitv = bind(
    LIB,
    "g_signal_emitv",
    [arrayT(VALUE_T, "array", "borrowed", { elementSize: VALUE_SIZE }), uint32T, uint32T, VALUE_T],
    voidT,
);

const gSignalLookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);

const G_SIGNAL_MATCH_ID = 1;

const gSignalHandlersBlockMatched = bind(
    LIB,
    "g_signal_handlers_block_matched",
    [objectT("borrowed"), uint32T, uint32T, uint32T, objectT("borrowed"), objectT("borrowed"), objectT("borrowed")],
    uint32T,
);

export function blockGObjectSignalHandlers(instance: object, signal: string): void {
    const gtype: bigint = (instance as GTyped).__gtype__;
    const signalId = gSignalLookup(signalBaseName(signal), gtype) as number;
    gSignalHandlersBlockMatched(getHandle(instance), G_SIGNAL_MATCH_ID, signalId, 0, undefined, undefined, undefined);
}

type EmitArg = {
    type: Descriptor;
    direction?: "out" | "inout";
    callerAllocated?: boolean;
    value?: unknown;
};

const emitValue = (arg: EmitArg): { value: ExternalObject<Handle>; read?: () => unknown } => {
    if (!isOutputArg(arg)) return { value: toGValue(arg.type, arg.value) };
    if (isCallerAllocatedArg(arg)) {
        if (isInoutArg(arg)) return { value: inoutBoxedForDescriptor(arg.type, arg.value as object) };
        const value = outBoxedForDescriptor(arg.type, arg.value as object);
        return { value, read: () => valueGetBoxed(value) };
    }
    return isInoutArg(arg) ? outValueForDescriptor(arg.type, arg.value) : outValueForDescriptor(arg.type);
};

export function emitGObjectSignal(
    instance: object,
    signal: string,
    args: EmitArg[],
    returnDescriptor?: Descriptor,
): unknown {
    const gtype: bigint = (instance as GTyped).__gtype__;
    const signalId = gSignalLookup(signalBaseName(signal), gtype) as number;
    const detail = signalDetailQuark(signal);

    const values: ExternalObject<Handle>[] = [toGValue(objectT("full"), instance)];
    const reads: (() => unknown)[] = [];
    for (const arg of args) {
        const { value, read } = emitValue(arg);
        values.push(value);
        if (read) reads.push(read);
    }

    if (returnDescriptor !== undefined) {
        const returnValue = newGValueForDescriptor(returnDescriptor);
        gSignalEmitv(values, signalId, detail, returnValue);
        return packTupleResult(
            reads.map((emit) => emit()),
            fromGValue(returnValue),
            true,
        );
    }
    gSignalEmitv(values, signalId, detail, undefined);
    return packTupleResult(
        reads.map((emit) => emit()),
        undefined,
        false,
    );
}
