import { type ExternalObject, type Handle, resolveFunction } from "@gtkx/native";
import type { SignalSpec } from "./register-class.js";
import { bind } from "./bind.js";
import { biguint64T, booleanT, bufferT, sizedArrayT, stringT, structT, uint32T, voidT } from "./descriptors.js";
import { LIB } from "./library.js";
import { canonicalSignalName } from "./signal.js";
import { TYPE_BOOLEAN, TYPE_INTERFACE, TYPE_NONE, typeIsA } from "./type.js";

type ClassSignal = Omit<SignalSpec, "paramTypes" | "returnType"> & {
    name: string;
    paramTypes: bigint[];
    returnType?: bigint;
};

type PreparedSignal = {
    name: string;
    flags: number;
    paramTypes: bigint[];
    returnType: bigint;
    accumulator: ExternalObject<Handle> | null;
};

const signalIsValidName = bind(LIB, "g_signal_is_valid_name", [stringT("borrowed")], booleanT);
const typeIsValue = bind(LIB, "g_type_check_is_value_type", [biguint64T], booleanT);
const signalLookup = bind(LIB, "g_signal_lookup", [stringT("borrowed"), biguint64T], uint32T);
const classRef = bind(LIB, "g_type_class_ref", [biguint64T], structT("borrowed"));
const classUnref = bind(LIB, "g_type_class_unref", [structT("borrowed")], voidT);
const interfaceRef = bind(LIB, "g_type_default_interface_ref", [biguint64T], structT("borrowed"));
const interfaceUnref = bind(LIB, "g_type_default_interface_unref", [structT("borrowed")], voidT);
const signalNew = bind(LIB, "g_signal_newv", [
    stringT("borrowed"), biguint64T, uint32T, bufferT, bufferT, bufferT, bufferT, biguint64T, uint32T,
    sizedArrayT(biguint64T, 8, "borrowed"),
], uint32T);

const accumulatorSymbols = {
    "first-wins": "g_signal_accumulator_first_wins",
    "true-handled": "g_signal_accumulator_true_handled",
};

function prepareSignal(signal: ClassSignal): PreparedSignal {
    if (!signalIsValidName(signal.name)) {
        throw new TypeError(`Invalid signal name '${signal.name}'`);
    }

    const name = canonicalSignalName(signal.name);
    const returnType = signal.returnType ?? TYPE_NONE;
    const valueTypes = returnType === TYPE_NONE ? signal.paramTypes : [...signal.paramTypes, returnType];
    if (valueTypes.some((type) => !typeIsValue(type))) {
        throw new TypeError(`Signal '${name}' uses a type that cannot hold a value`);
    }

    return {
        name,
        flags: signal.flags ?? 1,
        paramTypes: signal.paramTypes,
        returnType,
        accumulator: prepareAccumulator(signal.accumulator, returnType),
    };
}

function prepareAccumulator(
    accumulator: ClassSignal["accumulator"],
    returnType: bigint,
): ExternalObject<Handle> | null {
    if (returnType !== TYPE_BOOLEAN && accumulator === "true-handled") {
        throw new TypeError("The true-handled accumulator requires a boolean return");
    }

    return accumulator === undefined ? null : resolveFunction(LIB, accumulatorSymbols[accumulator]);
}

function checkExistingSignals(signals: PreparedSignal[], type: bigint): void {
    const isInterface = typeIsA(type, TYPE_INTERFACE);
    const handle = isInterface ? interfaceRef(type) : classRef(type);
    const unref = isInterface ? interfaceUnref : classUnref;

    try {
        const existing = signals.find((signal) => signalLookup(signal.name, type) !== 0);
        if (existing !== undefined) {
            throw new TypeError(`Signal '${existing.name}' already exists`);
        }
    } finally {
        unref(handle);
    }
}

function prepareClassSignals(signals: ClassSignal[], parent: bigint, interfaces: bigint[]): (type: bigint) => void {
    const prepared = signals.map((signal) => prepareSignal(signal));
    if (new Set(prepared.map((signal) => signal.name)).size !== prepared.length) {
        throw new TypeError("Signal names must be unique");
    }

    if (prepared.length > 0) {
        for (const type of [parent, ...interfaces]) {
            checkExistingSignals(prepared, type);
        }
    }

    return (type) => {
        for (const signal of prepared) {
            signalNew(signal.name, type, signal.flags, null, signal.accumulator, null, null, signal.returnType,
                signal.paramTypes.length, signal.paramTypes);
        }
    };
}

export { prepareClassSignals, type ClassSignal };
