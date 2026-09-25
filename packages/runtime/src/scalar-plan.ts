import {
    type ExternalObject,
    getTypeClass,
    type Handle,
    bind as nativeBind,
    call as nativeCall,
    type Descriptor as NativeDescriptor,
    read as nativeRead,
    type Ref,
} from "@gtkx/native";
import { isArrayBuffer, isUint8Array } from "node:util/types";
import type { Descriptor } from "./descriptor-types.js";
import { callbackFailure } from "./callback-error.js";
import { isGtypeDescriptor } from "./descriptors.js";
import { normalizeHashTableEntries } from "./hash-table.js";
import { LIB } from "./library.js";
import {
    compileOutputStorage,
    isScalarStorageDescriptor,
    type OutputStorage,
    type StorageHandle,
} from "./output-storage.js";

type Conversion = (value: unknown) => unknown;
type ScalarPlan = {
    abi: NativeDescriptor;
    encode: Conversion;
    decode: Conversion;
    inner?: ScalarPlan;
    storage?: OutputStorage;
};
type Callback = (...args: unknown[]) => unknown;
type CallbackShape = {
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    userDataIndex?: number;
    canThrow?: boolean;
};
type EnumDescriptor = Extract<Descriptor, { kind: "enum" | "flags" }>;

const identity: Conversion = (value) => value;
const classHandles: Map<string, Map<string, ExternalObject<Handle>>> = new Map();
const integerT: NativeDescriptor = { kind: "int32" };
const unsignedT: NativeDescriptor = { kind: "uint32" };
const typeT: NativeDescriptor = { kind: "biguint64" };
const pointerT: NativeDescriptor = { kind: "struct", ownership: "borrowed" };
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { ignoreBOM: true });
const signalDefaultReturn: unique symbol = Symbol("signalDefaultReturn");

const defaultAbiReturn = (descriptor: NativeDescriptor): unknown => {
    if (descriptor.kind === "bigint64" || descriptor.kind === "biguint64") {
        return 0n;
    }
    if (isScalarStorageDescriptor(descriptor)) {
        return 0;
    }
    if (descriptor.kind === "void") {
        return undefined;
    }

    return null;
};

const stringPlan = (descriptor: Extract<Descriptor, { kind: "string" }>): ScalarPlan => ({
    abi: { ...descriptor, kind: "bytes" },
    encode(value) {
        if (value == null) {
            return value;
        }
        if (typeof value !== "string" || value.includes("\0")) {
            throw new TypeError("Expected a string without NUL bytes");
        }

        return encoder.encode(value);
    },
    decode: (value) => value == null ? value : decoder.decode(value as Uint8Array),
});

const encodeByteArray: Conversion = (value) => {
    if (value == null || ArrayBuffer.isView(value)) {
        return value;
    }
    if (!Array.isArray(value)) {
        throw new TypeError("Expected a byte array");
    }

    return Uint8Array.from(value, (item: unknown) => {
        if (typeof item !== "number" || !Number.isSafeInteger(item) || item < 0 || item > 255) {
            throw new TypeError("Expected an integer byte between 0 and 255");
        }

        return item;
    });
};

const encodeBigInt: Conversion = (value) => {
    if (typeof value !== "number") {
        return value;
    }
    if (!Number.isSafeInteger(value) && Math.abs(value) !== 2 ** 53) {
        throw new RangeError("Expected an integer number within the exact 2^53 range or a bigint");
    }

    return BigInt(value);
};

const encodeBigIntArray: Conversion = (value) => {
    if (value == null || ArrayBuffer.isView(value)) {
        return value;
    }
    const items = value as readonly unknown[];

    return items.some((item) => typeof item === "number") ? items.map((item) => encodeBigInt(item)) : items;
};

