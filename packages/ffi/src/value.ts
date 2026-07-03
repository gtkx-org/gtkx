import { alloc, type Descriptor, type ExternalObject, getType, type Handle, read, write } from "@gtkx/native";
import { bind, createBindCache } from "./bind.js";
import {
    arrayT,
    bigint64T,
    biguint64T,
    booleanT,
    boxedT,
    float32T,
    float64T,
    int32T,
    objectT,
    stringT,
    uint32T,
    uint64T,
    voidT,
} from "./descriptors.js";
import { LIB, PARAM_T, VALUE_SIZE, VALUE_T, VARIANT_T } from "./library.js";
import { toNativeValue } from "./native-value.js";
import { getHandle, getWrapperClass, wrapHandle } from "./registry.js";
import {
    getStrvType,
    resolveBoxedType,
    resolveDescriptorType,
    resolveFundamentalType,
    resolveType,
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
    typeFundamental,
    typeName,
} from "./type.js";

type ValueTypeBind = {
    set: (value: ExternalObject<Handle>, nativeValue: unknown) => void;
    get: (value: ExternalObject<Handle>) => unknown;
};

const gValueInit = bind(LIB, "g_value_init", [VALUE_T, biguint64T], voidT);
const gValueCopy = bind(LIB, "g_value_copy", [VALUE_T, VALUE_T], voidT);

const bindValueType = (symbol: string, descriptor: Descriptor): ValueTypeBind => ({
    set: bind(LIB, `g_value_set_${symbol}`, [VALUE_T, descriptor], voidT),
    get: bind(LIB, `g_value_get_${symbol}`, [VALUE_T], descriptor),
});

const booleanValueType = bindValueType("boolean", booleanT);
const typeValueType = bindValueType("gtype", biguint64T);
const intValueType = bindValueType("int", int32T);
const uintValueType = bindValueType("uint", uint32T);
const int64ValueType = bindValueType("int64", bigint64T);
const uint64ValueType = bindValueType("uint64", biguint64T);
const floatValueType = bindValueType("float", float32T);
const doubleValueType = bindValueType("double", float64T);
const stringValueType = bindValueType("string", stringT("borrowed"));
const enumValueType = bindValueType("enum", int32T);
const flagsValueType = bindValueType("flags", uint32T);
const objectValueType = bindValueType("object", objectT("borrowed"));
const paramValueType = bindValueType("param", PARAM_T);
const variantValueType = bindValueType("variant", VARIANT_T);
const pointerValueType = bindValueType("pointer", uint64T);
const strvValueType: ValueTypeBind = {
    set: bind(LIB, "g_value_set_boxed", [VALUE_T, arrayT(stringT("borrowed"))], voidT),
    get: bind(LIB, "g_value_get_boxed", [VALUE_T], arrayT(stringT("borrowed"))),
};

const setBoxedCache = createBindCache();
const setStaticBoxedCache = createBindCache();
const dupBoxedCache = createBindCache();

const boxedTypeName = (type: bigint): string => typeName(type) ?? "GBoxed";

const setBoxedBind = (name: string) =>
    setBoxedCache(name, LIB, "g_value_set_boxed", [VALUE_T, boxedT(name, { sharedLibrary: LIB })], voidT);

const setStaticBoxedBind = (name: string) =>
    setStaticBoxedCache(name, LIB, "g_value_set_static_boxed", [VALUE_T, boxedT(name, { sharedLibrary: LIB })], voidT);

const dupBoxedBind = (name: string) =>
    dupBoxedCache(name, LIB, "g_value_dup_boxed", [VALUE_T], boxedT(name, { ownership: "full", sharedLibrary: LIB }));

const newValue = (): ExternalObject<Handle> => alloc(VALUE_SIZE, "GValue");

const newTypedValue = (type: bigint): ExternalObject<Handle> => {
    const value = newValue();
    gValueInit(value, type);
    return value;
};

export function getValueType(value: ExternalObject<Handle>): bigint {
    return read(value, biguint64T, 0) as bigint;
}

