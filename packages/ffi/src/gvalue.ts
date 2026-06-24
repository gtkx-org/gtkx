import {
    alloc,
    type BoxedType,
    call,
    type Type,
    type FundamentalType,
    getType,
    type Handle,
    read,
    write,
} from "@gtkx/native";
import { GVALUE_LAYOUT, GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import {
    arrayT,
    bigint64T,
    biguint64T,
    bind,
    booleanT,
    boxedT,
    float32T,
    float64T,
    fundamentalT,
    int32T,
    objectT,
    stringT,
    uint32T,
    uint64T,
    voidT,
} from "./descriptors.js";
import {
    type GType,
    getStrvGtype,
    TYPE_BOOLEAN,
    TYPE_BOXED,
    TYPE_DOUBLE,
    TYPE_ENUM,
    TYPE_FLAGS,
    TYPE_FLOAT,
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
import { getHandle, requireWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";

export const newGValue = (): Handle => alloc(GVALUE_SIZE, "GValue");

export function valueGetType(value: Handle): GType {
    return read(value, biguint64T, GVALUE_LAYOUT.gTypeOffset) as GType;
}

const gValueInit = bind(LIB, "g_value_init", [GVALUE_T, biguint64T], voidT);

export const valueInit = (value: Handle, gtype: GType): void => {
    gValueInit(value, gtype);
};

export const newTypedGValue = (gtype: GType): Handle => {
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

export const setGValuePointer = (value: Handle, pointer: Handle): void => {
    gValueSetPointer(value, pointer);
};

const scalarBind = <F extends Type>(symbol: string, descriptor: F) => ({
    set: bind(LIB, `g_value_set_${symbol}`, [GVALUE_T, descriptor], voidT),
    get: bind(LIB, `g_value_get_${symbol}`, [GVALUE_T], descriptor),
});

const booleanBind = scalarBind("boolean", booleanT);
const intBind = scalarBind("int", int32T);
const uintBind = scalarBind("uint", uint32T);
const int64Bind = scalarBind("int64", bigint64T);
const uint64Bind = scalarBind("uint64", biguint64T);
const floatBind = scalarBind("float", float32T);
const doubleBind = scalarBind("double", float64T);
const stringBind = scalarBind("string", stringT("borrowed"));
const enumBind = scalarBind("enum", int32T);
const flagsBind = scalarBind("flags", uint32T);
const objectBind = scalarBind("object", objectT("borrowed"));

const PARAM_FUNDAMENTAL = fundamentalT(LIB, "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});
const paramBind = scalarBind("param", PARAM_FUNDAMENTAL);

const VARIANT_FUNDAMENTAL = fundamentalT(LIB, "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const variantBind = scalarBind("variant", VARIANT_FUNDAMENTAL);

export const valueSetBoolean = (value: Handle, v: boolean): void => {
    booleanBind.set(value, v);
};
export const valueGetBoolean = (value: Handle): boolean => Boolean(booleanBind.get(value));
export const valueSetInt = (value: Handle, v: number): void => {
    intBind.set(value, v);
};
export const valueGetInt = (value: Handle): number => intBind.get(value);
export const valueSetUint = (value: Handle, v: number): void => {
    uintBind.set(value, v);
};
export const valueGetUint = (value: Handle): number => uintBind.get(value);
export const valueSetInt64 = (value: Handle, v: bigint | number): void => {
    int64Bind.set(value, v);
};
export const valueGetInt64 = (value: Handle): bigint => int64Bind.get(value);
export const valueSetUint64 = (value: Handle, v: bigint | number): void => {
    uint64Bind.set(value, v);
};
export const valueGetUint64 = (value: Handle): bigint => uint64Bind.get(value);
export const valueSetFloat = (value: Handle, v: number): void => {
    floatBind.set(value, v);
};
export const valueGetFloat = (value: Handle): number => floatBind.get(value);
export const valueSetDouble = (value: Handle, v: number): void => {
    doubleBind.set(value, v);
};
export const valueGetDouble = (value: Handle): number => doubleBind.get(value);
export const valueSetString = (value: Handle, v: string | null): void => {
    stringBind.set(value, v);
};
export const valueGetString = (value: Handle): string | null => stringBind.get(value) ?? null;
export const valueSetEnum = (value: Handle, v: number): void => {
    enumBind.set(value, v);
};
export const valueGetEnum = (value: Handle): number => enumBind.get(value);
export const valueSetFlags = (value: Handle, v: number): void => {
    flagsBind.set(value, v);
};
export const valueGetFlags = (value: Handle): number => flagsBind.get(value);
export const valueSetObject = (value: Handle, v: object | null): void => {
    objectBind.set(value, tryGetHandle(v));
};
export const valueGetObject = (value: Handle): object | null => wrapHandle(objectBind.get(value));
export const valueSetParam = (value: Handle, v: object | null): void => {
    paramBind.set(value, tryGetHandle(v));
};
export const valueGetParam = (value: Handle): object | null => wrapHandle(paramBind.get(value));
export const valueSetVariant = (value: Handle, v: object | null): void => {
    variantBind.set(value, tryGetHandle(v));
};
export const valueGetVariant = (value: Handle): object | null => {
    const result = variantBind.get(value);
    return result === null ? null : wrapHandle(result, requireWrapperClass(TYPE_VARIANT));
};

const gValueSetBoxedStrv = bind(LIB, "g_value_set_boxed", [GVALUE_T, arrayT(stringT("borrowed"))], voidT);
const gValueGetBoxedStrv = bind(LIB, "g_value_get_boxed", [GVALUE_T], arrayT(stringT("borrowed")));

const valueSetStrv = (value: Handle, v: string[]): void => {
    gValueSetBoxedStrv(value, v);
};
const valueGetStrv = (value: Handle): string[] => (gValueGetBoxedStrv(value) as string[] | null) ?? [];

const setBoxedPayload = (
    value: Handle,
    symbol: "g_value_set_boxed" | "g_value_set_static_boxed",
    boxedHandle: Handle | null,
): void => {
    call(
        LIB,
        symbol,
        [
            { type: GVALUE_T, value },
            {
                type: boxedT(typeName(valueGetType(value)) ?? "GBoxed", { library: LIB }),
                value: boxedHandle,
            },
        ],
        voidT,
    );
};

export function valueSetBoxed(value: Handle, boxed: object | null): void {
    setBoxedPayload(value, "g_value_set_boxed", boxed === null ? null : getHandle(boxed));
}

export function valueSetStaticBoxed(value: Handle, boxed: object): void {
    setBoxedPayload(value, "g_value_set_static_boxed", getHandle(boxed));
}

const OUT_PARAM_STORAGE_SIZE = 8;

export function outValueFromFfi(innerFfi: Type, initial?: unknown): { value: Handle; read: () => unknown } {
    const storage = alloc(OUT_PARAM_STORAGE_SIZE);
    write(storage, uint64T, 0, 0);
    if (initial !== undefined) write(storage, innerFfi, 0, initial);
    const value = newTypedGValue(TYPE_POINTER);
    setGValuePointer(value, storage);
    return { value, read: () => read(storage, innerFfi, 0) };
}

export function outBoxedFromFfi(descriptor: Type, boxed: object): Handle {
    const value = newTypedGValue(resolveBoxedGtype(descriptor));
    valueSetBoxed(value, boxed);
    return value;
}

export function inoutBoxedFromFfi(descriptor: Type, boxed: object): Handle {
    const value = newTypedGValue(resolveBoxedGtype(descriptor));
    valueSetStaticBoxed(value, boxed);
    return value;
}

export function valueGetBoxed(value: Handle): object | null {
    const gtype = valueGetType(value);
    if (typeFundamental(gtype) !== TYPE_BOXED) {
        return null;
    }
    const cls = requireWrapperClass(gtype);
    const ptr = call(
        LIB,
        "g_value_dup_boxed",
        [{ type: GVALUE_T, value }],
        boxedT(typeName(gtype) ?? "GBoxed", { ownership: "full", library: LIB }),
    );
    return ptr === null ? null : wrapHandle(ptr as Handle, cls);
}

export function setGValueBoxed(value: object, boxed: object | null): void {
    valueSetBoxed(getHandle(value), boxed);
}

export function getGValueBoxed(value: object): object | null {
    return valueGetBoxed(getHandle(value));
}

const resolveBoxedInnerGtype = (descriptor: BoxedType): GType => {
    if (descriptor.getTypeFn && descriptor.library) {
        return call(descriptor.library, descriptor.getTypeFn, [], biguint64T) as GType;
    }
    const gtype = typeFromName(descriptor.innerType);
    if (gtype === TYPE_INVALID) {
        throw new Error(`Cannot resolve gtype for boxed type '${descriptor.innerType}'`);
    }
    return gtype;
};

const resolveFundamentalGtype = (descriptor: FundamentalType): GType => {
    if (descriptor.typeName) {
        const gtype = typeFromName(descriptor.typeName);
        if (gtype !== TYPE_INVALID) return gtype;
    }
    throw new Error(`Cannot resolve gtype for fundamental type without a typeName`);
};

export function resolveBoxedGtype(descriptor: Type): GType {
    if (descriptor.type === "boxed") return resolveBoxedInnerGtype(descriptor);
    if (descriptor.type === "fundamental") return resolveFundamentalGtype(descriptor);
    throw new Error(`resolveBoxedGtype: unsupported FFI type '${descriptor.type}'`);
}

function gtypeFromFfiType(descriptor: Type): GType {
    switch (descriptor.type) {
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
        case "gobject":
            return TYPE_OBJECT;
        case "enum":
        case "flags":
            return call(descriptor.library, descriptor.getTypeFn, [], biguint64T) as GType;
        case "boxed":
            return resolveBoxedInnerGtype(descriptor);
        case "fundamental":
            return resolveFundamentalGtype(descriptor);
        case "array":
            if (descriptor.itemType.type === "string" && descriptor.kind === "array") return getStrvGtype();
            throw new Error(`Unsupported array type ${descriptor.kind} of ${descriptor.itemType.type}`);
        default:
            throw new Error(`Unsupported FFI type '${descriptor.type}'`);
    }
}

export function newValueFromFfi(descriptor: Type): Handle {
    return newTypedGValue(gtypeFromFfiType(descriptor));
}

function objectToGValue(value: object | null): Handle {
    const v = newTypedGValue(value ? getType(getHandle(value)) : TYPE_OBJECT);
    valueSetObject(v, value);
    return v;
}

const getPointerValue = (value: Handle): null => {
    const ptr = read(value, uint64T, GVALUE_LAYOUT.dataOffset) as number;
    if (ptr !== 0) {
        throw new Error("G_TYPE_POINTER non-null values cannot be marshalled to JS");
    }
    return null;
};

type PayloadHandler = {
    set: (value: Handle, descriptor: Type, jsValue: unknown) => void;
    get: (value: Handle) => unknown;
};

const setBoxedOrStrv = (value: Handle, descriptor: Type, jsValue: unknown): void => {
    if (descriptor.type === "array") valueSetStrv(value, jsValue as string[]);
    else valueSetBoxed(value, jsValue as object | null);
};

const unsupportedSet = (gtype: GType): never => {
    throw new Error(`Unsupported GType for toGValue: ${typeName(gtype) ?? String(gtype)}`);
};

const payloadHandlers = new Map<GType, PayloadHandler>([
    [TYPE_BOOLEAN, { set: (value, _ffi, jsValue) => valueSetBoolean(value, jsValue as boolean), get: valueGetBoolean }],
    [TYPE_INT, { set: (value, _ffi, jsValue) => valueSetInt(value, jsValue as number), get: valueGetInt }],
    [TYPE_UINT, { set: (value, _ffi, jsValue) => valueSetUint(value, jsValue as number), get: valueGetUint }],
    [
        TYPE_INT64,
        { set: (value, _ffi, jsValue) => valueSetInt64(value, jsValue as bigint | number), get: valueGetInt64 },
    ],
    [
        TYPE_UINT64,
        { set: (value, _ffi, jsValue) => valueSetUint64(value, jsValue as bigint | number), get: valueGetUint64 },
    ],
    [TYPE_FLOAT, { set: (value, _ffi, jsValue) => valueSetFloat(value, jsValue as number), get: valueGetFloat }],
    [TYPE_DOUBLE, { set: (value, _ffi, jsValue) => valueSetDouble(value, jsValue as number), get: valueGetDouble }],
    [
        TYPE_STRING,
        { set: (value, _ffi, jsValue) => valueSetString(value, jsValue as string | null), get: valueGetString },
    ],
    [TYPE_ENUM, { set: (value, _ffi, jsValue) => valueSetEnum(value, jsValue as number), get: valueGetEnum }],
    [TYPE_FLAGS, { set: (value, _ffi, jsValue) => valueSetFlags(value, jsValue as number), get: valueGetFlags }],
    [
        TYPE_VARIANT,
        { set: (value, _ffi, jsValue) => valueSetVariant(value, jsValue as object | null), get: valueGetVariant },
    ],
    [TYPE_PARAM, { set: (value, _ffi, jsValue) => valueSetParam(value, jsValue as object | null), get: valueGetParam }],
    [TYPE_BOXED, { set: setBoxedOrStrv, get: valueGetBoxed }],
    [
        TYPE_OBJECT,
        { set: (value, _ffi, jsValue) => valueSetObject(value, jsValue as object | null), get: valueGetObject },
    ],
    [TYPE_POINTER, { set: (value) => unsupportedSet(valueGetType(value)), get: getPointerValue }],
]);

function setGValuePayload(value: Handle, gtype: GType, descriptor: Type, jsValue: unknown): void {
    const handler = payloadHandlers.get(typeFundamental(gtype));
    if (handler === undefined) unsupportedSet(gtype);
    else handler.set(value, descriptor, jsValue);
}

export function toGValue(descriptor: Type, jsValue: unknown): Handle {
    if (descriptor.type === "gobject") return objectToGValue(jsValue as object | null);
    const gtype = gtypeFromFfiType(descriptor);
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