const enumClass = (descriptor: EnumDescriptor): ExternalObject<Handle> => {
    let library = classHandles.get(descriptor.sharedLibrary);
    if (library === undefined) {
        library = new Map();
        classHandles.set(descriptor.sharedLibrary, library);
    }
    const key = `${descriptor.kind}:${descriptor.getTypeFnName}`;
    const cached = library.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const typeCall = nativeBind(descriptor.sharedLibrary, descriptor.getTypeFnName, [], typeT);
    const type = nativeCall(typeCall, []).value as bigint;
    const fundamentalCall = nativeBind(LIB, "g_type_fundamental", [typeT], typeT);
    const nameCall = nativeBind(LIB, "g_type_name", [typeT], { kind: "bytes", ownership: "borrowed" });
    const fundamentalName = decoder.decode(
        nativeCall(nameCall, [nativeCall(fundamentalCall, [type]).value]).value as Uint8Array,
    );
    if (fundamentalName !== (descriptor.kind === "enum" ? "GEnum" : "GFlags")) {
        throw new TypeError(`Expected a registered ${descriptor.kind} type`);
    }
    const handle = getTypeClass(type);
    library.set(key, handle);

    return handle;
};

const explicitMembership = (descriptor: EnumDescriptor): ((value: number) => boolean) => {
    if (descriptor.kind === "enum") {
        return (value) => descriptor.members === undefined || descriptor.members.includes(value);
    }

    return (value) => descriptor.mask === undefined || ((value & descriptor.mask) >>> 0) === (value >>> 0);
};

const enumMembership = (descriptor: EnumDescriptor): ((value: number) => boolean) => {
    if (descriptor.getTypeFnName === "") {
        return explicitMembership(descriptor);
    }
    const handle = enumClass(descriptor);
    if (descriptor.kind === "flags") {
        const mask = nativeRead(handle, unsignedT, 8) as number;

        return (value) => ((value & mask) >>> 0) === (value >>> 0);
    }
    const valueCall = nativeBind(LIB, "g_enum_get_value", [pointerT, integerT], pointerT);

    return (value) => nativeCall(valueCall, [handle, value]).value !== null;
};

const enumPlan = (descriptor: EnumDescriptor): ScalarPlan => {
    const abi = descriptor.isSigned ? integerT : unsignedT;
    const minimum = descriptor.isSigned ? -0x80_00_00_00 : 0;
    const maximum = descriptor.isSigned ? 0x7F_FF_FF_FF : 0xFF_FF_FF_FF;
    let contains: ((value: number) => boolean) | undefined;

    return {
        abi,
        encode(value) {
            if (typeof value !== "number" || !Number.isSafeInteger(value)) {
                throw new TypeError("Expected an integer enumeration value");
            }
            if (value < minimum || value > maximum) {
                throw new RangeError("Enumeration value exceeds its storage range");
            }
            contains ??= enumMembership(descriptor);
            if (!contains(value)) {
                throw new RangeError("Enumeration value is not declared by its type");
            }

            return value;
        },
        decode: identity,
    };
};

const codepoint = (value: number): number => {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0x10_FF_FF || (value >= 0xD8_00 && value <= 0xDF_FF)) {
        throw new RangeError("Invalid Unicode codepoint");
    }

    return value;
};

const encodeUnichar: Conversion = (value) => {
    if (value === "") {
        return 0;
    }
    if (typeof value === "number") {
        return codepoint(value);
    }
    if (typeof value !== "string") {
        throw new TypeError("Expected a character or codepoint");
    }
    const point = value.toWellFormed().codePointAt(0) ?? 0;
    if (value.length !== (point > 0xFF_FF ? 2 : 1)) {
        throw new TypeError("Expected a single Unicode character");
    }

    return codepoint(point);
};

const mapCollection = (convert: Conversion): Conversion => {
    if (convert === identity) {
        return identity;
    }

    return (value) => value == null
        ? value
        : (value as readonly unknown[]).values().map((item) => convert(item)).toArray();
};

const byteOutputLayouts: Set<Extract<Descriptor, { kind: "array" }>["arrayKind"]> = new Set([
    "array", "sized", "fixed", "cursor", "garray",
]);

const hasByteTransport = (descriptor: Extract<Descriptor, { kind: "array" }>, item: NativeDescriptor): boolean =>
    descriptor.arrayKind === "gbytearray" || (item.kind === "uint8" && byteOutputLayouts.has(descriptor.arrayKind));

const arrayEncoder = (descriptor: Extract<Descriptor, { kind: "array" }>, encode: Conversion): Conversion => {
    if (descriptor.arrayKind === "gbytearray") {
        return encodeByteArray;
    }

    return encode === encodeBigInt ? encodeBigIntArray : mapCollection(encode);
};

