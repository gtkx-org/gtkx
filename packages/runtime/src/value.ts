import { alloc, type ExternalObject, getType, type Handle } from "@gtkx/native";
import { encodePointer, retainPropertyPointer } from "@gtkx/native/internal";
import type { Descriptor } from "./descriptor-types.js";
import { bind, createBindCache } from "./bind.js";
import {
    type ArrayDescriptor,
    arrayT,
    bigint64T,
    biguint64T,
    booleanT,
    boxedT,
    bufferT,
    byteArrayT,
    float32T,
    float64T,
    type FundamentalDescriptor,
    fundamentalLifecycleFor,
    fundamentalT,
    hashTableT,
    int8T,
    int32T,
    isGtypeDescriptor,
    type ObjectDescriptor,
    objectT,
    preserveArrayNull,
    stringT,
    structT,
    uint8T,
    uint32T,
    voidT,
} from "./descriptors.js";
import { read, write } from "./field.js";
import { LIB, PARAM_T, VALUE_SIZE, VALUE_T, VARIANT_T } from "./library.js";
import { fromNative, toNative } from "./native-value.js";
import { wrapCallbackValue } from "./callback.js";
import { compileDescriptor } from "./scalar-plan.js";
import {
    INT32_MAXIMUM,
    INT32_MINIMUM,
    INT64_MAXIMUM,
    INT64_MINIMUM,
    isStringArray,
    resolveGtype,
    UINT64_MAXIMUM,
    type ValueGuard,
} from "./param-spec.js";
import {
    coerceGType,
    describeValueKind,
    getHandle,
    getWrapperClass,
    wrapFundamentalHandle,
    wrapHandle,
    wrapObject,
} from "./registry.js";
import {
    getByteArrayType,
    getStrvType,
    isObjectPtrArray,
    isResolvableDescriptor,
    isScalarGArray,
    isStringHashTable,
    resolveBoxedType,
    resolveDescriptorType,
    resolveFundamentalType,
    resolveType,
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
    type TypedClass,
    typeFundamental,
    typeIsA,
    typeName,
} from "./type.js";

type ValueType = {
    set: (value: ExternalObject<Handle>, nativeValue: unknown) => void;
    get: (value: ExternalObject<Handle>) => unknown;
};

type ValueGetter = (value: ExternalObject<Handle>) => unknown;
type ValueWriter = ValueType["set"];
type ValueNarrower = (jsValue: unknown) => unknown;
/**
 * Values accepted when a `GObject.Value` parameter infers its GType:
 *
 * - `string`: `gchararray`; `boolean`: `gboolean`.
 * - `number`: `gint` for integers in range, otherwise `gdouble`.
 * - `bigint`: `gint64`, or `guint64` above its range.
 * - `string[]`: `GStrv`; wrapper instance: its registered GType.
 * - `null`: NULL `gpointer`, matching GJS inference; few callees accept it.
 *
 * Use an explicitly initialized `GObject.Value` for types inference cannot select, such as
 * `guchar` or an enumeration.
 */
type JsValue = string | number | bigint | boolean | string[] | TypedClass | null;

const setBoxedCache = createBindCache();
const setStaticBoxedCache = createBindCache();
const dupBoxedCache = createBindCache();
const setInstanceCache = createBindCache();
const peekPointerCache = createBindCache();
const gValueInit = bind(LIB, "g_value_init", [VALUE_T, biguint64T], voidT);
const gValueCopy = bind(LIB, "g_value_copy", [VALUE_T, VALUE_T], voidT);
const booleanValueType = bindValueType("boolean", booleanT);
const boundTypeValueType = bindValueType("gtype", biguint64T);

const typeValueType: ValueType = {
    set: (value, jsValue) => {
        boundTypeValueType.set(value, coerceGType(jsValue));
    },
    get: boundTypeValueType.get,
};

