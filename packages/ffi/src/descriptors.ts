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
    type GObjectDescriptor,
    type HashTableDescriptor,
    type Int8Descriptor,
    type Int16Descriptor,
    type Int32Descriptor,
    type Int64Descriptor,
    bind as nativeBind,
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
    type ValueOf,
    type VoidDescriptor,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

const wrapperClassByDescriptor = new WeakMap<Descriptor, AnyClass>();

const setDescriptorWrapperClass = (descriptor: Descriptor, wrapperClass: AnyClass): void => {
    wrapperClassByDescriptor.set(descriptor, wrapperClass);
};

export const getDescriptorWrapperClass = (descriptor: Descriptor): AnyClass | undefined =>
    wrapperClassByDescriptor.get(descriptor);

export const bind = <R extends Descriptor>(
    library: string,
    symbol: string,
    argTypes: Descriptor[],
    returnType: R,
): ((...values: Value[]) => ValueOf<R>) => {
    const descriptor = nativeBind(library, symbol, argTypes, returnType);
    return (...values) => call(descriptor, values) as ValueOf<R>;
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

export const int8T: Int8Descriptor = Object.freeze({ type: "int8" });
export const uint8T: Uint8Descriptor = Object.freeze({ type: "uint8" });
export const int16T: Int16Descriptor = Object.freeze({ type: "int16" });
export const uint16T: Uint16Descriptor = Object.freeze({ type: "uint16" });
export const int32T: Int32Descriptor = Object.freeze({ type: "int32" });
export const uint32T: Uint32Descriptor = Object.freeze({ type: "uint32" });
export const int64T: Int64Descriptor = Object.freeze({ type: "int64" });
export const uint64T: Uint64Descriptor = Object.freeze({ type: "uint64" });
export const bigint64T: BigInt64Descriptor = Object.freeze({ type: "bigint64" });
export const biguint64T: BigUint64Descriptor = Object.freeze({ type: "biguint64" });

const typeFunctionCache = createBindCache();

/**
 * Invokes a GObject `*_get_type()` function — no arguments, returning the `GType` as a `bigint` —
 * memoizing one `([], biguint64)` binding per `(library, symbol)` so each type function is bound
 * exactly once.
 */
export const callTypeFunction = (library: string, symbol: string): bigint =>
    typeFunctionCache(`${library} ${symbol}`, () => bind(library, symbol, [], biguint64T))() as bigint;
export const float32T: Float32Descriptor = Object.freeze({ type: "float32" });
export const float64T: Float64Descriptor = Object.freeze({ type: "float64" });
export const booleanT: BooleanDescriptor = Object.freeze({ type: "boolean" });
export const voidT: VoidDescriptor = Object.freeze({ type: "void" });
export const unicharT: UnicharDescriptor = Object.freeze({ type: "unichar" });
export const bufferT: BufferDescriptor = Object.freeze({ type: "buffer" });

export const stringT = (ownership: Ownership = "borrowed", length?: number): StringDescriptor =>
    length === undefined ? { type: "string", ownership } : { type: "string", ownership, length };

export const objectT = (ownership: Ownership = "borrowed", typeName?: string): GObjectDescriptor =>
    typeName === undefined ? { type: "gobject", ownership } : { type: "gobject", ownership, typeName };

type CallerAllocatable = {
    callerAllocated?: boolean;
};

type BoxedOptions = CallerAllocatable & {
    ownership?: Ownership;
    library?: string;
    getTypeFn?: string;
    freeFn?: string;
};

type StructOptions = CallerAllocatable & {
    size?: number;
    wrapperClass?: AnyClass;
};

export const boxedT = (innerTypeName: string, options: BoxedOptions = {}): BoxedDescriptor => {
    const result: BoxedDescriptor = {
        type: "boxed",
        ownership: options.ownership ?? "borrowed",
        innerType: innerTypeName,
    };
    if (options.library !== undefined) result.library = options.library;
    if (options.getTypeFn !== undefined) result.getTypeFn = options.getTypeFn;
    if (options.freeFn !== undefined) result.freeFn = options.freeFn;
    if (options.callerAllocated) result.callerAllocated = true;
    return result;
};

export const structT = (ownership: Ownership = "borrowed", options: StructOptions = {}): StructDescriptor => {
    const result: StructDescriptor = { type: "struct", ownership };
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
    library: string,
    refFn: string,
    unrefFn: string,
    options: FundamentalOptions = {},
): FundamentalDescriptor => {
    const ownership = options.ownership ?? "borrowed";
    const result: FundamentalDescriptor = { type: "fundamental", ownership, library, refFn, unrefFn };
    if (options.typeName !== undefined) result.typeName = options.typeName;
    if (options.wrapperClass !== undefined) setDescriptorWrapperClass(result, options.wrapperClass);
    return result;
};

export const refT = (innerType: Descriptor, inout = false): RefDescriptor =>
    inout ? { type: "ref", innerType, inout: true } : { type: "ref", innerType };

export const hashTableT = (
    keyType: Descriptor,
    valueType: Descriptor,
    ownership: Ownership = "borrowed",
): HashTableDescriptor => ({
    type: "hashtable",
    keyType,
    valueType,
    ownership,
});

export const enumT = (library: string, getTypeFn: string, signed: boolean): EnumDescriptor => ({
    type: "enum",
    library,
    getTypeFn,
    signed,
});

export const flagsT = (library: string, getTypeFn: string, signed: boolean): FlagsDescriptor => ({
    type: "flags",
    library,
    getTypeFn,
    signed,
});

type ArrayOptions = {
    elementSize?: number | undefined;
    sizeParamIndex?: number | undefined;
    fixedSize?: number | undefined;
};

export const arrayT = (
    itemType: Descriptor,
    kind: ArrayDescriptor["kind"] = "array",
    ownership: Ownership = "borrowed",
    options?: ArrayOptions,
): ArrayDescriptor => {
    const result: ArrayDescriptor = { type: "array", itemType, kind, ownership };
    if (options?.elementSize !== undefined) result.elementSize = options.elementSize;
    if (options?.sizeParamIndex !== undefined) result.sizeParamIndex = options.sizeParamIndex;
    if (options?.fixedSize !== undefined) result.fixedSize = options.fixedSize;
    return result;
};

export const listT = (itemType: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemType, "glist", ownership);

export const slistT = (itemType: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemType, "gslist", ownership);

export const ptrArrayT = (itemType: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemType, "gptrarray", ownership);

export const gArrayT = (
    itemType: Descriptor,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor => arrayT(itemType, "garray", ownership, elementSize === undefined ? undefined : { elementSize });

export const byteArrayT = (ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(uint8T, "gbytearray", ownership);

export const sizedArrayT = (
    itemType: Descriptor,
    sizeParamIndex: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor => arrayT(itemType, "sized", ownership, { sizeParamIndex, elementSize });

export const fixedArrayT = (
    itemType: Descriptor,
    fixedSize: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor => arrayT(itemType, "fixed", ownership, { fixedSize, elementSize });

type CallbackOptions = {
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: CallbackDescriptor["scope"];
};

export const callbackT = (
    argTypes: Descriptor[],
    returnType: Descriptor,
    options?: CallbackOptions,
): CallbackDescriptor => {
    const result: CallbackDescriptor = { type: "callback", argTypes, returnType };
    if (options?.hasDestroy !== undefined) result.hasDestroy = options.hasDestroy;
    if (options?.userDataIndex !== undefined) result.userDataIndex = options.userDataIndex;
    if (options?.scope !== undefined) result.scope = options.scope;
    return result;
};
