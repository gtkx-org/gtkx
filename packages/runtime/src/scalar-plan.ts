import {
    type ExternalObject,
    getTypeClass,
    type Handle,
    type CompiledDescriptor,
    compileDescriptor as compileNativeDescriptor,
    bind as nativeBind,
    bindFunction,
    call as nativeCall,
    type Descriptor as NativeDescriptor,
    readField,
    type Ref,
} from "./native.js";
import type { Descriptor } from "./descriptor-types.js";
import { callLayout } from "./call-layout.js";
import { functionResolver, typeResolver } from "./descriptor-lifecycle.js";
import { cairoPathConverter } from "./foreign-record.js";
import { numericPlan } from "./numeric-plan.js";
import { compileReferencePlan, type ReferencePlan } from "./reference-storage.js";
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
type PlanDefinition = {
    abi: NativeDescriptor;
    encode: Conversion;
    decode: Conversion;
    inner?: ScalarPlan;
    storage?: OutputStorage;
    referenceStorage?: ReferencePlan;
};
type ScalarPlan = PlanDefinition & { readonly compiled: ExternalObject<CompiledDescriptor> };
type DescriptorPlans = { args: ScalarPlan[]; returns: ScalarPlan };
type Callback = (...args: unknown[]) => unknown;
type CallbackShape = {
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    userDataIndex?: number;
    canThrow?: boolean;
};
type EnumDescriptor = Extract<Descriptor, { kind: "enum" | "flags" }>;

const identity: Conversion = (value) => value;
const compilingDescriptors = new WeakSet<Descriptor>();
const classHandles: Map<string, Map<string, ExternalObject<Handle>>> = new Map();
const integerT: NativeDescriptor = { kind: "int32" };
const unsignedT: NativeDescriptor = { kind: "uint32" };
const typeT: NativeDescriptor = { kind: "biguint64", isDirectWord: false };
const pointerT: Descriptor = { kind: "struct", ownership: "borrowed" };
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