const scharValueType = bindValueType("schar", int8T);
const ucharValueType = bindValueType("uchar", uint8T);
const intValueType = bindValueType("int", int32T);
const uintValueType = bindValueType("uint", uint32T);
const longValueType = bindValueType("long", bigint64T);
const ulongValueType = bindValueType("ulong", biguint64T);
const int64ValueType = bindValueType("int64", bigint64T);
const uint64ValueType = bindValueType("uint64", biguint64T);
const floatValueType = bindValueType("float", float32T);
const doubleValueType = bindValueType("double", float64T);
const stringValueType = bindValueType("string", stringT("borrowed"));
const enumValueType = bindValueType("enum", int32T);
const flagsValueType = bindValueType("flags", uint32T);
const objectValueType = bindValueType("object", objectT("borrowed"));
const objectValueFundamentals: Set<bigint> = new Set([TYPE_OBJECT, TYPE_INTERFACE]);
const paramValueType = bindValueType("param", PARAM_T);
const variantValueType = bindValueType("variant", VARIANT_T);
const pointerValueType: ValueType = {
    set: bind(LIB, "g_value_set_pointer", [VALUE_T, bufferT], voidT),
    get: bind(LIB, "g_value_get_pointer", [VALUE_T], structT("borrowed")),
};
const strvDescriptor = arrayT(stringT("borrowed"));
const nullableStrvDescriptor = preserveArrayNull(arrayT(stringT("borrowed")));
const setStrvBoxed = bind(LIB, "g_value_set_boxed", [VALUE_T, strvDescriptor], voidT);
const getStrvBoxed = bind(LIB, "g_value_get_boxed", [VALUE_T], strvDescriptor);
const getNullableStrvBoxed = bind(LIB, "g_value_get_boxed", [VALUE_T], nullableStrvDescriptor);

const strvValueType: ValueType = {
    set: setStrvValue,
    get: getStrvBoxed,
};

const nullableStrvValueType: ValueType = {
    set: setStrvValue,
    get: getNullableStrvBoxed,
};

const setByteArrayBoxed = bind(LIB, "g_value_set_boxed", [VALUE_T, byteArrayT()], voidT);
const getBytesBoxed = bind(LIB, "g_value_get_boxed", [VALUE_T], preserveArrayNull(byteArrayT()));
const getByteItemsBoxed = bind(LIB, "g_value_get_boxed", [VALUE_T], preserveArrayNull(arrayT(uint8T, "gbytearray")));

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

const WHOLE_NUMBER_KINDS: Set<Descriptor["kind"]> = new Set([
    "int8",
    "int16",
    "int32",
    "uint8",
    "uint16",
    "uint32",
    "int64",
    "uint64",
    "enum",
    "flags",
]);

const PLAIN_VALUE_GETTERS: Map<bigint, ValueGetter> = new Map([
    [TYPE_BOOLEAN, booleanValueType.get],
    [TYPE_CHAR, scharValueType.get],
    [TYPE_UCHAR, ucharValueType.get],
    [TYPE_INT, intValueType.get],
    [TYPE_UINT, uintValueType.get],
    [TYPE_LONG, longValueType.get],
    [TYPE_ULONG, ulongValueType.get],
    [TYPE_INT64, int64ValueType.get],
    [TYPE_UINT64, uint64ValueType.get],
    [TYPE_FLOAT, floatValueType.get],
    [TYPE_DOUBLE, doubleValueType.get],
    [TYPE_ENUM, enumValueType.get],
    [TYPE_FLAGS, flagsValueType.get],
]);