export function copyValue(dest: ExternalObject<Handle>, src: ExternalObject<Handle>): void {
    if (getValueType(dest) === TYPE_INVALID) {
        gValueInit(dest, getValueType(src));
    }
    gValueCopy(src, dest);
}

const boxedValueType = (type: bigint): ValueTypeBind => {
    const name = boxedTypeName(type);
    return { set: setBoxedBind(name), get: dupBoxedBind(name) };
};

const enumOrFlagsValueType = (type: bigint): ValueTypeBind =>
    typeFundamental(type) === TYPE_FLAGS ? flagsValueType : enumValueType;

const fundamentalValueType = (type: bigint): ValueTypeBind => {
    switch (typeFundamental(type)) {
        case TYPE_PARAM:
            return paramValueType;
        case TYPE_VARIANT:
            return variantValueType;
        default:
            throw new Error(`Unsupported fundamental type '${typeName(type) ?? String(type)}' for GValue`);
    }
};

const resolveValueTypeBind = (descriptor: Descriptor): ValueTypeBind => {
    if (descriptor.kind === "biguint64" && "type" in descriptor) {
        return typeValueType;
    }
    switch (descriptor.kind) {
        case "boolean":
            return booleanValueType;
        case "string":
            return stringValueType;
        case "int8":
        case "int16":
        case "int32":
            return intValueType;
        case "uint8":
        case "uint16":
        case "uint32":
            return uintValueType;
        case "int64":
        case "bigint64":
            return int64ValueType;
        case "uint64":
        case "biguint64":
            return uint64ValueType;
        case "float32":
            return floatValueType;
        case "float64":
            return doubleValueType;
        case "object":
            return objectValueType;
        case "enum":
        case "flags":
            return enumOrFlagsValueType(resolveType(descriptor.sharedLibrary, descriptor.getTypeFnName));
        case "boxed":
            return boxedValueType(resolveBoxedType(descriptor));
        case "fundamental":
            return fundamentalValueType(resolveFundamentalType(descriptor));
        case "array":
            if (descriptor.itemDescriptor.kind === "string" && descriptor.arrayKind === "array") {
                return strvValueType;
            }
            throw new Error(`Unsupported array type ${descriptor.arrayKind} of ${descriptor.itemDescriptor.kind}`);
        default:
            throw new Error(`Unsupported type descriptor '${descriptor.kind}'`);
    }
};

const objectValueTypeFor = (handle: unknown): bigint =>
    handle === null || handle === undefined ? TYPE_OBJECT : getType(handle as ExternalObject<Handle>);

export function newValueForDescriptor(descriptor: Descriptor): ExternalObject<Handle> {
    return newTypedValue(resolveDescriptorType(descriptor));
}

const toHandleValue = (descriptor: Descriptor, value: unknown): unknown => {
    if (descriptor.kind === "object" || descriptor.kind === "boxed") {
        return value == null ? null : getHandle(value as object);
    }
    return toNativeValue(descriptor, value);
};

export function toValue(descriptor: Descriptor, value: unknown): ExternalObject<Handle> {
    const nativeValue = toHandleValue(descriptor, value);
    const type = descriptor.kind === "object" ? objectValueTypeFor(nativeValue) : resolveDescriptorType(descriptor);
    const gValue = newTypedValue(type);
    resolveValueTypeBind(descriptor).set(gValue, nativeValue);
    return gValue;
}

const getStringValue = (value: ExternalObject<Handle>): string | null =>
    (stringValueType.get(value) ?? null) as string | null;

const getObjectValue = (value: ExternalObject<Handle>): object | null =>
    wrapHandle(objectValueType.get(value) as ExternalObject<Handle> | null);

const getFundamentalValue = (valueType: ValueTypeBind, type: bigint) => {
    return (value: ExternalObject<Handle>): object | null => {
        const handle = valueType.get(value) as ExternalObject<Handle> | null;
        return handle === null ? null : wrapHandle(handle, getWrapperClass(type));
    };
};

