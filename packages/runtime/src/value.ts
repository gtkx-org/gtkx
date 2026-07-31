import { alloc, type Descriptor, type ExternalObject, getType, type Handle, read, write } from "@gtkx/native";
import { bind, createBindCache } from "./bind.js";
import {
    type ArrayDescriptor,
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
import { toNative } from "./native-value.js";
import { getHandle, getWrapperClass, wrapHandle } from "./registry.js";
import {
    getStrvType,
    isResolvableDescriptor,
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

type ValueType = {
    set: (value: ExternalObject<Handle>, nativeValue: unknown) => void;
    get: (value: ExternalObject<Handle>) => unknown;
};

type ValueGetter = (value: ExternalObject<Handle>) => unknown;

const setBoxedCache = createBindCache();
const setStaticBoxedCache = createBindCache();
const dupBoxedCache = createBindCache();
const gValueInit = bind(LIB, "g_value_init", [VALUE_T, biguint64T], voidT);
const gValueCopy = bind(LIB, "g_value_copy", [VALUE_T, VALUE_T], voidT);
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

const strvValueType: ValueType = {
    set: bind(LIB, "g_value_set_boxed", [VALUE_T, arrayT(stringT("borrowed"))], voidT),
    get: bind(LIB, "g_value_get_boxed", [VALUE_T], arrayT(stringT("borrowed"))),
};

const PLAIN_VALUE_TYPES: Partial<Record<Descriptor["kind"], ValueType>> = {
    boolean: booleanValueType,
    string: stringValueType,
    int8: intValueType,
    int16: intValueType,
    int32: intValueType,
    uint8: uintValueType,
    uint16: uintValueType,
    uint32: uintValueType,
    int64: int64ValueType,
    bigint64: int64ValueType,
    uint64: uint64ValueType,
    biguint64: uint64ValueType,
    float32: floatValueType,
    float64: doubleValueType,
    object: objectValueType,
};

const PLAIN_VALUE_GETTERS: Map<bigint, ValueGetter> = new Map([
    [TYPE_BOOLEAN, booleanValueType.get],
    [TYPE_GTYPE, typeValueType.get],
    [TYPE_INT, intValueType.get],
    [TYPE_UINT, uintValueType.get],
    [TYPE_INT64, int64ValueType.get],
    [TYPE_UINT64, uint64ValueType.get],
    [TYPE_FLOAT, floatValueType.get],
    [TYPE_DOUBLE, doubleValueType.get],
    [TYPE_ENUM, enumValueType.get],
    [TYPE_FLAGS, flagsValueType.get],
]);

const PLAIN_VALUE_SETTERS: Map<bigint, ValueType["set"]> = new Map([
    [TYPE_BOOLEAN, booleanValueType.set],
    [TYPE_GTYPE, typeValueType.set],
    [TYPE_INT, intValueType.set],
    [TYPE_UINT, uintValueType.set],
    [TYPE_INT64, int64ValueType.set],
    [TYPE_UINT64, uint64ValueType.set],
    [TYPE_FLOAT, floatValueType.set],
    [TYPE_DOUBLE, doubleValueType.set],
    [TYPE_ENUM, enumValueType.set],
    [TYPE_FLAGS, flagsValueType.set],
]);

const WRAPPED_VALUE_SETTERS: Map<bigint, ValueType["set"]> = new Map([
    [TYPE_STRING, setStringValue],
    [TYPE_OBJECT, handleSetter(objectValueType)],
    [TYPE_PARAM, handleSetter(paramValueType)],
    [TYPE_VARIANT, handleSetter(variantValueType)],
    [TYPE_BOXED, setBoxedFromValue],
]);

const getBoxedTypeName = (type: bigint): string => typeName(type) ?? "GBoxed";
const newValue = (): ExternalObject<Handle> => alloc(VALUE_SIZE, resolveBoxedType(VALUE_T));

function bindValueType(symbol: string, descriptor: Descriptor): ValueType {
    return {
        set: bind(LIB, `g_value_set_${symbol}`, [VALUE_T, descriptor], voidT),
        get: bind(LIB, `g_value_get_${symbol}`, [VALUE_T], descriptor),
    };
}

const setBoxedBind = (name: string) =>
    setBoxedCache(name, LIB, "g_value_set_boxed", [VALUE_T, boxedT(name, { sharedLibrary: LIB })], voidT);

const setStaticBoxedBind = (name: string) =>
    setStaticBoxedCache(name, LIB, "g_value_set_static_boxed", [VALUE_T, boxedT(name, { sharedLibrary: LIB })], voidT);

const dupBoxedBind = (name: string) =>
    dupBoxedCache(name, LIB, "g_value_dup_boxed", [VALUE_T], boxedT(name, { ownership: "full", sharedLibrary: LIB }));

const boxedValueType = (type: bigint): ValueType => {
    const name = getBoxedTypeName(type);

    return { set: setBoxedBind(name), get: dupBoxedBind(name) };
};

const enumOrFlagsValueType = (type: bigint): ValueType =>
    typeFundamental(type) === TYPE_FLAGS ? flagsValueType : enumValueType;

const fundamentalValueType = (type: bigint): ValueType => {
    switch (typeFundamental(type)) {
        case TYPE_PARAM: {
            return paramValueType;
        }
        case TYPE_VARIANT: {
            return variantValueType;
        }
        case TYPE_BOXED: {
            return boxedValueType(type);
        }
        default: {
            throw new Error(`Unsupported fundamental type '${typeName(type) ?? String(type)}' for value`);
        }
    }
};

function getValueType(value: ExternalObject<Handle>): bigint {
    return read(value, biguint64T, 0) as bigint;
}

function copyValue(dest: ExternalObject<Handle>, src: ExternalObject<Handle>): void {
    if (getValueType(dest) === TYPE_INVALID) {
        gValueInit(dest, getValueType(src));
    }

    gValueCopy(src, dest);
}

const newTypedValue = (type: bigint): ExternalObject<Handle> => {
    const value = newValue();
    gValueInit(value, type);

    return value;
};

const newBoxedValue = (
    descriptor: Descriptor,
    boxed: object,
    resolveSetBind: (name: string) => ValueType["set"],
): ExternalObject<Handle> => {
    const type = resolveDescriptorType(descriptor);
    const value = newTypedValue(type);
    resolveSetBind(getBoxedTypeName(type))(value, getHandle(boxed));

    return value;
};

/**
 * Duplicates the boxed value held by a GValue and returns the copy wrapped in the
 * class registered for its GType, or null when the GValue holds no boxed type.
 */
function getBoxedValue(value: ExternalObject<Handle>): object | null {
    const type = getValueType(value);

    if (typeFundamental(type) !== TYPE_BOXED) {
        return null;
    }

    const cls = getWrapperClass(type);
    const boxed = dupBoxedBind(getBoxedTypeName(type))(value) as ExternalObject<Handle> | null;

    return wrapHandle(boxed, cls);
}

/** Stores a boxed object, or null, into a GValue that holds a boxed type. */
function setBoxedValue(value: ExternalObject<Handle>, boxed: object | null): void {
    const name = getBoxedTypeName(getValueType(value));
    setBoxedBind(name)(value, boxed === null ? null : getHandle(boxed));
}

const arrayValueType = (descriptor: ArrayDescriptor): ValueType => {
    if (descriptor.itemDescriptor.kind === "string" && descriptor.arrayKind === "array") {
        return strvValueType;
    }

    throw new Error(`Unsupported array type ${descriptor.arrayKind} of ${descriptor.itemDescriptor.kind}`);
};

const resolveValueType = (descriptor: Descriptor): ValueType => {
    if (descriptor.kind === "biguint64" && "type" in descriptor) {
        return typeValueType;
    }

    const plain = PLAIN_VALUE_TYPES[descriptor.kind];

    if (plain !== undefined) {
        return plain;
    }

    if (!isResolvableDescriptor(descriptor)) {
        throw new Error(`Unsupported type descriptor '${descriptor.kind}'`);
    }

    switch (descriptor.kind) {
        case "enum":
        case "flags": {
            return enumOrFlagsValueType(resolveType(descriptor.sharedLibrary, descriptor.getTypeFnName));
        }
        case "boxed": {
            return boxedValueType(resolveBoxedType(descriptor));
        }
        case "fundamental": {
            return fundamentalValueType(resolveFundamentalType(descriptor));
        }
        case "array": {
            return arrayValueType(descriptor);
        }
    }
};

const wrappedValueGetter = (fundamental: bigint): ValueGetter | undefined => {
    switch (fundamental) {
        case TYPE_STRING: {
            return (value) => stringValueType.get(value) ?? null;
        }
        case TYPE_OBJECT: {
            return (value) => wrapHandle(objectValueType.get(value) as ExternalObject<Handle> | null);
        }
        case TYPE_PARAM: {
            return (value) =>
                wrapHandle(paramValueType.get(value) as ExternalObject<Handle> | null, getWrapperClass(TYPE_PARAM));
        }
        case TYPE_VARIANT: {
            return (value) =>
                wrapHandle(variantValueType.get(value) as ExternalObject<Handle> | null, getWrapperClass(TYPE_VARIANT));
        }
        case TYPE_BOXED: {
            return getBoxedValue;
        }
        case TYPE_POINTER: {
            return (value) => {
                if (pointerValueType.get(value)) {
                    throw new Error("G_TYPE_POINTER non-null values cannot be marshalled to JS");
                }

                return null;
            };
        }
        default: {
            return undefined;
        }
    }
};

function setStringValue(value: ExternalObject<Handle>, nativeValue: unknown): void {
    stringValueType.set(value, nativeValue ?? null);
}

function handleSetter(target: ValueType): ValueType["set"] {
    return (value, nativeValue) => {
        target.set(value, nativeValue == null ? null : getHandle(nativeValue));
    };
}

function setBoxedFromValue(value: ExternalObject<Handle>, nativeValue: unknown): void {
    setBoxedValue(value, nativeValue ?? null);
}

const resolveValueGetter = (fundamental: bigint): ValueGetter | undefined =>
    PLAIN_VALUE_GETTERS.get(fundamental) ?? wrappedValueGetter(fundamental);

const resolveValueSetter = (fundamental: bigint): ValueType["set"] | undefined =>
    PLAIN_VALUE_SETTERS.get(fundamental) ?? WRAPPED_VALUE_SETTERS.get(fundamental);

function intoValue(value: ExternalObject<Handle>, jsValue: unknown): void {
    const type = getValueType(value);
    const set = resolveValueSetter(typeFundamental(type));

    if (set === undefined) {
        throw new Error(`Unsupported type for intoValue: ${typeName(type) ?? String(type)}`);
    }

    set(value, jsValue);
}

const resolveNativeValue = (descriptor: Descriptor, value: unknown): unknown => {
    const isHandleKind = descriptor.kind === "object" || descriptor.kind === "boxed";

    if (!isHandleKind) {
        return toNative(descriptor, value);
    }

    return value == null ? null : getHandle(value);
};

const resolveValueGType = (descriptor: Descriptor, nativeValue: unknown): bigint => {
    if (descriptor.kind !== "object") {
        return resolveDescriptorType(descriptor);
    }

    return nativeValue == null ? TYPE_OBJECT : getType(nativeValue as ExternalObject<Handle>);
};

function toValue(descriptor: Descriptor, value: unknown): ExternalObject<Handle> {
    const nativeValue = resolveNativeValue(descriptor, value);
    const type = resolveValueGType(descriptor, nativeValue);
    const gValue = newTypedValue(type);
    resolveValueType(descriptor).set(gValue, nativeValue);

    return gValue;
}

function fromValue(value: ExternalObject<Handle>): unknown {
    const type = getValueType(value);

    if (type === getStrvType()) {
        return strvValueType.get(value);
    }

    const get = resolveValueGetter(typeFundamental(type));

    if (get === undefined) {
        throw new Error(`Unsupported type for fromValue: ${typeName(type) ?? String(type)}`);
    }

    return get(value);
}

function newValueForDescriptor(descriptor: Descriptor): ExternalObject<Handle> {
    return newTypedValue(resolveDescriptorType(descriptor));
}

function outValueForDescriptor(
    descriptor: Descriptor,
    initial?: unknown,
): { value: ExternalObject<Handle>; read: () => unknown } {
    const storage = alloc(8);
    write(storage, uint64T, 0, 0);

    if (initial !== undefined) {
        write(storage, descriptor, 0, initial);
    }

    const value = newTypedValue(TYPE_POINTER);
    pointerValueType.set(value, storage);

    return { value, read: () => read(storage, descriptor, 0) };
}

function outValueForBoxedDescriptor(descriptor: Descriptor, boxed: object): ExternalObject<Handle> {
    return newBoxedValue(descriptor, boxed, setBoxedBind);
}

function inoutValueForBoxedDescriptor(descriptor: Descriptor, boxed: object): ExternalObject<Handle> {
    return newBoxedValue(descriptor, boxed, setStaticBoxedBind);
}

export {
    getValueType,
    intoValue,
    copyValue,
    getBoxedValue,
    setBoxedValue,
    toValue,
    fromValue,
    newValueForDescriptor,
    outValueForDescriptor,
    outValueForBoxedDescriptor,
    inoutValueForBoxedDescriptor,
};