const arrayPlan = (descriptor: Extract<Descriptor, { kind: "array" }>): ScalarPlan => {
    const item = compileDescriptor(descriptor.itemDescriptor);
    const { preserveNull = false, ...layout } = descriptor;
    const shouldUseByteTransport = hasByteTransport(descriptor, item.abi);
    const decode: Conversion = shouldUseByteTransport && descriptor.isBytes !== true
        ? (value) => [...value as Uint8Array]
        : mapCollection(item.decode);

    return {
        abi: { ...layout, itemDescriptor: item.abi, ...(shouldUseByteTransport && { isBytes: true }) },
        encode: arrayEncoder(descriptor, item.encode),
        decode(value) {
            if (value === null) {
                if (preserveNull) {
                    return null;
                }

                return descriptor.isBytes === true ? new Uint8Array() : [];
            }

            return decode(value);
        },
    };
};

const fixedRefBuffer = (value: unknown, length: number): Uint8Array => {
    if (length === 0) {
        throw new RangeError("A string reference needs room for its terminator");
    }
    const buffer = new Uint8Array(length);
    if (value == null) {
        return buffer;
    }
    if (!isUint8Array(value) || !isArrayBuffer(value.buffer)) {
        throw new TypeError("Expected a Uint8Array with an ArrayBuffer backing store");
    }
    buffer.set(value.subarray(0, length - 1));

    return buffer;
};

const refConversion = (convert: Conversion, length?: number): Conversion => {
    const wrap: Conversion = length === undefined
        ? (value) => ({ value })
        : (value) => fixedRefBuffer(value, length);

    return (value) => {
        if (value == null) {
            return value;
        }
        const inner: unknown = Reflect.get(value, "value");

        return wrap(inner == null ? inner : convert(inner));
    };
};

const referencePlan = (descriptor: Extract<Descriptor, { kind: "ref" }>): ScalarPlan => {
    const inner = compileDescriptor(descriptor.innerDescriptor);
    const storage = compileOutputStorage(inner.abi);
    const abi = { ...descriptor, innerDescriptor: inner.abi };

    if (storage === undefined) {
        return {
            abi,
            inner,
            encode: refConversion(inner.encode, inner.abi.kind === "bytes" ? inner.abi.length : undefined),
            decode(value) {
                if (value == null) {
                    return { value: null };
                }
                const seed: unknown = Reflect.get(value, "value");

                return { value: descriptor.inout === true ? inner.decode(seed) : seed };
            },
        };
    }

    return {
        abi,
        inner,
        storage,
        encode(value) {
            if (value == null) {
                return value;
            }
            const seed: unknown = Reflect.get(value, "value");

            return storage.allocate(seed == null ? seed : inner.encode(seed));
        },
        decode: (value) => ({
            value: value != null && descriptor.inout === true
                ? inner.decode(storage.read(value as StorageHandle))
                : null,
        }),
    };
};

const writeCallbackOutputs = (plans: ScalarPlan[], values: unknown[], decoded: unknown[]): void => {
    const outputs = plans.flatMap((plan, index) =>
        plan.inner !== undefined && values[index] != null
            ? [{
                    index,
                    storage: plan.storage,
                    value: plan.inner.encode((decoded[index] as Ref).value),
                }]
            : []);

    for (const output of outputs) {
        if (output.storage === undefined) {
            (values[output.index] as Ref).value = output.value;
        } else {
            output.storage.write(values[output.index] as StorageHandle, output.value);
        }
    }
};

const adaptCallback = (shape: CallbackShape, callback: Callback): Callback => {
    const args = shape.argDescriptors
        .filter((_, index) => index !== shape.userDataIndex)
        .map((descriptor) => compileDescriptor(descriptor));
    const result = compileDescriptor(shape.returnDescriptor);

    const invoke: Callback = (...values) => {
        const decoded = args.map((plan, index) => plan.decode(values[index]));
        const returned = callback(...decoded);
        if (returned === signalDefaultReturn) {
            return defaultAbiReturn(result.abi);
        }
        const encodedReturn = result.encode(returned);
        writeCallbackOutputs(args, values, decoded);

        return encodedReturn;
    };

    if (shape.canThrow !== true) {
        return invoke;
    }

    return (...values) => {
        try {
            return invoke(...values);
        } catch (error) {
            let failure: Error;
            try {
                failure = callbackFailure(error);
            } catch {
                throw error;
            }
            throw failure;
        }
    };
};

