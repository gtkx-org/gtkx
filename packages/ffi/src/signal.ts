import { type CallbackType, call, type Type as FfiType, type Handle } from "@gtkx/native";
import { classifyArgCategory } from "./arg-category.js";
import { GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import { arrayT, biguint64T, bind, objectT, stringT, uint32T, uint64T, voidT } from "./descriptors.js";
import { tupleResult } from "./fn.js";
import type { GType, GTyped } from "./gtype.js";
import {
    fromGvalue,
    inoutBoxedFromFfi,
    newValueFromFfi,
    outBoxedFromFfi,
    outValueFromFfi,
    toGvalue,
    valueGetBoxed,
} from "./gvalue.js";
import { wrapHandler } from "./handler-trampoline.js";
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

export type SignalConnectSpec = {
    callback: CallbackType;
    handler: SignalHandler;
    after: boolean;
};

export function connectGobjectSignal(instance: object, signal: string, spec: SignalConnectSpec): number {
    const { callback, handler, after } = spec;
    const wrapped = wrapHandler(handler, callback, "skip");
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

export type EmitArg = {
    ffi: FfiType;
    direction?: "out" | "inout";
    callerAllocates?: boolean;
    value?: unknown;
};

const emitCell = (arg: EmitArg): { value: Handle; read?: () => unknown } => {
    const category = classifyArgCategory({ direction: arg.direction, callerAllocated: Boolean(arg.callerAllocates) });
    if (category.kind === "plainInput") return { value: toGvalue(arg.ffi, arg.value) };
    if (category.kind === "callerAllocated") {
        if (category.inout) return { value: inoutBoxedFromFfi(arg.ffi, arg.value as object) };
        const value = outBoxedFromFfi(arg.ffi, arg.value as object);
        return { value, read: () => valueGetBoxed(value) };
    }
    const cell = category.inout ? outValueFromFfi(arg.ffi, arg.value) : outValueFromFfi(arg.ffi);
    return { value: cell.value, read: cell.read };
};

export function emitGobjectSignal(instance: object, sigName: string, args: EmitArg[], returnFfi?: FfiType): unknown {
    const gtype: GType = (instance as GTyped).__gtype__;
    const signalId = gSignalLookup(signalBaseName(sigName), gtype) as number;
    const detail = signalDetailQuark(sigName);

    const values: Handle[] = [toGvalue(objectT("full"), instance)];
    const reads: (() => unknown)[] = [];
    for (const arg of args) {
        const cell = emitCell(arg);
        values.push(cell.value);
        if (cell.read) reads.push(cell.read);
    }

    if (returnFfi !== undefined) {
        const returnValue = newValueFromFfi(returnFfi);
        gSignalEmitv(values, signalId, detail, returnValue);
        return tupleResult(
            reads.map((emit) => emit()),
            fromGvalue(returnValue),
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
