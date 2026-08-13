import { type ExternalObject, type Handle, read } from "@gtkx/native";
import { bind } from "./bind.js";
import { biguint64T, booleanT, stringT, uint32T, voidT } from "./descriptors.js";
import { LIB, PARAM_T, VALUE_T } from "./library.js";
import { getInstanceType } from "./registry.js";
import {
    getStrvType,
    isTypedClass,
    TYPE_BOOLEAN,
    TYPE_BOXED,
    TYPE_CHAR,
    TYPE_DOUBLE,
    TYPE_ENUM,
    TYPE_FLAGS,
    TYPE_FLOAT,
    TYPE_GTYPE,
    TYPE_INT,
    TYPE_INT64,
    TYPE_INTERFACE,
    TYPE_INVALID,
    TYPE_LONG,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_POINTER,
    TYPE_STRING,
    TYPE_UCHAR,
    TYPE_UINT,
    TYPE_UINT64,
    TYPE_ULONG,
    TYPE_VARIANT,
    typeFundamental,
    typeIsA,
} from "./type.js";

type ValueGuard = (value: unknown) => boolean;
type ParamLayout = { flags: number; valueType: bigint };

const PARAM_READABLE = 1;
const PARAM_WRITABLE = 2;
const PARAM_CONSTRUCT_ONLY = 8;
const PARAM_LAX_VALIDATION = 16;
const READ_FLAGS = PARAM_READABLE | PARAM_WRITABLE | PARAM_CONSTRUCT_ONLY | PARAM_LAX_VALIDATION;
const FLAGS_BYTE_OFFSET = 16;
const VALUE_TYPE_BYTE_OFFSET = 24;
const LAYOUT_PROBE_NAME = "gtkx-param-layout";
const INT8_MINIMUM = -128;
const INT8_MAXIMUM = 127;
const UINT8_MAXIMUM = 255;
const INT32_MINIMUM = -2_147_483_648;
const INT32_MAXIMUM = 2_147_483_647;
const UINT32_MAXIMUM = 4_294_967_295;
const INT64_MINIMUM = -(2n ** 63n);
const INT64_MAXIMUM = 2n ** 63n - 1n;
const UINT64_MAXIMUM = 2n ** 64n - 1n;

const WRAPPED_FUNDAMENTALS: Set<bigint> = new Set([
    TYPE_BOXED,
    TYPE_INTERFACE,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_VARIANT,
]);

const isWideUnsignedValue: ValueGuard = wideIntegerGuardFor(0n, UINT64_MAXIMUM);

const SCALAR_GUARDS: Map<bigint, ValueGuard> = new Map([
    [TYPE_BOOLEAN, isBooleanValue],
    [TYPE_STRING, isStringValue],
    [TYPE_CHAR, integerGuardFor(INT8_MINIMUM, INT8_MAXIMUM)],
    [TYPE_UCHAR, integerGuardFor(0, UINT8_MAXIMUM)],
    [TYPE_INT, integerGuardFor(INT32_MINIMUM, INT32_MAXIMUM)],
    [TYPE_UINT, integerGuardFor(0, UINT32_MAXIMUM)],
    [TYPE_ENUM, integerGuardFor(INT32_MINIMUM, INT32_MAXIMUM)],
    [TYPE_FLAGS, integerGuardFor(0, UINT32_MAXIMUM)],
    [TYPE_LONG, wideIntegerGuardFor(INT64_MINIMUM, INT64_MAXIMUM)],
    [TYPE_ULONG, isWideUnsignedValue],
    [TYPE_INT64, wideIntegerGuardFor(INT64_MINIMUM, INT64_MAXIMUM)],
    [TYPE_UINT64, isWideUnsignedValue],
    [TYPE_FLOAT, isNumberValue],
    [TYPE_DOUBLE, isNumberValue],
    [TYPE_POINTER, isNullValue],
]);

const layout = { wasChecked: false };
const paramValueValidate = bind(LIB, "g_param_value_validate", [PARAM_T, VALUE_T], booleanT);
const paramSpecUnref = bind(LIB, "g_param_spec_unref", [PARAM_T], voidT);
const paramSpecRefSink = bind(LIB, "g_param_spec_ref_sink", [PARAM_T], PARAM_T);