const encodeCallback = (descriptor: CallbackShape, value: unknown): unknown => {
    if (value == null) {
        return value;
    }
    if (typeof value !== "function") {
        throw new TypeError("Expected a callback function");
    }

    return adaptCallback(descriptor, value as Callback);
};

type NestedDescriptor = Extract<Descriptor, { kind: "array" | "hashtable" | "ref" | "callback" }>;

const mapEntries = (key: Conversion, item: Conversion): Conversion => {
    return (value) => {
        const entries = normalizeHashTableEntries(value);

        return entries === null
            ? null
            : entries.map(([entryKey, entryValue]) => [key(entryKey), item(entryValue)]);
    };
};

const callbackScope = (
    descriptor: Extract<Descriptor, { kind: "callback" }>,
): Extract<NativeDescriptor, { kind: "callback" }>["scope"] => {
    if (descriptor.scope === "notified" && descriptor.hasDestroy !== true) {
        return "forever";
    }
    if (descriptor.scope !== undefined) {
        return descriptor.scope;
    }
    if (descriptor.hasDestroy === true) {
        return "notified";
    }

    return descriptor.hasUserData === true ? "call" : "forever";
};

const nestedPlan = (descriptor: NestedDescriptor): ScalarPlan => {
    switch (descriptor.kind) {
        case "array": {
            return arrayPlan(descriptor);
        }
        case "hashtable": {
            if (isGtypeDescriptor(descriptor.valueDescriptor)) {
                throw new TypeError("GType hash-table values are not supported");
            }
            const key = compileDescriptor(descriptor.keyDescriptor);
            const item = compileDescriptor(descriptor.valueDescriptor);

            return {
                abi: { ...descriptor, keyDescriptor: key.abi, valueDescriptor: item.abi },
                encode: mapEntries(key.encode, item.encode),
                decode: mapEntries(key.decode, item.decode),
            };
        }
        case "ref": {
            return referencePlan(descriptor);
        }
        case "callback": {
            return {
                abi: {
                    ...descriptor,
                    scope: callbackScope(descriptor),
                    releaseWithCompletion: descriptor.scope === "notified" &&
                        descriptor.hasDestroy !== true && descriptor.hasUserData === true,
                    argDescriptors: descriptor.argDescriptors.map((descriptor) => toAbi(descriptor)),
                    returnDescriptor: toAbi(descriptor.returnDescriptor),
                },
                encode: (value) => encodeCallback(descriptor, value),
                decode: identity,
            };
        }
    }
};

const booleanPlan: ScalarPlan = {
    abi: integerT,
    encode(value) {
        if (typeof value !== "boolean") {
            throw new TypeError("Expected a boolean");
        }

        return value ? 1 : 0;
    },
    decode: (value) => value !== 0,
};

const buildPlan = (descriptor: Descriptor): ScalarPlan => {
    switch (descriptor.kind) {
        case "boolean": {
            return booleanPlan;
        }
        case "unichar": {
            return {
                abi: unsignedT,
                encode: encodeUnichar,
                decode: (value) => String.fromCodePoint(codepoint(value as number)),
            };
        }
        case "enum":
        case "flags": {
            return enumPlan(descriptor);
        }
        case "array":
        case "hashtable":
        case "ref":
        case "callback": {
            return nestedPlan(descriptor);
        }
        case "string": {
            return stringPlan(descriptor);
        }
        case "bigint64":
        case "biguint64": {
            return { abi: descriptor, encode: encodeBigInt, decode: identity };
        }
        case "bytes":
        case "object":
        case "int8":
        case "uint8":
        case "int16":
        case "uint16":
        case "int32":
        case "uint32":
        case "int64":
        case "uint64":
        case "float32":
        case "float64":
        case "void":
        case "buffer":
        case "boxed":
        case "struct":
        case "fundamental": {
            return { abi: descriptor, encode: identity, decode: identity };
        }
    }
};

const compileDescriptor = (descriptor: Descriptor): ScalarPlan => buildPlan(descriptor);

const toAbi = (descriptor: Descriptor): NativeDescriptor => compileDescriptor(descriptor).abi;

export { adaptCallback, compileDescriptor, signalDefaultReturn, toAbi };
