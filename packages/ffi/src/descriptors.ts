import {
    type ArrayDescriptor,
    type BigInt64Descriptor,
    type BigUint64Descriptor,
    type BooleanDescriptor,
    type BoxedDescriptor,
    type BufferDescriptor,
    type CallbackDescriptor,
    call,
    type Descriptor,
    type EnumDescriptor,
    type FlagsDescriptor,
    type Float32Descriptor,
    type Float64Descriptor,
    type FundamentalDescriptor,
    type HashTableDescriptor,
    type Int8Descriptor,
    type Int16Descriptor,
    type Int32Descriptor,
    type Int64Descriptor,
    bind as nativeBind,
    type ObjectDescriptor,
    type Ownership,
    type RefDescriptor,
    type StringDescriptor,
    type StructDescriptor,
    type Uint8Descriptor,
    type Uint16Descriptor,
    type Uint32Descriptor,
    type Uint64Descriptor,
    type UnicharDescriptor,
    type Value,
    type VoidDescriptor,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

const wrapperClassByDescriptor = new WeakMap<Descriptor, AnyClass>();

const setDescriptorWrapperClass = (descriptor: Descriptor, wrapperClass: AnyClass): void => {
    wrapperClassByDescriptor.set(descriptor, wrapperClass);
};

export const getDescriptorWrapperClass = (descriptor: Descriptor): AnyClass | undefined =>
    wrapperClassByDescriptor.get(descriptor);

export const bind = (
    sharedLibrary: string,
    symbol: string,
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
): ((...values: Value[]) => Value) => {
    const descriptor = nativeBind(sharedLibrary, symbol, argDescriptors, returnDescriptor);
    return (...values) => call(descriptor, values);
};

type BoundCall = (...values: Value[]) => Value;

/**
 * Creates a cache of compiled bindings keyed by string. The first call for a key builds the binding
 * (compiling its signature once); later calls reuse it. Use when a call site's signature varies
 * along a small, stable axis — e.g. a boxed type name, or a `(class, signal)` pair — so each
 * distinct signature is compiled exactly once instead of on every call.
 */
export const createBindCache = (): ((key: string, make: () => BoundCall) => BoundCall) => {
    const cache = new Map<string, BoundCall>();
    return (key, make) => {
        const existing = cache.get(key);
        if (existing !== undefined) return existing;
        const bound = make();
        cache.set(key, bound);
        return bound;
    };
};

export const int8T: Int8Descriptor = Object.freeze({ kind: "int8" });
export const uint8T: Uint8Descriptor = Object.freeze({ kind: "uint8" });
export const int16T: Int16Descriptor = Object.freeze({ kind: "int16" });
export const uint16T: Uint16Descriptor = Object.freeze({ kind: "uint16" });
export const int32T: Int32Descriptor = Object.freeze({ kind: "int32" });
export const uint32T: Uint32Descriptor = Object.freeze({ kind: "uint32" });
export const int64T: Int64Descriptor = Object.freeze({ kind: "int64" });
export const uint64T: Uint64Descriptor = Object.freeze({ kind: "uint64" });
export const bigint64T: BigInt64Descriptor = Object.freeze({ kind: "bigint64" });
export const biguint64T: BigUint64Descriptor = Object.freeze({ kind: "biguint64" });

const typeFunctionCache = createBindCache();

/**
 * Invokes a GObject `*_get_type()` function — no arguments, returning the `GType` as a `bigint` —
 * memoizing one `([], biguint64)` binding per `(sharedLibrary, symbol)` so each type function is bound
 * exactly once.
 */
export const callTypeFunction = (sharedLibrary: string, symbol: string): bigint =>
    typeFunctionCache(`${sharedLibrary} ${symbol}`, () => bind(sharedLibrary, symbol, [], biguint64T))() as bigint;
export const float32T: Float32Descriptor = Object.freeze({ kind: "float32" });
export const float64T: Float64Descriptor = Object.freeze({ kind: "float64" });
export const booleanT: BooleanDescriptor = Object.freeze({ kind: "boolean" });
export const voidT: VoidDescriptor = Object.freeze({ kind: "void" });
export const unicharT: UnicharDescriptor = Object.freeze({ kind: "unichar" });
export const bufferT: BufferDescriptor = Object.freeze({ kind: "buffer" });

export const stringT = (ownership: Ownership = "borrowed", length?: number): StringDescriptor =>
    length === undefined ? { kind: "string", ownership } : { kind: "string", ownership, length };

export const objectT = (ownership: Ownership = "borrowed"): ObjectDescriptor => ({ kind: "object", ownership });

type CallerAllocatable = {
    callerAllocated?: boolean;
};

type BoxedOptions = CallerAllocatable & {
    ownership?: Ownership;
    sharedLibrary?: string;
    getTypeFn?: string;
    freeFn?: string;
};

type StructOptions = CallerAllocatable & {
    size?: number;
    wrapperClass?: AnyClass;
};

export const boxedT = (typeName: string, options: BoxedOptions = {}): BoxedDescriptor => {
    const result: BoxedDescriptor = {
        kind: "boxed",
        ownership: options.ownership ?? "borrowed",
        typeName,
    };
    if (options.sharedLibrary !== undefined) result.sharedLibrary = options.sharedLibrary;
    if (options.getTypeFn !== undefined) result.getTypeFn = options.getTypeFn;
    if (options.freeFn !== undefined) result.freeFn = options.freeFn;
    if (options.callerAllocated) result.callerAllocated = true;
    return result;
};

export const structT = (ownership: Ownership = "borrowed", options: StructOptions = {}): StructDescriptor => {
    const result: StructDescriptor = { kind: "struct", ownership };
    if (options.size !== undefined) result.size = options.size;
    if (options.wrapperClass !== undefined) setDescriptorWrapperClass(result, options.wrapperClass);
    if (options.callerAllocated) result.callerAllocated = true;
    return result;
};

type FundamentalOptions = {
    ownership?: Ownership;
    typeName?: string;
    wrapperClass?: AnyClass;
};

export const fundamentalT = (
    sharedLibrary: string,
    refFn: string,
    unrefFn: string,
    options: FundamentalOptions = {},
): FundamentalDescriptor => {
    const ownership = options.ownership ?? "borrowed";
    const result: FundamentalDescriptor = { kind: "fundamental", ownership, sharedLibrary, refFn, unrefFn };
    if (options.typeName !== undefined) result.typeName = options.typeName;
    if (options.wrapperClass !== undefined) setDescriptorWrapperClass(result, options.wrapperClass);
    return result;
};

export const refT = (innerType: Descriptor, inout = false): RefDescriptor =>
    inout ? { kind: "ref", innerType, inout: true } : { kind: "ref", innerType };

export const hashTableT = (
    keyDescriptor: Descriptor,
    valueDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
): HashTableDescriptor => ({
    kind: "hashtable",
    keyDescriptor,
    valueDescriptor,
    ownership,
});

export const enumT = (sharedLibrary: string, getTypeFn: string, signed: boolean): EnumDescriptor => ({
    kind: "enum",
    sharedLibrary,
    getTypeFn,
    signed,
});

export const flagsT = (sharedLibrary: string, getTypeFn: string, signed: boolean): FlagsDescriptor => ({
    kind: "flags",
    sharedLibrary,
    getTypeFn,
    signed,
});

type ArrayOptions = {
    elementSize?: number | undefined;
    sizeParamIndex?: number | undefined;
    fixedSize?: number | undefined;
};

export const arrayT = (
    itemDescriptor: Descriptor,
    arrayKind: ArrayDescriptor["arrayKind"] = "array",
    ownership: Ownership = "borrowed",
    options?: ArrayOptions,
): ArrayDescriptor => {
    const result: ArrayDescriptor = { kind: "array", itemDescriptor, arrayKind, ownership };
    if (options?.elementSize !== undefined) result.elementSize = options.elementSize;
    if (options?.sizeParamIndex !== undefined) result.sizeParamIndex = options.sizeParamIndex;
    if (options?.fixedSize !== undefined) result.fixedSize = options.fixedSize;
    return result;
};

export const listT = (itemDescriptor: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemDescriptor, "glist", ownership);

export const slistT = (itemDescriptor: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemDescriptor, "gslist", ownership);

export const ptrArrayT = (itemDescriptor: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemDescriptor, "gptrarray", ownership);

export const gArrayT = (
    itemDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor =>
    arrayT(itemDescriptor, "garray", ownership, elementSize === undefined ? undefined : { elementSize });

export const byteArrayT = (ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(uint8T, "gbytearray", ownership);

export const sizedArrayT = (
    itemDescriptor: Descriptor,
    sizeParamIndex: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor => arrayT(itemDescriptor, "sized", ownership, { sizeParamIndex, elementSize });

export const fixedArrayT = (
    itemDescriptor: Descriptor,
    fixedSize: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor => arrayT(itemDescriptor, "fixed", ownership, { fixedSize, elementSize });

type CallbackOptions = {
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: CallbackDescriptor["scope"];
};

export const callbackT = (
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
    options?: CallbackOptions,
): CallbackDescriptor => {
    const result: CallbackDescriptor = { kind: "callback", argDescriptors, returnDescriptor };
    if (options?.hasDestroy !== undefined) result.hasDestroy = options.hasDestroy;
    if (options?.userDataIndex !== undefined) result.userDataIndex = options.userDataIndex;
    if (options?.scope !== undefined) result.scope = options.scope;
    return result;
};
