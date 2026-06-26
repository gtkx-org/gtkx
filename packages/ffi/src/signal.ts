import { type CallbackType, call, type Handle, type Type } from "@gtkx/native";
import { classifyArgCategory } from "./arg-category.js";
import { wrapCallback } from "./callback.js";
import { GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import { arrayT, biguint64T, bind, objectT, stringT, uint32T, uint64T, voidT } from "./descriptors.js";
import { tupleResult } from "./fn.js";
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

export type SignalHandler = (...args: unknown[]) => unknown;

export const signalBaseName = (signal: string): string => {
    const detailIndex = signal.indexOf("::");
    return detailIndex === -1 ? signal : signal.slice(0, detailIndex);
};

const gQuarkFromString = bind(LIB, "g_quark_from_string", [stringT("borrowed")], uint32T);

export function signalDetailQuark(signal: string): number {
    const detailIndex = signal.indexOf("::");
    if (detailIndex === -1) return 0;
    return gQuarkFromString(signal.slice(detailIndex + 2)) as number;
}

type SignalConnectSpec = {
    callback: CallbackType;
    handler: SignalHandler;
    after: boolean;
};

export function connectGObjectSignal(instance: object, signal: string, spec: SignalConnectSpec): number {
    const { callback, handler, after } = spec;
    const wrapped = wrapCallback(handler, callback, "emitter");
    return call(
        LIB,
        "g_signal_connect_data",
        [
            { type: objectT("borrowed"), value: getHandle(instance) },
            { type: stringT("borrowed"), value: signal },
            { type: callback, value: wrapped },
            { type: uint32T, value: after ? 1 : 0 },
        ],
        uint64T,
    ) as number;
}

const gSignalEmitv = bind(
    LIB,
    "g_signal_emitv",
    [arrayT(GVALUE_T, "array", "borrowed", { elementSize: GVALUE_SIZE }), uint32T, uint32T, GVALUE_T],
    voidT,
);

const gSignalLookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);

type EmitArg = {
    type: Type;
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

export function emitGObjectSignal(instance: object, signal: string, args: EmitArg[], returnType?: Type): unknown {
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

    if (returnType !== undefined) {
        const returnValue = newGValueForDescriptor(returnType);
        gSignalEmitv(values, signalId, detail, returnValue);
        return tupleResult(
            reads.map((emit) => emit()),
            fromGValue(returnValue),
            true,
        );
    }
    gSignalEmitv(values, signalId, detail, undefined);
    return tupleResult(
        reads.map((emit) => emit()),
        undefined,
        false,
    );
}
