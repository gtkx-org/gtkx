import { alloc, bindField, type Descriptor, getType, read, write } from "@gtkx/native";
import { GVALUE_LAYOUT, GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import {
    arrayT,
    type BoxedDescriptor,
    bigint64T,
    biguint64T,
    bind,
    booleanT,
    boxedT,
    callTypeFunction,
    createBindCache,
    type FundamentalDescriptor,
    float32T,
    float64T,
    fundamentalT,
    int32T,
    isGtypeDescriptor,
    objectT,
    stringT,
    uint32T,
    uint64T,
    voidT,
} from "./descriptors.js";
import {
    getStrvGtype,
    TYPE_BOOLEAN,
    TYPE_BOXED,
    TYPE_DOUBLE,
    TYPE_ENUM,
    TYPE_FLAGS,
    TYPE_FLOAT,
    TYPE_GTYPE,
    TYPE_INT,
    TYPE_INT64,
    TYPE_INVALID,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_POINTER,
    TYPE_STRING,
    TYPE_UINT,
    TYPE_UINT64,
    TYPE_VARIANT,
    typeFromName,
    typeFundamental,
    typeName,
} from "./gtype.js";
import type { Handle } from "./handle.js";
import { getHandle, requireWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";

const newGValue = (): Handle => alloc(GVALUE_SIZE, "GValue");

const BIGUINT64_FIELD = bindField(biguint64T);
const UINT64_FIELD = bindField(uint64T);

export function valueGetType(value: Handle): bigint {
    return read(value, BIGUINT64_FIELD, GVALUE_LAYOUT.gTypeOffset) as bigint;
}

const gValueInit = bind(LIB, "g_value_init", [GVALUE_T, biguint64T], voidT);

const valueInit = (value: Handle, gtype: bigint): void => {
    gValueInit(value, gtype);
};

const newTypedGValue = (gtype: bigint): Handle => {
    const value = newGValue();
    valueInit(value, gtype);
    return value;
};

const gValueCopy = bind(LIB, "g_value_copy", [GVALUE_T, GVALUE_T], voidT);

export const valueCopyInto = (dest: Handle, src: Handle): void => {
    if (valueGetType(dest) === TYPE_INVALID) {
        valueInit(dest, valueGetType(src));
    }
    gValueCopy(src, dest);
};

const gValueSetPointer = bind(LIB, "g_value_set_pointer", [GVALUE_T, uint64T], voidT);

const setGValuePointer = (value: Handle, pointer: Handle): void => {
    gValueSetPointer(value, pointer);
};

const scalarBind = <T>(symbol: string, descriptor: Descriptor) => ({
    set: bind(LIB, `g_value_set_${symbol}`, [GVALUE_T, descriptor], voidT),
    get: bind(LIB, `g_value_get_${symbol}`, [GVALUE_T], descriptor) as (...values: unknown[]) => T,
});

const booleanBind = scalarBind<boolean>("boolean", booleanT);
const gtypeBind = scalarBind<bigint>("gtype", biguint64T);
const intBind = scalarBind<number>("int", int32T);
const uintBind = scalarBind<number>("uint", uint32T);
const int64Bind = scalarBind<bigint>("int64", bigint64T);
const uint64Bind = scalarBind<bigint>("uint64", biguint64T);
const floatBind = scalarBind<number>("float", float32T);
const doubleBind = scalarBind<number>("double", float64T);
const stringBind = scalarBind<string | null>("string", stringT("borrowed"));
const enumBind = scalarBind<number>("enum", int32T);
const flagsBind = scalarBind<number>("flags", uint32T);
const objectBind = scalarBind<Handle | null>("object", objectT("borrowed"));

const PARAM_FUNDAMENTAL = fundamentalT(LIB, "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});
const paramBind = scalarBind<Handle | null>("param", PARAM_FUNDAMENTAL);

const VARIANT_FUNDAMENTAL = fundamentalT(LIB, "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const variantBind = scalarBind<Handle | null>("variant", VARIANT_FUNDAMENTAL);

const valueSetBoolean = (value: Handle, v: boolean): void => {
    booleanBind.set(value, v);
};
const valueGetBoolean = (value: Handle): boolean => Boolean(booleanBind.get(value));
const valueSetGtype = (value: Handle, v: bigint | number): void => {
    gtypeBind.set(value, v);
};
const valueGetGtype = (value: Handle): bigint => gtypeBind.get(value);
const valueSetInt = (value: Handle, v: number): void => {
    intBind.set(value, v);
};
const valueGetInt = (value: Handle): number => intBind.get(value);
const valueSetUint = (value: Handle, v: number): void => {
    uintBind.set(value, v);
};
const valueGetUint = (value: Handle): number => uintBind.get(value);
const valueSetInt64 = (value: Handle, v: bigint | number): void => {
    int64Bind.set(value, v);
};
const valueGetInt64 = (value: Handle): bigint => int64Bind.get(value);
const valueSetUint64 = (value: Handle, v: bigint | number): void => {
    uint64Bind.set(value, v);
};
const valueGetUint64 = (value: Handle): bigint => uint64Bind.get(value);
const valueSetFloat = (value: Handle, v: number): void => {
    floatBind.set(value, v);
};
const valueGetFloat = (value: Handle): number => floatBind.get(value);
const valueSetDouble = (value: Handle, v: number): void => {
    doubleBind.set(value, v);
};
const valueGetDouble = (value: Handle): number => doubleBind.get(value);
const valueSetString = (value: Handle, v: string | null): void => {
    stringBind.set(value, v);
};
const valueGetString = (value: Handle): string | null => stringBind.get(value) ?? null;
const valueSetEnum = (value: Handle, v: number): void => {
    enumBind.set(value, v);
};
const valueGetEnum = (value: Handle): number => enumBind.get(value);
const valueSetFlags = (value: Handle, v: number): void => {
    flagsBind.set(value, v);
};
const valueGetFlags = (value: Handle): number => flagsBind.get(value);
const valueSetObject = (value: Handle, v: object | null): void => {
    objectBind.set(value, tryGetHandle(v));
};
const valueGetObject = (value: Handle): object | null => wrapHandle(objectBind.get(value));
const valueSetParam = (value: Handle, v: object | null): void => {
    paramBind.set(value, tryGetHandle(v));
};
const valueGetParam = (value: Handle): object | null => {
    const result = paramBind.get(value);
    return result === null ? null : wrapHandle(result, requireWrapperClass(TYPE_PARAM));
};
const valueSetVariant = (value: Handle, v: object | null): void => {
    variantBind.set(value, tryGetHandle(v));
};
const valueGetVariant = (value: Handle): object | null => {
    const result = variantBind.get(value);
    return result === null ? null : wrapHandle(result, requireWrapperClass(TYPE_VARIANT));
};

const gValueSetBoxedStrv = bind(LIB, "g_value_set_boxed", [GVALUE_T, arrayT(stringT("borrowed"))], voidT);
const gValueGetBoxedStrv = bind(LIB, "g_value_get_boxed", [GVALUE_T], arrayT(stringT("borrowed")));

const valueSetStrv = (value: Handle, v: string[]): void => {
    gValueSetBoxedStrv(value, v);
};
const valueGetStrv = (value: Handle): string[] => (gValueGetBoxedStrv(value) as string[] | null) ?? [];

const setBoxedCache = createBindCache();

const setBoxedPayload = (
    value: Handle,
    symbol: "g_value_set_boxed" | "g_value_set_static_boxed",
    boxedHandle: Handle | null,
): void => {
    const name = typeName(valueGetType(value)) ?? "GBoxed";
    const setBoxed = setBoxedCache(`${symbol} ${name}`, () =>
        bind(LIB, symbol, [GVALUE_T, boxedT(name, { sharedLibrary: LIB })], voidT),
    );
    setBoxed(value, boxedHandle);
};

function valueSetBoxed(value: Handle, boxed: object | null): void {
    setBoxedPayload(value, "g_value_set_boxed", boxed === null ? null : getHandle(boxed));
}

function valueSetStaticBoxed(value: Handle, boxed: object): void {
    setBoxedPayload(value, "g_value_set_static_boxed", getHandle(boxed));
}

const OUT_PARAM_STORAGE_SIZE = 8;

export function outValueForDescriptor(
    descriptor: Descriptor,
    initial?: unknown,
): { value: Handle; read: () => unknown } {
    const storage = alloc(OUT_PARAM_STORAGE_SIZE);
    const fieldCodec = bindField(descriptor);
    write(storage, UINT64_FIELD, 0, 0);
    if (initial !== undefined) write(storage, fieldCodec, 0, initial);
    const value = newTypedGValue(TYPE_POINTER);
    setGValuePointer(value, storage);
    return { value, read: () => read(storage, fieldCodec, 0) };
}

export function outBoxedForDescriptor(descriptor: Descriptor, boxed: object): Handle {
    const value = newTypedGValue(gtypeFromDescriptor(descriptor));
    valueSetBoxed(value, boxed);
    return value;
}

export function inoutBoxedForDescriptor(descriptor: Descriptor, boxed: object): Handle {
    const value = newTypedGValue(gtypeFromDescriptor(descriptor));
    valueSetStaticBoxed(value, boxed);
    return value;
}

const dupBoxedCache = createBindCache();

export function valueGetBoxed(value: Handle): object | null {
    const gtype = valueGetType(value);
    if (typeFundamental(gtype) !== TYPE_BOXED) {
        return null;
    }
    const cls = requireWrapperClass(gtype);
    const name = typeName(gtype) ?? "GBoxed";
    const dupBoxed = dupBoxedCache(name, () =>
        bind(LIB, "g_value_dup_boxed", [GVALUE_T], boxedT(name, { ownership: "full", sharedLibrary: LIB })),
    );
    const ptr = dupBoxed(value);
    return ptr === null ? null : wrapHandle(ptr as Handle, cls);
}

export function setGValueBoxed(value: object, boxed: object | null): void {
    valueSetBoxed(getHandle(value), boxed);
}

export function getGValueBoxed(value: object): object | null {
    return valueGetBoxed(getHandle(value));
}

const resolveBoxedInnerGtype = (descriptor: BoxedDescriptor): bigint => {
    if (descriptor.getTypeFnName && descriptor.sharedLibrary) {
        return callTypeFunction(descriptor.sharedLibrary, descriptor.getTypeFnName) as bigint;
    }
    const gtype = typeFromName(descriptor.typeName);
    if (gtype === TYPE_INVALID) {
        throw new Error(`Cannot resolve gtype for boxed type '${descriptor.typeName}'`);
    }
    return gtype;
};

const resolveFundamentalGtype = (descriptor: FundamentalDescriptor): bigint => {
    if (descriptor.typeName) {
        const gtype = typeFromName(descriptor.typeName);
        if (gtype !== TYPE_INVALID) return gtype;
    }
    throw new Error(`Cannot resolve gtype for fundamental type without a typeName`);
};

export function gtypeFromDescriptor(descriptor: Descriptor): bigint {
    if (isGtypeDescriptor(descriptor)) return TYPE_GTYPE;
    switch (descriptor.kind) {
        case "boolean":
            return TYPE_BOOLEAN;
        case "string":
            return TYPE_STRING;
        case "int8":
        case "int16":
        case "int32":
            return TYPE_INT;
        case "uint8":
        case "uint16":
        case "uint32":
            return TYPE_UINT;
        case "int64":
        case "bigint64":
            return TYPE_INT64;
        case "uint64":
        case "biguint64":
            return TYPE_UINT64;
        case "float32":
            return TYPE_FLOAT;
        case "float64":
            return TYPE_DOUBLE;
        case "object":
            return TYPE_OBJECT;
        case "enum":
        case "flags":
            return callTypeFunction(descriptor.sharedLibrary, descriptor.getTypeFnName) as bigint;
        case "boxed":
            return resolveBoxedInnerGtype(descriptor);
        case "fundamental":
            return resolveFundamentalGtype(descriptor);
        case "array":
            if (descriptor.itemDescriptor.kind === "string" && descriptor.arrayKind === "array") return getStrvGtype();
            throw new Error(`Unsupported array type ${descriptor.arrayKind} of ${descriptor.itemDescriptor.kind}`);
        default:
            throw new Error(`Unsupported type descriptor '${descriptor.kind}'`);
    }
}

export function newGValueForDescriptor(descriptor: Descriptor): Handle {
    return newTypedGValue(gtypeFromDescriptor(descriptor));
}

function objectToGValue(value: object | null): Handle {
    const v = newTypedGValue(value ? getType(getHandle(value)) : TYPE_OBJECT);
    valueSetObject(v, value);
    return v;
}

const getPointerValue = (value: Handle): null => {
    const ptr = read(value, UINT64_FIELD, GVALUE_LAYOUT.dataOffset) as number;
    if (ptr !== 0) {
        throw new Error("G_TYPE_POINTER non-null values cannot be marshalled to JS");
    }
    return null;
};

type PayloadHandler = {
    set: (value: Handle, descriptor: Descriptor, jsValue: unknown) => void;
    get: (value: Handle) => unknown;
};

const setBoxedOrStrv = (value: Handle, descriptor: Descriptor, jsValue: unknown): void => {
    if (descriptor.kind === "array") valueSetStrv(value, jsValue as string[]);
    else valueSetBoxed(value, jsValue as object | null);
};

const unsupportedSet = (gtype: bigint): never => {
    throw new Error(`Unsupported GType for toGValue: ${typeName(gtype) ?? String(gtype)}`);
};

const payloadHandlers = new Map<bigint, PayloadHandler>([
    [
        TYPE_BOOLEAN,
        { set: (value, _descriptor, jsValue) => valueSetBoolean(value, jsValue as boolean), get: valueGetBoolean },
    ],
    [TYPE_INT, { set: (value, _descriptor, jsValue) => valueSetInt(value, jsValue as number), get: valueGetInt }],
    [TYPE_UINT, { set: (value, _descriptor, jsValue) => valueSetUint(value, jsValue as number), get: valueGetUint }],
    [
        TYPE_INT64,
        { set: (value, _descriptor, jsValue) => valueSetInt64(value, jsValue as bigint | number), get: valueGetInt64 },
    ],
    [
        TYPE_UINT64,
        {
            set: (value, _descriptor, jsValue) => valueSetUint64(value, jsValue as bigint | number),
            get: valueGetUint64,
        },
    ],
    [TYPE_FLOAT, { set: (value, _descriptor, jsValue) => valueSetFloat(value, jsValue as number), get: valueGetFloat }],
    [
        TYPE_DOUBLE,
        { set: (value, _descriptor, jsValue) => valueSetDouble(value, jsValue as number), get: valueGetDouble },
    ],
    [
        TYPE_STRING,
        { set: (value, _descriptor, jsValue) => valueSetString(value, jsValue as string | null), get: valueGetString },
    ],
    [
        TYPE_GTYPE,
        {
            set: (value, _descriptor, jsValue) => valueSetGtype(value, jsValue as bigint | number),
            get: valueGetGtype,
        },
    ],
    [TYPE_ENUM, { set: (value, _descriptor, jsValue) => valueSetEnum(value, jsValue as number), get: valueGetEnum }],
    [TYPE_FLAGS, { set: (value, _descriptor, jsValue) => valueSetFlags(value, jsValue as number), get: valueGetFlags }],
    [
        TYPE_VARIANT,
        {
            set: (value, _descriptor, jsValue) => valueSetVariant(value, jsValue as object | null),
            get: valueGetVariant,
        },
    ],
    [
        TYPE_PARAM,
        { set: (value, _descriptor, jsValue) => valueSetParam(value, jsValue as object | null), get: valueGetParam },
    ],
    [TYPE_BOXED, { set: setBoxedOrStrv, get: valueGetBoxed }],
    [
        TYPE_OBJECT,
        { set: (value, _descriptor, jsValue) => valueSetObject(value, jsValue as object | null), get: valueGetObject },
    ],
    [TYPE_POINTER, { set: (value) => unsupportedSet(valueGetType(value)), get: getPointerValue }],
]);

function setGValuePayload(value: Handle, gtype: bigint, descriptor: Descriptor, jsValue: unknown): void {
    const handler = payloadHandlers.get(typeFundamental(gtype));
    if (handler === undefined) unsupportedSet(gtype);
    else handler.set(value, descriptor, jsValue);
}

export function toGValue(descriptor: Descriptor, jsValue: unknown): Handle {
    if (descriptor.kind === "object") return objectToGValue(jsValue as object | null);
    const gtype = gtypeFromDescriptor(descriptor);
    const value = newTypedGValue(gtype);
    setGValuePayload(value, gtype, descriptor, jsValue);
    return value;
}

export function fromGValue(value: Handle): unknown {
    const gtype = valueGetType(value);
    if (gtype === getStrvGtype()) return valueGetStrv(value);
    const handler = payloadHandlers.get(typeFundamental(gtype));
    if (handler === undefined) {
        throw new Error(`Unsupported GType for fromGValue: ${typeName(gtype) ?? String(gtype)}`);
    }
    return handler.get(value);
}
