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
import type { Descriptor } from "./descriptor-types.js";
import { normalizeHashTableEntries } from "./hash-table.js";
import { LIB } from "./library.js";

type Conversion = (value: unknown) => unknown;
type ScalarPlan = {
    abi: NativeDescriptor;
    encode: Conversion;
    decode: Conversion;
    defaultReturn?: unknown;
    inner?: ScalarPlan;
};
type Callback = (...args: unknown[]) => unknown;
type CallbackShape = { argDescriptors: Descriptor[]; returnDescriptor: Descriptor; userDataIndex?: number };
type EnumDescriptor = Extract<Descriptor, { kind: "enum" | "flags" }>;

const identity: Conversion = (value) => value;
const classHandles: Map<string, Map<string, ExternalObject<Handle>>> = new Map();
const integerT: NativeDescriptor = { kind: "int32" };
const unsignedT: NativeDescriptor = { kind: "uint32" };
const typeT: NativeDescriptor = { kind: "biguint64" };
const pointerT: NativeDescriptor = { kind: "struct", ownership: "borrowed" };

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
    const nameCall = nativeBind(LIB, "g_type_name", [typeT], { kind: "string", ownership: "borrowed" });
    const fundamentalName = nativeCall(nameCall, [nativeCall(fundamentalCall, [type]).value]).value;
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
            if (value == null) {
                return 0;
            }
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
    if (value == null || value === "") {
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

const refConversion = (convert: Conversion): Conversion => (value) => {
    if (value == null) {
        return value;
    }
    const inner: unknown = Reflect.get(value, "value");

    return { value: inner == null ? inner : convert(inner) };
};

const adaptCallback = (shape: CallbackShape, callback: Callback): Callback => {
    const args = shape.argDescriptors
        .filter((_, index) => index !== shape.userDataIndex)
        .map((descriptor) => ({ descriptor, plan: compileDescriptor(descriptor) }));
    const result = compileDescriptor(shape.returnDescriptor);

    return (...values) => {
        const decoded = args.map(({ plan }, index) => plan.decode(values[index]));
        const returned = callback(...decoded);
        const encodedReturn = result.encode(returned ?? result.defaultReturn);
        const outputs = args.flatMap(({ plan }, index) =>
            plan.inner !== undefined && values[index] != null
                ? [{
                        index,
                        value: plan.inner.encode((decoded[index] as Ref).value),
                    }]
                : []);
        for (const output of outputs) {
            (values[output.index] as Ref).value = output.value;
        }

        return encodedReturn;
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

const nestedPlan = (descriptor: NestedDescriptor): ScalarPlan => {
    switch (descriptor.kind) {
        case "array": {
            const item = compileDescriptor(descriptor.itemDescriptor);

            return {
                abi: { ...descriptor, itemDescriptor: item.abi },
                encode: mapCollection(item.encode),
                decode: mapCollection(item.decode),
            };
        }
        case "hashtable": {
            const key = compileDescriptor(descriptor.keyDescriptor);
            const item = compileDescriptor(descriptor.valueDescriptor);

            return {
                abi: { ...descriptor, keyDescriptor: key.abi, valueDescriptor: item.abi },
                encode: mapEntries(key.encode, item.encode),
                decode: mapEntries(key.decode, item.decode),
            };
        }
        case "ref": {
            const inner = compileDescriptor(descriptor.innerDescriptor);

            return {
                abi: { ...descriptor, innerDescriptor: inner.abi },
                inner,
                encode: refConversion(inner.encode),
                decode: refConversion(inner.decode),
            };
        }
        case "callback": {
            return {
                abi: {
                    ...descriptor,
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
    defaultReturn: false,
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
        case "string":
        case "object":
        case "int8":
        case "uint8":
        case "int16":
        case "uint16":
        case "int32":
        case "uint32":
        case "int64":
        case "uint64":
        case "bigint64":
        case "biguint64":
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

export { adaptCallback, compileDescriptor, toAbi };