const getPointerValue = (value: ExternalObject<Handle>): null => {
    if (pointerValueType.get(value)) {
        throw new Error("G_TYPE_POINTER non-null values cannot be marshalled to JS");
    }
    return null;
};

export function valueGetBoxed(value: ExternalObject<Handle>): object | null {
    const type = getValueType(value);
    if (typeFundamental(type) !== TYPE_BOXED) {
        return null;
    }
    const cls = getWrapperClass(type);
    const boxed = dupBoxedBind(boxedTypeName(type))(value) as ExternalObject<Handle> | null;
    return wrapHandle(boxed, cls);
}

const getStrvValue = (value: ExternalObject<Handle>): string[] => (strvValueType.get(value) as string[] | null) ?? [];

const resolveValueGetter = (fundamental: bigint): ((value: ExternalObject<Handle>) => unknown) | undefined => {
    switch (fundamental) {
        case TYPE_BOOLEAN:
            return booleanValueType.get;
        case TYPE_GTYPE:
            return typeValueType.get;
        case TYPE_INT:
            return intValueType.get;
        case TYPE_UINT:
            return uintValueType.get;
        case TYPE_INT64:
            return int64ValueType.get;
        case TYPE_UINT64:
            return uint64ValueType.get;
        case TYPE_FLOAT:
            return floatValueType.get;
        case TYPE_DOUBLE:
            return doubleValueType.get;
        case TYPE_ENUM:
            return enumValueType.get;
        case TYPE_FLAGS:
            return flagsValueType.get;
        case TYPE_STRING:
            return getStringValue;
        case TYPE_OBJECT:
            return getObjectValue;
        case TYPE_PARAM:
            return getFundamentalValue(paramValueType, TYPE_PARAM);
        case TYPE_VARIANT:
            return getFundamentalValue(variantValueType, TYPE_VARIANT);
        case TYPE_BOXED:
            return valueGetBoxed;
        case TYPE_POINTER:
            return getPointerValue;
        default:
            return undefined;
    }
};

export function fromValue(value: ExternalObject<Handle>): unknown {
    const type = getValueType(value);
    if (type === getStrvType()) return getStrvValue(value);
    const get = resolveValueGetter(typeFundamental(type));
    if (get === undefined) {
        throw new Error(`Unsupported GType for fromValue: ${typeName(type) ?? String(type)}`);
    }
    return get(value);
}

export function outValueForDescriptor(
    descriptor: Descriptor,
    initial?: unknown,
): { value: ExternalObject<Handle>; read: () => unknown } {
    const storage = alloc(8);
    write(storage, uint64T, 0, 0);
    if (initial !== undefined) write(storage, descriptor, 0, initial);
    const value = newTypedValue(TYPE_POINTER);
    pointerValueType.set(value, storage);
    return { value, read: () => read(storage, descriptor, 0) };
}

const newBoxedValue = (
    descriptor: Descriptor,
    boxed: object,
    resolveSetBind: (name: string) => ValueTypeBind["set"],
): ExternalObject<Handle> => {
    const type = resolveDescriptorType(descriptor);
    const value = newTypedValue(type);
    resolveSetBind(boxedTypeName(type))(value, getHandle(boxed));
    return value;
};

export function outValueForBoxedDescriptor(descriptor: Descriptor, boxed: object): ExternalObject<Handle> {
    return newBoxedValue(descriptor, boxed, setBoxedBind);
}

export function inoutValueForBoxedDescriptor(descriptor: Descriptor, boxed: object): ExternalObject<Handle> {
    return newBoxedValue(descriptor, boxed, setStaticBoxedBind);
}

export function setValueBoxed(value: object, boxed: object | null): void {
    const gValue = getHandle(value);
    const name = boxedTypeName(getValueType(gValue));
    setBoxedBind(name)(gValue, boxed === null ? null : getHandle(boxed));
}

export function getValueBoxed(value: object): object | null {
    return valueGetBoxed(getHandle(value));
}