const PLAIN_VALUE_SETTERS: Map<bigint, ValueType["set"]> = new Map([
    [TYPE_BOOLEAN, booleanValueType.set],
    [TYPE_CHAR, scharValueType.set],
    [TYPE_UCHAR, ucharValueType.set],
    [TYPE_INT, intValueType.set],
    [TYPE_UINT, uintValueType.set],
    [TYPE_LONG, longValueType.set],
    [TYPE_ULONG, ulongValueType.set],
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
    [TYPE_INTERFACE, handleSetter(objectValueType)],
    [TYPE_PARAM, handleSetter(paramValueType)],
    [TYPE_VARIANT, handleSetter(variantValueType)],
    [TYPE_BOXED, setBoxedFromValue],
    [TYPE_POINTER, setPointerValue],
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

const byteArrayValueGetterFor = (isBytes: boolean): ValueGetter => (isBytes ? getBytesBoxed : getByteItemsBoxed);

const byteArrayValueType = (descriptor: ArrayDescriptor): ValueType => ({
    set: setByteArrayValue,
    get: byteArrayValueGetterFor(descriptor.isBytes === true),
});

const isByteArraySource = (jsValue: unknown): jsValue is Uint8Array | number[] =>
    jsValue instanceof Uint8Array || Array.isArray(jsValue);

const enumOrFlagsValueType = (type: bigint): ValueType =>
    typeFundamental(type) === TYPE_FLAGS ? flagsValueType : enumValueType;

function unsupportedFundamental(type: bigint): never {
    throw new Error(`Unsupported fundamental type '${typeName(type) ?? String(type)}' for value`);
}

const setInstanceBind = (fundamental: bigint, descriptor: FundamentalDescriptor) =>
    setInstanceCache(String(fundamental), LIB, "g_value_set_instance", [VALUE_T, descriptor], voidT);

const peekPointerBind = (fundamental: bigint, descriptor: FundamentalDescriptor) =>
    peekPointerCache(String(fundamental), LIB, "g_value_peek_pointer", [VALUE_T], descriptor);

const customFundamentalDescriptor = (fundamental: bigint): FundamentalDescriptor | undefined => {
    const name = typeName(fundamental);

    if (name === null) {
        return undefined;
    }

    const lifecycle = fundamentalLifecycleFor(name);

    if (lifecycle === undefined) {
        return undefined;
    }

    return fundamentalT(lifecycle.sharedLibrary, lifecycle.refFnName, lifecycle.unrefFnName, {
        ownership: "borrowed",
        typeName: name,
    });
};

const customFundamentalValueType = (type: bigint): ValueType | undefined => {
    const fundamental = typeFundamental(type);
    const descriptor = customFundamentalDescriptor(fundamental);

    if (descriptor === undefined) {
        return undefined;
    }

    return { set: setInstanceBind(fundamental, descriptor), get: peekPointerBind(fundamental, descriptor) };
};

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
            return customFundamentalValueType(type) ?? unsupportedFundamental(type);
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

const newValueForType = (type: bigint): ExternalObject<Handle> => {
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
    const value = newValueForType(type);
    resolveSetBind(getBoxedTypeName(type))(value, getHandle(boxed));

    return value;
};

/**
 * Duplicates the boxed value held by a GValue and returns the copy wrapped in the
 * class its GType resolves to, or null when the GValue holds no boxed type.
 * A `GByteArray` payload is copied into a `Uint8Array` instead of being wrapped.
 */
function getBoxedValue(value: ExternalObject<Handle>): object | null {
    const type = getValueType(value);

    if (typeFundamental(type) !== TYPE_BOXED) {
        return null;
    }

    if (type === getByteArrayType()) {
        return byteArrayValueGetterFor(true)(value) as Uint8Array | null;
    }

    const boxed = dupBoxedBind(getBoxedTypeName(type))(value) as ExternalObject<Handle> | null;

    if (boxed === null) {
        return null;
    }

    return wrapHandle(boxed, getWrapperClass(type));
}

/**
 * Stores a boxed object, or null, into a GValue that holds a boxed type. A GValue holding
 * `G_TYPE_VALUE` also takes any other {@link JsValue}, which is boxed into a nested `GObject.Value`
 * of the GType inferred from it, and one holding a `GByteArray` also takes the bytes as a
 * `Uint8Array` or an array of byte values.
 * @param value Handle of an initialized value to write into.
 * @param boxed The boxed instance, bytes, or {@link JsValue} to store.
 * @throws {ValueMarshalError} When the value cannot hold what was passed.
 */
function setBoxedValue(value: ExternalObject<Handle>, boxed: JsValue | object): void {
    const type = getValueType(value);

    if (type === resolveBoxedType(VALUE_T)) {
        setBoxedBind("GValue")(value, boxed === null ? null : toValueHandle(boxed));

        return;
    }

    if (type === getByteArrayType() && isByteArraySource(boxed)) {
        setByteArrayBoxed(value, boxed);

        return;
    }

    setWrappedBoxedValue(value, type, boxed);
}

function setWrappedBoxedValue(value: ExternalObject<Handle>, type: bigint, boxed: JsValue | object): void {
    if (boxed !== null && typeof boxed !== "object") {
        throw new ValueMarshalError(
            `Cannot marshal ${describeValueKind(boxed)} into a '${getBoxedTypeName(type)}' value`,
        );
    }

    setBoxedBind(getBoxedTypeName(type))(value, boxed === null ? null : getHandle(boxed));
}

const stringHashTableDescriptor = hashTableT(stringT("borrowed"), stringT("borrowed"), "borrowed");
const stringHashTableValueType: ValueType = {
    set: bind(LIB, "g_value_set_boxed", [VALUE_T, stringHashTableDescriptor], voidT),
    get: bind(LIB, "g_value_get_boxed", [VALUE_T], stringHashTableDescriptor),
};

const scalarGArrayValueTypes: WeakMap<ArrayDescriptor, ValueType> = new WeakMap();

const scalarGArrayValueType = (descriptor: ArrayDescriptor): ValueType =>
    scalarGArrayValueTypes.getOrInsertComputed(descriptor, () => {
        const borrowed: ArrayDescriptor = { ...descriptor, ownership: "borrowed" };

        return {
            set: bind(LIB, "g_value_set_boxed", [VALUE_T, borrowed], voidT),
            get: bind(LIB, "g_value_get_boxed", [VALUE_T], borrowed),
        };
    });

const valuePointerStorage: WeakMap<
    ExternalObject<Handle>,
    { pointer: ExternalObject<Handle>; source: unknown }
> = new WeakMap();
const containerValueTypes: WeakMap<Descriptor, ValueType> = new WeakMap();
const transferredPropertyGetters: WeakMap<Descriptor, ValueGetter> = new WeakMap();
const pointerNumberValueType = bindValueType("pointer", biguint64T);

const pointerSourceValues = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value.flatMap(pointerSourceValues);
    if (value instanceof Map) return [...value.entries()].flatMap(pointerSourceValues);
    return [value];
};

const borrowDescriptor = (descriptor: Descriptor): Descriptor => {
    if (descriptor.kind === "array") {
        return { ...descriptor, ownership: "borrowed", itemDescriptor: borrowDescriptor(descriptor.itemDescriptor) };
    }
    if (descriptor.kind === "hashtable") {
        return {
            ...descriptor,
            ownership: "borrowed",
            keyDescriptor: borrowDescriptor(descriptor.keyDescriptor),
            valueDescriptor: borrowDescriptor(descriptor.valueDescriptor),
        };
    }
    return "ownership" in descriptor ? { ...descriptor, ownership: "borrowed" } : descriptor;
};

const containerValueType = (descriptor: Descriptor): ValueType =>
    containerValueTypes.getOrInsertComputed(descriptor, () => bindValueType("boxed", borrowDescriptor(descriptor)));

const objectPtrArrayValueTypes: WeakMap<ArrayDescriptor, ValueType> = new WeakMap();

const objectPtrArrayValueType = (descriptor: ArrayDescriptor & { itemDescriptor: ObjectDescriptor }): ValueType =>
    objectPtrArrayValueTypes.getOrInsertComputed(descriptor, () => {
        const borrowed: ArrayDescriptor = {
            ...descriptor,
            ownership: "borrowed",
            itemDescriptor: { ...descriptor.itemDescriptor, ownership: "borrowed" },
            elementOwnership: "separate",
        };
        const ownedItems: ArrayDescriptor = {
            ...borrowed,
            itemDescriptor: { ...descriptor.itemDescriptor, ownership: "full" },
            elementOwnership: "container",
        };

        return {
            set: bind(LIB, "g_value_set_boxed", [VALUE_T, ownedItems], voidT),
            get: bind(LIB, "g_value_get_boxed", [VALUE_T], borrowed),
        };
    });

const strvValueTypeFor = (descriptor: ArrayDescriptor): ValueType =>
    descriptor.preserveNull === true ? nullableStrvValueType : strvValueType;

const arrayValueType = (descriptor: ArrayDescriptor): ValueType => {
    if (isObjectPtrArray(descriptor)) {
        return objectPtrArrayValueType(descriptor);
    }

    if (isScalarGArray(descriptor)) {
        return scalarGArrayValueType(descriptor);
    }

    if (descriptor.itemDescriptor.kind === "string" && descriptor.arrayKind === "array") {
        return strvValueTypeFor(descriptor);
    }

    if (descriptor.arrayKind === "gbytearray") {
        return byteArrayValueType(descriptor);
    }

    throw new Error(`Unsupported array type ${descriptor.arrayKind} of ${descriptor.itemDescriptor.kind}`);
};

const resolveEnumOrFlagsValueType = (descriptor: Extract<Descriptor, { kind: "enum" | "flags" }>): ValueType => {
    if (descriptor.getTypeFnName === "") {
        return descriptor.kind === "flags" ? flagsValueType : enumValueType;
    }

    return enumOrFlagsValueType(resolveType(descriptor.sharedLibrary, descriptor.getTypeFnName));
};

const resolveValueType = (descriptor: Descriptor): ValueType => {
    if (isStringHashTable(descriptor)) {
        return stringHashTableValueType;
    }

    if (isGtypeDescriptor(descriptor)) {
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
            return resolveEnumOrFlagsValueType(descriptor);
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
        case TYPE_INTERFACE:
        case TYPE_OBJECT: {
            return (value) => wrapObject(objectValueType.get(value));
        }
        case TYPE_PARAM: {
            return (value) =>
                wrapFundamentalHandle(
                    paramValueType.get(value) as ExternalObject<Handle> | null,
                    getWrapperClass(TYPE_PARAM),
                );
        }
        case TYPE_VARIANT: {
            return (value) =>
                wrapFundamentalHandle(
                    variantValueType.get(value) as ExternalObject<Handle> | null,
                    getWrapperClass(TYPE_VARIANT),
                );
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

function setStrvValue(value: ExternalObject<Handle>, nativeValue: unknown): void {
    setStrvBoxed(value, nativeValue ?? null);
}

function setByteArrayValue(value: ExternalObject<Handle>, nativeValue: unknown): void {
    setByteArrayBoxed(value, nativeValue ?? null);
}

function setPointerValue(value: ExternalObject<Handle>, nativeValue: unknown): void {
    if (nativeValue != null) {
        throw new Error("G_TYPE_POINTER non-null values cannot be marshalled from JS");
    }

    pointerValueType.set(value, null);
}

function handleSetter(target: ValueType): ValueType["set"] {
    return (value, nativeValue) => {
        target.set(value, nativeValue == null ? null : getHandle(nativeValue));
    };
}

function setBoxedFromValue(value: ExternalObject<Handle>, nativeValue: unknown): void {
    setBoxedValue(value, nativeValue ?? null);
}

const customFundamentalGetter = (type: bigint): ValueGetter | undefined => {
    const valueType = customFundamentalValueType(type);

    if (valueType === undefined) {
        return undefined;
    }

    return (value) =>
        wrapFundamentalHandle(valueType.get(value) as ExternalObject<Handle> | null, getWrapperClass(type));
};

const customFundamentalSetter = (type: bigint): ValueType["set"] | undefined => {
    const valueType = customFundamentalValueType(type);

    return valueType === undefined ? undefined : handleSetter(valueType);
};

const builtInValueGetter = (fundamental: bigint): ValueGetter | undefined =>
    PLAIN_VALUE_GETTERS.get(fundamental) ?? wrappedValueGetter(fundamental);

const builtInValueSetter = (fundamental: bigint): ValueType["set"] | undefined =>
    PLAIN_VALUE_SETTERS.get(fundamental) ?? WRAPPED_VALUE_SETTERS.get(fundamental);

const exactValueType = (type: bigint): ValueType | undefined => {
    if (type === TYPE_GTYPE) {
        return typeValueType;
    }

    return type === getStrvType() ? strvValueType : undefined;
};

const resolveValueGetter = (type: bigint): ValueGetter | undefined =>
    exactValueType(type)?.get ?? builtInValueGetter(typeFundamental(type)) ?? customFundamentalGetter(type);

const resolveValueSetter = (type: bigint): ValueType["set"] | undefined =>
    exactValueType(type)?.set ?? builtInValueSetter(typeFundamental(type)) ?? customFundamentalSetter(type);

const holdsUnchanged: ValueNarrower = (jsValue) => jsValue;
const holdsAsFloat: ValueNarrower = (jsValue) => Math.fround(jsValue as number);

function valueNarrowerFor(type: bigint): ValueNarrower {
    return typeFundamental(type) === TYPE_FLOAT ? holdsAsFloat : holdsUnchanged;
}

function valueWriterFor(type: bigint): ValueWriter {
    const set = resolveValueSetter(type);

    if (set === undefined) {
        throw new Error(`Unsupported type for intoValue: ${typeName(type) ?? String(type)}`);
    }

    return set;
}

function intoValue(value: ExternalObject<Handle>, jsValue: unknown): void {
    valueWriterFor(getValueType(value))(value, jsValue);
}

const numberValueGType = (jsValue: number): bigint =>
    Number.isSafeInteger(jsValue) && jsValue >= INT32_MINIMUM && jsValue <= INT32_MAXIMUM ? TYPE_INT : TYPE_DOUBLE;

const arrayValueGType = (jsValue: unknown[]): bigint => (isStringArray(jsValue) ? getStrvType() : TYPE_INVALID);
const wideValueGType = (jsValue: bigint): bigint => (jsValue > INT64_MAXIMUM ? TYPE_UINT64 : TYPE_INT64);

const bigintValueGType = (jsValue: bigint): bigint =>
    jsValue < INT64_MINIMUM || jsValue > UINT64_MAXIMUM ? TYPE_INVALID : wideValueGType(jsValue);

const objectValueGType = (jsValue: object | null, wrapperType: bigint): bigint => {
    if (jsValue === null) {
        return TYPE_POINTER;
    }

    return Array.isArray(jsValue) ? arrayValueGType(jsValue) : wrapperType;
};

function inferValueGType(jsValue: unknown, wrapperType: bigint): bigint {
    switch (typeof jsValue) {
        case "string": {
            return TYPE_STRING;
        }
        case "boolean": {
            return TYPE_BOOLEAN;
        }
        case "number": {
            return numberValueGType(jsValue);
        }
        case "bigint": {
            return bigintValueGType(jsValue);
        }
        case "object": {
            return objectValueGType(jsValue, wrapperType);
        }
        case "function":
        case "symbol":
        case "undefined": {
            return TYPE_INVALID;
        }
    }
}

const marshalFailure = (jsValue: unknown): string =>
    typeof jsValue === "bigint"
        ? `Cannot marshal ${String(jsValue)} into a GObject.Value: outside the range of gint64 and guint64`
        : `Cannot marshal ${describeValueKind(jsValue)} into a GObject.Value`;

const wrapperGType = (jsValue: unknown): bigint =>
    typeof jsValue === "object" && jsValue !== null ? resolveGtype(jsValue) : TYPE_INVALID;

/**
 * Marshals a value passed where a `GObject.Value` is expected into a value handle: an already-built
 * value yields its own handle, and any other {@link JsValue} is stored in a new one initialized to the
 * GType inferred from it.
 * @param jsValue Value to store, or an already-built `GObject.Value`.
 * @throws {ValueMarshalError} When no GType can be inferred from the value.
 */
function toValueHandle(jsValue: unknown): ExternalObject<Handle> {
    const wrapperType = wrapperGType(jsValue);

    if (typeIsA(wrapperType, resolveBoxedType(VALUE_T))) {
        return getHandle(jsValue as object);
    }

    const type = inferValueGType(jsValue, wrapperType);

    if (type === TYPE_INVALID) {
        throw new ValueMarshalError(marshalFailure(jsValue));
    }

    const value = newValueForType(type);
    intoValue(value, jsValue);

    return value;
}

/** Same as {@link toValueHandle}, but passes a null or undefined value through as no value at all. */
const tryToValueHandle = (jsValue: unknown): ExternalObject<Handle> | undefined =>
    jsValue == null ? undefined : toValueHandle(jsValue);

const isValueDescriptor = (descriptor: Descriptor): boolean =>
    descriptor.kind === "boxed" && descriptor.typeName === "GValue";

const resolveNativeValue = (descriptor: Descriptor, value: unknown): unknown => {
    const isHandleKind = descriptor.kind === "object" || descriptor.kind === "boxed";

    if (!isHandleKind) {
        return toNative(descriptor, value);
    }

    if (value == null) {
        return null;
    }

    return isValueDescriptor(descriptor) ? toValueHandle(value) : getHandle(value);
};

const resolveValueGType = (descriptor: Descriptor, nativeValue: unknown): bigint => {
    if (descriptor.kind !== "object") {
        return resolveDescriptorType(descriptor);
    }

    return nativeValue == null ? TYPE_OBJECT : getType(nativeValue as ExternalObject<Handle>);
};

const toWholeNumber = (descriptor: Descriptor, value: unknown): unknown =>
    typeof value === "number" && Number.isFinite(value) && WHOLE_NUMBER_KINDS.has(descriptor.kind)
        ? Math.trunc(value)
        : value;

function toValue(descriptor: Descriptor, value: unknown): ExternalObject<Handle> {
    const nativeValue = resolveNativeValue(descriptor, toWholeNumber(descriptor, value));
    const type = resolveValueGType(descriptor, nativeValue);
    const gValue = newValueForType(type);
    resolveValueType(descriptor).set(gValue, nativeValue);

    return gValue;
}

const retainCallbackProperty = (owner: ExternalObject<Handle>, name: string, value: ExternalObject<Handle>): void => {
    retainPropertyPointer(owner, name, valuePointerStorage.get(value)?.pointer ?? null);
};

function toValueForType(descriptor: Descriptor, jsValue: unknown, type: bigint): ExternalObject<Handle> {
    const value = newValueForType(type);
    const fundamental = typeFundamental(type);
    if (fundamental === TYPE_POINTER && type !== TYPE_GTYPE) {
        if (jsValue == null) {
            pointerValueType.set(value, null);
        } else if (descriptor.kind === "biguint64") {
            pointerNumberValueType.set(value, jsValue);
        } else {
            const borrowed = borrowDescriptor(descriptor);
            const plan = compileDescriptor(borrowed);
            const encoded = plan.encode(
                borrowed.kind === "callback" ? wrapCallbackValue(borrowed, jsValue) : toNative(borrowed, jsValue),
            );
            const storage = encodePointer(plan.abi, encoded);
            valuePointerStorage.set(value, { pointer: storage, source: [pointerSourceValues(jsValue), encoded] });
            pointerValueType.set(value, storage);
        }
    } else if (fundamental === TYPE_BOXED && (descriptor.kind === "array" || descriptor.kind === "hashtable")) {
        const target =
            descriptor.kind === "hashtable" || descriptor.arrayKind === "glist" || descriptor.arrayKind === "gslist"
                ? containerValueType(descriptor)
                : resolveValueType(descriptor);
        target.set(value, toNative(descriptor, jsValue));
    } else if (descriptor.kind === "boxed" || descriptor.kind === "fundamental") {
        resolveValueType(descriptor).set(value, resolveNativeValue(descriptor, jsValue));
    } else {
        intoValue(value, toWholeNumber(descriptor, jsValue));
    }
    return value;
}

/**
 * Reads what a `GObject.Value` holds as its JavaScript form, wrapping an object, boxed, param, variant,
 * or fundamental payload in the class registered for its GType, and handing back a string, number,
 * `bigint`, boolean, or array of strings for the rest.
 * @param value Handle of an initialized value to read.
 * @throws {Error} When the GType it holds has no JavaScript form, such as a non-null `gpointer`.
 */
function fromValue(value: ExternalObject<Handle>): unknown {
    const type = getValueType(value);
    const get = resolveValueGetter(type);

    if (get === undefined) {
        throw new Error(`Unsupported type for fromValue: ${typeName(type) ?? String(type)}`);
    }

    return get(value);
}

const fromObjectPropertyValue = (value: ExternalObject<Handle>): unknown =>
    getValueType(value) === getStrvType() ? nullableStrvValueType.get(value) : fromValue(value);

const objectValueWithFallback = (
    descriptor: ObjectDescriptor,
    value: ExternalObject<Handle>,
): { wrapped: unknown } | null => {
    if (descriptor.fallbackClass === undefined || !objectValueFundamentals.has(typeFundamental(getValueType(value)))) {
        return null;
    }

    return { wrapped: wrapObject(objectValueType.get(value), descriptor.fallbackClass) };
};

const arrayValueGetterForDescriptor = (descriptor: ArrayDescriptor): ValueGetter | undefined => {
    if (descriptor.arrayKind === "gbytearray") {
        return byteArrayValueGetterFor(descriptor.isBytes === true);
    }

    return isScalarGArray(descriptor) ||
        (descriptor.itemDescriptor.kind === "string" && descriptor.arrayKind === "array")
        ? arrayValueType(descriptor).get
        : undefined;
};

const fromArrayValueForDescriptor = (descriptor: ArrayDescriptor, value: ExternalObject<Handle>): unknown => {
    if (isObjectPtrArray(descriptor)) {
        return fromNative(descriptor, objectPtrArrayValueType(descriptor).get(value));
    }

    const get = arrayValueGetterForDescriptor(descriptor);

    return get === undefined ? fromValue(value) : get(value);
};

const fromValueForDescriptor = (descriptor: Descriptor, value: ExternalObject<Handle>): unknown => {
    const type = getValueType(value);
    const fundamental = typeFundamental(type);
    if (fundamental === TYPE_POINTER && type !== TYPE_GTYPE) {
        if (pointerValueType.get(value) === null) return null;
        if (descriptor.kind === "biguint64") return pointerNumberValueType.get(value);
        const get = bind(LIB, "g_value_get_pointer", [VALUE_T], borrowDescriptor(descriptor));
        return fromNative(descriptor, get(value));
    }
    if (
        fundamental === TYPE_BOXED &&
        (descriptor.kind === "hashtable" ||
            (descriptor.kind === "array" && (descriptor.arrayKind === "glist" || descriptor.arrayKind === "gslist")))
    ) {
        return fromNative(descriptor, containerValueType(descriptor).get(value));
    }

    if (isStringHashTable(descriptor)) {
        return fromNative(descriptor, stringHashTableValueType.get(value));
    }

    if (descriptor.kind === "array") {
        return fromArrayValueForDescriptor(descriptor, value);
    }

    if (descriptor.kind === "object") {
        const withFallback = objectValueWithFallback(descriptor, value);

        if (withFallback !== null) {
            return withFallback.wrapped;
        }
    }

    return fromValue(value);
};

/**
 * GI property transfer annotations can provide a container reference in addition to the GValue's
 * own boxed reference. Consume it only for property reads; generic GValues retain borrowed semantics.
 * See https://github.com/GNOME/pygobject/blob/main/gi/pygi-property.c and gi/pygi-cache-hashtable.c.
 */
const fromPropertyValueForDescriptor = (descriptor: Descriptor, value: ExternalObject<Handle>): unknown => {
    if (
        descriptor.kind === "hashtable" &&
        descriptor.ownership === "full" &&
        typeFundamental(getValueType(value)) === TYPE_BOXED
    ) {
        const get = transferredPropertyGetters.getOrInsertComputed(descriptor, () =>
            bind(LIB, "g_value_get_boxed", [VALUE_T], {
                ...descriptor,
                keyDescriptor: borrowDescriptor(descriptor.keyDescriptor),
                valueDescriptor: borrowDescriptor(descriptor.valueDescriptor),
            }),
        );
        return fromNative(descriptor, get(value));
    }
    return fromValueForDescriptor(descriptor, value);
};

const inferredValueGuard: ValueGuard = (jsValue) => inferValueGType(jsValue, wrapperGType(jsValue)) !== TYPE_INVALID;

const byteArrayValueGuard: ValueGuard = (jsValue) =>
    jsValue == null || isByteArraySource(jsValue) || typeIsA(resolveGtype(jsValue), getByteArrayType());

const valueGuardOverrideFor = (valueType: bigint): ValueGuard | undefined => {
    if (valueType === resolveBoxedType(VALUE_T)) {
        return inferredValueGuard;
    }

    return valueType === getByteArrayType() ? byteArrayValueGuard : undefined;
};

function outValueForDescriptor(
    descriptor: Descriptor,
    initial?: unknown,
): { value: ExternalObject<Handle>; read: () => unknown } {
    const storage = alloc(8);

    if (initial !== undefined) {
        write(storage, descriptor, 0, initial);
    }

    const value = newValueForType(TYPE_POINTER);
    pointerValueType.set(value, storage);

    return { value, read: () => read(storage, descriptor, 0) };
}

function outValueForBoxedDescriptor(descriptor: Descriptor, boxed: object): ExternalObject<Handle> {
    return newBoxedValue(descriptor, boxed, setBoxedBind);
}

function inoutValueForBoxedDescriptor(descriptor: Descriptor, boxed: object): ExternalObject<Handle> {
    return newBoxedValue(descriptor, boxed, setStaticBoxedBind);
}

/** Thrown when a value passed where a `GObject.Value` is expected holds no GType one can be built from. */
class ValueMarshalError extends TypeError {
    /** Name callers match on when the error is caught as a plain `TypeError`. */
    public override name = "ValueMarshalError";
}

export {
    getValueType,
    intoValue,
    copyValue,
    getBoxedValue,
    setBoxedValue,
    type JsValue,
    toValue,
    toValueForType,
    retainCallbackProperty,
    toValueHandle,
    tryToValueHandle,
    ValueMarshalError,
    fromValue,
    fromObjectPropertyValue,
    fromValueForDescriptor,
    fromPropertyValueForDescriptor,
    valueGuardOverrideFor,
    newValueForType,
    outValueForDescriptor,
    outValueForBoxedDescriptor,
    inoutValueForBoxedDescriptor,
    type ValueNarrower,
    valueNarrowerFor,
    type ValueWriter,
    valueWriterFor,
};
