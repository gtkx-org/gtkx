import type { CallbackDescriptor, Descriptor, Handle, Value } from "@gtkx/native";
import { classifyArgCategory } from "./arg-category.js";
import { wrapCallback } from "./callback.js";
import { GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import { arrayT, biguint64T, bind, createBindCache, objectT, stringT, uint32T, uint64T, voidT } from "./descriptors.js";
import type { GType, GTyped } from "./gtype.js";
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

/**
 * Returns a memoized `g_signal_connect_data` binding for `(gtype, signal)`. The connect signature
 * varies only by the per-signal `callback` type, which the generated code rebuilds on each connect;
 * keying on `(gtype, base signal)` — a stable proxy for that callback structure — compiles the
 * signature once per class+signal and reuses it across connects.
 */
function connectBind(gtype: GType, signal: string, callback: CallbackDescriptor): (...values: Value[]) => Value {
    const key = `${gtype}\0${signalBaseName(signal)}`;
    return connectCache(key, () =>
        bind(LIB, "g_signal_connect_data", [objectT("borrowed"), stringT("borrowed"), callback, uint32T], uint64T),
    );
}

export function connectGObjectSignal(instance: object, signal: string, spec: SignalConnectSpec): number {
    const { callback, handler, after } = spec;
    const wrapped = wrapCallback(handler, callback, "emitter");
    const gtype: GType = (instance as GTyped).__gtype__;
    const connect = connectBind(gtype, signal, callback);
    return connect(getHandle(instance), signal, wrapped, after ? 1 : 0) as number;
}

const gSignalEmitv = bind(
    LIB,
    "g_signal_emitv",
    [arrayT(GVALUE_T, "array", "borrowed", { elementSize: GVALUE_SIZE }), uint32T, uint32T, GVALUE_T],
    voidT,
);

const gSignalLookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);

type EmitArg = {
    type: Descriptor;
    direction?: "out" | "inout";
    callerAllocated?: boolean;
    value?: unknown;
};

const emitCell = (arg: EmitArg): { value: Handle; read?: () => unknown } => {
    const category = classifyArgCategory({ direction: arg.direction, callerAllocated: Boolean(arg.callerAllocated) });
    if (category.kind === "plainInput") return { value: toGValue(arg.type, arg.value) };
    if (category.kind === "callerAllocated") {
        if (category.inout) return { value: inoutBoxedForDescriptor(arg.type, arg.value as object) };
        const value = outBoxedForDescriptor(arg.type, arg.value as object);
        return { value, read: () => valueGetBoxed(value) };
    }
    const cell = category.inout ? outValueForDescriptor(arg.type, arg.value) : outValueForDescriptor(arg.type);
    return { value: cell.value, read: cell.read };
};

export function emitGObjectSignal(
    instance: object,
    signal: string,
    args: EmitArg[],
    returnDescriptor?: Descriptor,
): unknown {
    const gtype: GType = (instance as GTyped).__gtype__;
    const signalId = gSignalLookup(signalBaseName(signal), gtype) as number;
    const detail = signalDetailQuark(signal);

    const values: Handle[] = [toGValue(objectT("full"), instance)];
    const reads: (() => unknown)[] = [];
    for (const arg of args) {
        const cell = emitCell(arg);
        values.push(cell.value);
        if (cell.read) reads.push(cell.read);
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