const stringPlan = (descriptor: Extract<Descriptor, { kind: "string" }>): PlanDefinition => ({
    abi: toAbi({ ...descriptor, kind: "bytes" }),
    encode(value) {
        if (value == null) {
            return value;
        }
        if (typeof value !== "string" || value.includes("\0")) {
            throw new TypeError("Expected a string without NUL bytes");
        }

        return encoder.encode(value);
    },
    decode: (value) => (value == null ? value : decoder.decode(value as Uint8Array)),
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

const enumClass = (descriptor: EnumDescriptor): ExternalObject<Handle> => {
    const library = classHandles.getOrInsertComputed(descriptor.sharedLibrary, () => new Map());
    const key = `${descriptor.kind}:${descriptor.getTypeFnName}`;

    return library.getOrInsertComputed(key, () => {
        const type = compileNativeDescriptor(typeT);
        const typeCall = nativeBind(descriptor.sharedLibrary, descriptor.getTypeFnName, [], type, { argOrder: [] });
        const gtype = nativeCall(typeCall, []).value as bigint;
        const fundamentalCall = nativeBind(LIB, "g_type_fundamental", [type], type, { argOrder: [0] });
        const nameCall = nativeBind(
            LIB,
            "g_type_name",
            [type],
            compileDescriptor({ kind: "bytes", ownership: "borrowed" }).compiled,
            {
                argOrder: [0],
            },
        );
        const fundamentalName = decoder.decode(
            nativeCall(nameCall, [nativeCall(fundamentalCall, [gtype]).value]).value as Uint8Array,
        );
        if (fundamentalName !== (descriptor.kind === "enum" ? "GEnum" : "GFlags")) {
            throw new TypeError(`Expected a registered ${descriptor.kind} type`);
        }

        return getTypeClass(gtype);
    });
};

const explicitMembership = (descriptor: EnumDescriptor): ((value: number) => boolean) => {
    if (descriptor.kind === "enum") {
        return (value) => descriptor.members === undefined || descriptor.members.includes(value);
    }

    return (value) => descriptor.mask === undefined || (value & descriptor.mask) >>> 0 === value >>> 0;
};

const enumMembership = (descriptor: EnumDescriptor): ((value: number) => boolean) => {
    if (descriptor.getTypeFnName === "") {
        return explicitMembership(descriptor);
    }
    const handle = enumClass(descriptor);
    if (descriptor.kind === "flags") {
        const mask = readField(compileNativeDescriptor(unsignedT), handle, 8) as number;

        return (value) => (value & mask) >>> 0 === value >>> 0;
    }
    const pointer = compileDescriptor(pointerT).compiled;
    const valueCall = nativeBind(LIB, "g_enum_get_value", [pointer, compileNativeDescriptor(integerT)], pointer, {
        argOrder: [0, 1],
    });

    return (value) => nativeCall(valueCall, [handle, value]).value !== null;
};

const enumPlan = (descriptor: EnumDescriptor): PlanDefinition => {
    const abi = descriptor.isSigned ? integerT : unsignedT;
    const minimum = descriptor.isSigned ? -0x80_00_00_00 : 0;
    const maximum = descriptor.isSigned ? 0x7f_ff_ff_ff : 0xff_ff_ff_ff;
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
    if (!Number.isSafeInteger(value) || value < 0 || value > 0x10_ff_ff || (value >= 0xd8_00 && value <= 0xdf_ff)) {
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
    if (value.length !== (point > 0xff_ff ? 2 : 1)) {
        throw new TypeError("Expected a single Unicode character");
    }

    return codepoint(point);
};

const mapCollection = (convert: Conversion): Conversion => {
    if (convert === identity) {
        return identity;
    }

    return (value) =>
        value == null
            ? value
            : (value as readonly unknown[])
                  .values()
                  .map((item) => convert(item))
                  .toArray();
};

const byteOutputLayouts: Set<Extract<Descriptor, { kind: "array" }>["arrayKind"]> = new Set([
    "array",
    "sized",
    "fixed",
    "cursor",
    "garray",
]);

const hasByteTransport = (descriptor: Extract<Descriptor, { kind: "array" }>, item: NativeDescriptor): boolean =>
    descriptor.arrayKind === "gbytearray" || (item.kind === "uint8" && byteOutputLayouts.has(descriptor.arrayKind));

const arrayEncoder = (descriptor: Extract<Descriptor, { kind: "array" }>, encode: Conversion): Conversion => {
    if (descriptor.arrayKind === "gbytearray") {
        return encodeByteArray;
    }

    const convert = mapCollection(encode);
    return (value) => {
        if (ArrayBuffer.isView(value)) {
            return value;
        }
        return convert(value);
    };
};

const arrayPlan = (descriptor: Extract<Descriptor, { kind: "array" }>): PlanDefinition => {
    const item = compileDescriptor(descriptor.itemDescriptor);
    const { preserveNull = false, ...layout } = descriptor;
    const shouldUseByteTransport = hasByteTransport(descriptor, item.abi);
    const decode: Conversion = shouldUseByteTransport
        ? descriptor.isBytes === true
            ? identity
            : (value) => [...(value as Uint8Array)]
        : mapCollection(item.decode);

    return {
        abi: {
            ...layout,
            itemDescriptor: item.abi,
            elementOwnership: descriptor.elementOwnership ?? "separate",
            isBytes: shouldUseByteTransport || (descriptor.isBytes ?? false),
            isCallerAllocated: descriptor.isCallerAllocated ?? false,
            isZeroTerminated: descriptor.isZeroTerminated ?? false,
        },
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

const referencePlan = (descriptor: Extract<Descriptor, { kind: "ref" }>): PlanDefinition => {
    const inner = compileDescriptor(descriptor.innerDescriptor);
    const storage = compileOutputStorage(inner.abi, () => inner.compiled);
    const abi = { ...descriptor, innerDescriptor: inner.abi, inout: descriptor.inout ?? false };

    if (storage === undefined) {
        const referenceStorage = compileReferencePlan(descriptor, inner.abi, inner.encode);
        return {
            abi,
            inner,
            referenceStorage,
            encode: referenceStorage.encode,
            decode: (value) => ({
                value: value != null && descriptor.inout === true ? inner.decode(referenceStorage.read(value)) : null,
            }),
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
            value:
                value != null && descriptor.inout === true ? inner.decode(storage.read(value as StorageHandle)) : null,
        }),
    };
};

const writeCallbackOutputs = (plans: ScalarPlan[], values: unknown[], decoded: unknown[]): void => {
    const outputs = plans.flatMap((plan, index) =>
        plan.inner !== undefined && values[index] != null
            ? [
                  {
                      index,
                      storage: plan.storage,
                      referenceStorage: plan.referenceStorage,
                      value: plan.inner.encode((decoded[index] as Ref).value),
                  },
              ]
            : [],
    );

    for (const output of outputs) {
        if (output.storage !== undefined) {
            output.storage.write(values[output.index] as StorageHandle, output.value);
        } else {
            output.referenceStorage?.write(values[output.index], output.value);
        }
    }
};

const adaptCallback = (
    shape: CallbackShape,
    callback: Callback,
    plans: DescriptorPlans = compileDescriptors(shape.argDescriptors, shape.returnDescriptor),
): Callback => {
    const args = plans.args.filter((_, index) => index !== shape.userDataIndex);
    const result = plans.returns;

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

const encodeCallback = (descriptor: CallbackShape, plans: DescriptorPlans, value: unknown): unknown => {
    if (value == null) {
        return value;
    }
    if (typeof value !== "function") {
        throw new TypeError("Expected a callback function");
    }

    return adaptCallback(descriptor, value as Callback, plans);
};

type NestedDescriptor = Extract<Descriptor, { kind: "array" | "hashtable" | "ref" | "callback" }>;

const mapEntries = (key: Conversion, item: Conversion): Conversion => {
    return (value) => {
        const entries = normalizeHashTableEntries(value);

        return entries === null ? null : entries.map(([entryKey, entryValue]) => [key(entryKey), item(entryValue)]);
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

const nestedPlan = (descriptor: NestedDescriptor): PlanDefinition => {
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
            const plans = compileDescriptors(descriptor.argDescriptors, descriptor.returnDescriptor);
            return {
                abi: {
                    kind: "callback",
                    scope: callbackScope(descriptor),
                    hasDestroy: descriptor.hasDestroy ?? false,
                    destroyKind: descriptor.destroyKind ?? "destroyNotify",
                    hasUserData: descriptor.hasUserData ?? false,
                    releaseWithCompletion:
                        descriptor.scope === "notified" &&
                        descriptor.hasDestroy !== true &&
                        descriptor.hasUserData === true,
                    signature: bindFunction(
                        plans.args.map((argument) => argument.compiled),
                        plans.returns.compiled,
                        "callback",
                        callLayout(descriptor.argDescriptors),
                        {
                            canThrow: descriptor.canThrow ?? false,
                            ...(descriptor.userDataIndex === undefined
                                ? {}
                                : { userDataIndex: descriptor.userDataIndex }),
                        },
                    ),
                },
                encode: (value) => encodeCallback(descriptor, plans, value),
                decode: identity,
            };
        }
    }
};

const booleanPlan: PlanDefinition = {
    abi: integerT,
    encode(value) {
        if (typeof value !== "boolean") {
            throw new TypeError("Expected a boolean");
        }

        return value ? 1 : 0;
    },
    decode: (value) => value !== 0,
};

const indirectPlan = (descriptor: Extract<Descriptor, { kind: "indirect" }>): PlanDefinition => {
    const inner = compileDescriptor(descriptor.innerDescriptor);
    if (!isScalarStorageDescriptor(inner.abi)) {
        throw new TypeError("An indirect descriptor requires a scalar value");
    }
    return {
        abi: toAbi({
            kind: "array",
            arrayKind: "fixed",
            fixedSize: 1,
            itemDescriptor: descriptor.innerDescriptor,
            ownership: descriptor.ownership,
        }),
        encode: (value) => (value == null ? null : [inner.encode(value)]),
        decode: (value) => (value == null ? null : inner.decode((value as unknown[])[0])),
    };
};

const pointerValuePlan = (descriptor: Extract<Descriptor, { kind: "pointerValue" }>): PlanDefinition => {
    const inner = compileDescriptor(descriptor.innerDescriptor);
    const widths: Partial<Record<NativeDescriptor["kind"], number>> = {
        int8: 8,
        uint8: 8,
        int16: 16,
        uint16: 16,
        int32: 32,
        uint32: 32,
        bigint64: 64,
        biguint64: 64,
    };
    const bits = widths[inner.abi.kind];
    if (bits === undefined) throw new TypeError("A pointer value requires an integer descriptor");
    const signed = inner.abi.kind.startsWith("int") || inner.abi.kind === "bigint64";
    const bigint = inner.abi.kind === "bigint64" || inner.abi.kind === "biguint64";
    return {
        abi: { kind: "buffer" },
        encode(value) {
            const encoded = inner.encode(value);
            if (typeof encoded !== "number" && typeof encoded !== "bigint")
                throw new TypeError("Expected an integer pointer value");
            const word = BigInt(encoded);
            const narrowed = signed ? BigInt.asIntN(bits, word) : BigInt.asUintN(bits, word);
            if (narrowed !== word) throw new RangeError("Integer pointer value exceeds its declared range");
            return BigInt.asUintN(64, word);
        },
        decode(value) {
            const word = value == null ? 0n : (value as bigint);
            const narrowed = signed ? BigInt.asIntN(bits, word) : BigInt.asUintN(bits, word);
            return inner.decode(bigint ? narrowed : Number(narrowed));
        },
    };
};

const buildPlan = (descriptor: Descriptor): PlanDefinition => {
    switch (descriptor.kind) {
        case "indirect":
            return indirectPlan(descriptor);
        case "pointerValue":
            return pointerValuePlan(descriptor);
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
        case "biguint64":
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
            return numericPlan(descriptor);
        case "bytes": {
            return {
                abi: { ...descriptor, hasOwnedStorage: descriptor.hasOwnedStorage ?? false },
                encode: identity,
                decode: identity,
            };
        }
        case "object": {
            const { typeName, ...layout } = descriptor;
            return {
                abi: {
                    ...layout,
                    isCallScoped: descriptor.isCallScoped ?? false,
                    ...(typeName === undefined ? {} : { typeResolver: typeResolver(typeName) }),
                },
                encode: identity,
                decode: identity,
            };
        }
        case "boxed": {
            const { abiFields, sharedLibrary, getTypeFnName, freeFnName, ...layout } = descriptor;
            return {
                abi: {
                    ...layout,
                    typeResolver: typeResolver(descriptor.typeName, sharedLibrary, getTypeFnName),
                    hasTypeGetter: sharedLibrary !== undefined && getTypeFnName !== undefined,
                    ...(freeFnName === undefined
                        ? {}
                        : { freeResolver: functionResolver(sharedLibrary ?? "(no library)", freeFnName) }),
                    isCallerAllocated: descriptor.isCallerAllocated ?? false,
                    isInline: descriptor.isInline ?? false,
                    isValueSafe: descriptor.isValueSafe ?? false,
                    ...(abiFields === undefined ? {} : { abiFields: abiFields.map((field) => toAbi(field)) }),
                },
                encode: identity,
                decode: identity,
            };
        }
        case "struct": {
            const { abiFields, sharedLibrary, copyFnName, freeFnName, copyStrategy, ...layout } = descriptor;
            if (copyStrategy !== undefined && copyStrategy !== "cairo-path") {
                throw new TypeError(`Unsupported foreign record copy strategy '${copyStrategy}'`);
            }
            return {
                abi: {
                    ...layout,
                    ...(sharedLibrary === undefined || freeFnName === undefined
                        ? {}
                        : {
                              freeResolver: functionResolver(sharedLibrary, freeFnName),
                              ...(copyFnName === undefined
                                  ? {}
                                  : { copyResolver: functionResolver(sharedLibrary, copyFnName) }),
                          }),
                    ...(copyStrategy === undefined
                        ? {}
                        : { copyConverter: cairoPathConverter(sharedLibrary ?? "(no library)") }),
                    isCallerAllocated: descriptor.isCallerAllocated ?? false,
                    isInline: descriptor.isInline ?? false,
                    isValueSafe: descriptor.isValueSafe ?? false,
                    ...(abiFields === undefined ? {} : { abiFields: abiFields.map((field) => toAbi(field)) }),
                },
                encode: identity,
                decode: identity,
            };
        }
        case "fundamental": {
            const { sharedLibrary, refFnName, unrefFnName, typeName: _typeName, ...layout } = descriptor;
            return {
                abi: {
                    ...layout,
                    unrefLabel: unrefFnName,
                    ...(refFnName === "" ? {} : { refResolver: functionResolver(sharedLibrary, refFnName) }),
                    ...(unrefFnName === "" ? {} : { unrefResolver: functionResolver(sharedLibrary, unrefFnName) }),
                    isCallerAllocated: descriptor.isCallerAllocated ?? false,
                    isInline: descriptor.isInline ?? false,
                    isValueSafe: descriptor.isValueSafe ?? false,
                },
                encode: identity,
                decode: identity,
            };
        }
        case "matchInfo":
        case "void":
        case "buffer": {
            return { abi: descriptor, encode: identity, decode: identity };
        }
    }
};

const compileDescriptor = (descriptor: Descriptor): ScalarPlan => {
    if (compilingDescriptors.has(descriptor)) {
        throw new TypeError("Descriptor nesting must not contain cycles");
    }
    compilingDescriptors.add(descriptor);
    try {
        const plan = buildPlan(descriptor);
        let compiled: ExternalObject<CompiledDescriptor> | undefined;
        return {
            ...plan,
            get compiled() {
                return (compiled ??= compileNativeDescriptor(plan.abi));
            },
        };
    } finally {
        compilingDescriptors.delete(descriptor);
    }
};

const toAbi = (descriptor: Descriptor): NativeDescriptor => compileDescriptor(descriptor).abi;

const compileDescriptors = (args: Descriptor[], returns: Descriptor): DescriptorPlans => ({
    args: args.map((descriptor) => compileDescriptor(descriptor)),
    returns: compileDescriptor(returns),
});

export { adaptCallback, compileDescriptor, compileDescriptors, signalDefaultReturn, toAbi };
export type { DescriptorPlans };
