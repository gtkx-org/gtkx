import type { ArrayKind, Descriptor, Ownership } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

export type Int8Descriptor = Extract<Descriptor, { kind: "int8" }>;
export type Uint8Descriptor = Extract<Descriptor, { kind: "uint8" }>;
export type Int16Descriptor = Extract<Descriptor, { kind: "int16" }>;
export type Uint16Descriptor = Extract<Descriptor, { kind: "uint16" }>;
export type Int32Descriptor = Extract<Descriptor, { kind: "int32" }>;
export type Uint32Descriptor = Extract<Descriptor, { kind: "uint32" }>;
export type Int64Descriptor = Extract<Descriptor, { kind: "int64" }>;
export type Uint64Descriptor = Extract<Descriptor, { kind: "uint64" }>;
export type BigInt64Descriptor = Extract<Descriptor, { kind: "bigint64" }>;
export type BigUint64Descriptor = Extract<Descriptor, { kind: "biguint64" }>;
export type Float32Descriptor = Extract<Descriptor, { kind: "float32" }>;
export type Float64Descriptor = Extract<Descriptor, { kind: "float64" }>;
export type EnumDescriptor = Extract<Descriptor, { kind: "enum" }>;
export type FlagsDescriptor = Extract<Descriptor, { kind: "flags" }>;
export type BooleanDescriptor = Extract<Descriptor, { kind: "boolean" }>;
export type StringDescriptor = Extract<Descriptor, { kind: "string" }>;
export type ObjectDescriptor = Extract<Descriptor, { kind: "object" }>;
export type UnicharDescriptor = Extract<Descriptor, { kind: "unichar" }>;
export type VoidDescriptor = Extract<Descriptor, { kind: "void" }>;
export type BufferDescriptor = Extract<Descriptor, { kind: "buffer" }>;
export type BoxedDescriptor = Extract<Descriptor, { kind: "boxed" }>;
export type StructDescriptor = Extract<Descriptor, { kind: "struct" }> & { wrapperClass?: AnyClass };
export type FundamentalDescriptor = Extract<Descriptor, { kind: "fundamental" }> & { wrapperClass?: AnyClass };
export type ArrayDescriptor = Extract<Descriptor, { kind: "array" }>;
export type HashTableDescriptor = Extract<Descriptor, { kind: "hashtable" }>;
export type CallbackDescriptor = Extract<Descriptor, { kind: "callback" }>;
export type RefDescriptor = Extract<Descriptor, { kind: "ref" }>;
export type TypeDescriptor = BigUint64Descriptor & { type: true };

type BoxedOptions = {
    callerAllocated?: boolean;
    ownership?: Ownership;
    sharedLibrary?: string;
    getTypeFnName?: string;
    freeFnName?: string;
    size?: number;
};

type CallbackOptions = {
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: CallbackDescriptor["scope"];
};

type ArrayOptions = {
    elementSize?: number | undefined;
    sizeParamIndex?: number | undefined;
    fixedSize?: number | undefined;
};

type FundamentalOptions = {
    ownership?: Ownership;
    typeName?: string;
    wrapperClass?: AnyClass;
};

type StructOptions = {
    callerAllocated?: boolean;
    size?: number;
    wrapperClass?: AnyClass;
};

export const int8T: Int8Descriptor = { kind: "int8" };
export const uint8T: Uint8Descriptor = { kind: "uint8" };
export const int16T: Int16Descriptor = { kind: "int16" };
export const uint16T: Uint16Descriptor = { kind: "uint16" };
export const int32T: Int32Descriptor = { kind: "int32" };
export const uint32T: Uint32Descriptor = { kind: "uint32" };
export const int64T: Int64Descriptor = { kind: "int64" };
export const uint64T: Uint64Descriptor = { kind: "uint64" };
export const bigint64T: BigInt64Descriptor = { kind: "bigint64" };
export const biguint64T: BigUint64Descriptor = { kind: "biguint64" };
export const gtypeT: TypeDescriptor = { kind: "biguint64", type: true };
export const float32T: Float32Descriptor = { kind: "float32" };
export const float64T: Float64Descriptor = { kind: "float64" };
export const booleanT: BooleanDescriptor = { kind: "boolean" };
export const voidT: VoidDescriptor = { kind: "void" };
export const unicharT: UnicharDescriptor = { kind: "unichar" };
export const bufferT: BufferDescriptor = { kind: "buffer" };

export const stringT = (ownership: Ownership = "borrowed", length?: number): StringDescriptor =>
    length === undefined ? { kind: "string", ownership } : { kind: "string", ownership, length };

export const objectT = (ownership: Ownership = "borrowed"): ObjectDescriptor => ({ kind: "object", ownership });

export const refT = (innerDescriptor: Descriptor, inout = false): RefDescriptor =>
    inout ? { kind: "ref", innerDescriptor, inout: true } : { kind: "ref", innerDescriptor };

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

export const enumT = (sharedLibrary: string, getTypeFnName: string, signed: boolean): EnumDescriptor => ({
    kind: "enum",
    sharedLibrary,
    getTypeFnName,
    signed,
});

export const flagsT = (sharedLibrary: string, getTypeFnName: string, signed: boolean): FlagsDescriptor => ({
    kind: "flags",
    sharedLibrary,
    getTypeFnName,
    signed,
});

export const boxedT = (typeName: string, options: BoxedOptions = {}): BoxedDescriptor => {
    const result: BoxedDescriptor = {
        kind: "boxed",
        ownership: options.ownership ?? "borrowed",
        typeName,
    };
    if (options.sharedLibrary !== undefined) result.sharedLibrary = options.sharedLibrary;
    if (options.getTypeFnName !== undefined) result.getTypeFnName = options.getTypeFnName;
    if (options.freeFnName !== undefined) result.freeFnName = options.freeFnName;
    if (options.callerAllocated) result.callerAllocated = true;
    if (options.size !== undefined) result.size = options.size;
    return result;
};

export const structT = (ownership: Ownership = "borrowed", options: StructOptions = {}): StructDescriptor => {
    const result: StructDescriptor = { kind: "struct", ownership };
    if (options.size !== undefined) result.size = options.size;
    if (options.wrapperClass !== undefined) result.wrapperClass = options.wrapperClass;
    if (options.callerAllocated) result.callerAllocated = true;
    return result;
};

export const fundamentalT = (
    sharedLibrary: string,
    refFnName: string,
    unrefFnName: string,
    options: FundamentalOptions = {},
): FundamentalDescriptor => {
    const ownership = options.ownership ?? "borrowed";
    const result: FundamentalDescriptor = { kind: "fundamental", ownership, sharedLibrary, refFnName, unrefFnName };
    if (options.typeName !== undefined) result.typeName = options.typeName;
    if (options.wrapperClass !== undefined) result.wrapperClass = options.wrapperClass;
    return result;
};

export const arrayT = (
    itemDescriptor: Descriptor,
    arrayKind: ArrayKind = "array",
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