const newParamSpecBoolean = bind(
    LIB,
    "g_param_spec_boolean",
    [stringT("borrowed"), stringT("borrowed"), stringT("borrowed"), booleanT, uint32T],
    PARAM_T,
);

const getParamFlags = (pspec: ExternalObject<Handle>): number => read(pspec, uint32T, FLAGS_BYTE_OFFSET) as number;

const getParamValueType = (pspec: ExternalObject<Handle>): bigint =>
    read(pspec, biguint64T, VALUE_TYPE_BYTE_OFFSET) as bigint;

const isParamWritable = (flags: number): boolean => (flags & PARAM_WRITABLE) !== 0;
const isParamConstructOnly = (flags: number): boolean => (flags & PARAM_CONSTRUCT_ONLY) !== 0;
const isParamLaxlyValidated = (flags: number): boolean => (flags & PARAM_LAX_VALIDATION) !== 0;

const wasParamValueModified = (pspec: ExternalObject<Handle>, value: ExternalObject<Handle>): boolean =>
    paramValueValidate(pspec, value) as boolean;

function isBooleanValue(value: unknown): boolean {
    return typeof value === "boolean";
}

function isStringValue(value: unknown): boolean {
    return value == null || typeof value === "string";
}

function isStrvValue(value: unknown): boolean {
    return value == null || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

function isNumberValue(value: unknown): boolean {
    return typeof value === "number";
}

function isAnyValue(): boolean {
    return true;
}

function isNullValue(value: unknown): boolean {
    return value == null;
}

function integerGuardFor(minimum: number, maximum: number): ValueGuard {
    return (value) => Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function toWideInteger(value: unknown): bigint | undefined {
    if (typeof value === "bigint") {
        return value;
    }

    return Number.isSafeInteger(value) ? BigInt(value as number) : undefined;
}

function wideIntegerGuardFor(minimum: bigint, maximum: bigint): ValueGuard {
    return (value) => {
        const wide = toWideInteger(value);

        return wide !== undefined && wide >= minimum && wide <= maximum;
    };
}

function resolveGtype(value: unknown): bigint {
    const instanceType = getInstanceType(value as object);

    if (instanceType !== TYPE_INVALID) {
        return instanceType;
    }

    return isTypedClass(value) ? value.__type__ : TYPE_INVALID;
}

function wrappedGuardFor(valueType: bigint): ValueGuard {
    return (value) => value == null || typeIsA(resolveGtype(value), valueType);
}

function exactGuardFor(valueType: bigint): ValueGuard | undefined {
    if (valueType === TYPE_GTYPE) {
        return isWideUnsignedValue;
    }

    return valueType === getStrvType() ? isStrvValue : undefined;
}

function valueGuardFor(valueType: bigint): ValueGuard {
    assertParamLayout();
    const exact = exactGuardFor(valueType);

    if (exact !== undefined) {
        return exact;
    }

    const fundamental = typeFundamental(valueType);

    if (WRAPPED_FUNDAMENTALS.has(fundamental)) {
        return wrappedGuardFor(valueType);
    }

    return SCALAR_GUARDS.get(fundamental) ?? isAnyValue;
}

function readProbeLayout(flags: number): ParamLayout {
    const probe = newParamSpecBoolean(LAYOUT_PROBE_NAME, null, null, false, flags) as ExternalObject<Handle>;
    paramSpecRefSink(probe);

    try {
        return { flags: getParamFlags(probe), valueType: getParamValueType(probe) };
    } finally {
        paramSpecUnref(probe);
    }
}

function isLayoutIntact(flags: number): boolean {
    const layout = readProbeLayout(flags);

    return (layout.flags & READ_FLAGS) === flags && layout.valueType === TYPE_BOOLEAN;
}

function assertParamLayout(): void {
    if (layout.wasChecked) {
        return;
    }

    layout.wasChecked = true;
    const readWrite = PARAM_READABLE | PARAM_WRITABLE;

    if (isLayoutIntact(readWrite) && isLayoutIntact(readWrite | PARAM_CONSTRUCT_ONLY | PARAM_LAX_VALIDATION)) {
        return;
    }

    throw new Error(
        "GParamSpec does not match the memory layout this build reads a property's flags and value type at",
    );
}

export {
    getParamFlags,
    getParamValueType,
    isParamConstructOnly,
    isParamLaxlyValidated,
    isParamWritable,
    type ValueGuard,
    valueGuardFor,
    wasParamValueModified,
};
