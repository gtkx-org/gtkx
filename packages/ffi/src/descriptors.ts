import {
    type ArrayType,
    type BigInt64Type,
    type BigUint64Type,
    type BlobType,
    type BooleanType,
    type BoxedType,
    type CallbackType,
    callCompiled,
    compileSignature,
    type EnumType,
    type FlagsType,
    type Float32Type,
    type Float64Type,
    type FundamentalType,
    type GObjectType,
    type HashTableType,
    type Int8Type,
    type Int16Type,
    type Int32Type,
    type Int64Type,
    type Ownership,
    type RefType,
    type StringType,
    type StructType,
    type Type,
    type Uint8Type,
    type Uint16Type,
    type Uint32Type,
    type Uint64Type,
    type UnicharType,
    type Value,
    type ValueOf,
    type VoidType,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

const wrapperClassByDescriptor = new WeakMap<Type, AnyClass>();

export const setDescriptorWrapperClass = (descriptor: Type, wrapperClass: AnyClass): void => {
    wrapperClassByDescriptor.set(descriptor, wrapperClass);
};

export const getDescriptorWrapperClass = (descriptor: Type): AnyClass | undefined =>
    wrapperClassByDescriptor.get(descriptor);

export const bind = <R extends Type>(
    library: string,
    symbol: string,
    argTypes: Type[],
    returnType: R,
): ((...values: Value[]) => ValueOf<R>) => {
    const compiled = compileSignature(argTypes, returnType);
    return (...values) => callCompiled(library, symbol, compiled, values) as ValueOf<R>;
};

export const int8T: Int8Type = Object.freeze({ type: "int8" });
export const uint8T: Uint8Type = Object.freeze({ type: "uint8" });
export const int16T: Int16Type = Object.freeze({ type: "int16" });
export const uint16T: Uint16Type = Object.freeze({ type: "uint16" });
export const int32T: Int32Type = Object.freeze({ type: "int32" });
export const uint32T: Uint32Type = Object.freeze({ type: "uint32" });
export const int64T: Int64Type = Object.freeze({ type: "int64" });
export const uint64T: Uint64Type = Object.freeze({ type: "uint64" });
export const bigint64T: BigInt64Type = Object.freeze({ type: "bigint64" });
export const biguint64T: BigUint64Type = Object.freeze({ type: "biguint64" });
export const float32T: Float32Type = Object.freeze({ type: "float32" });
export const float64T: Float64Type = Object.freeze({ type: "float64" });
export const booleanT: BooleanType = Object.freeze({ type: "boolean" });
export const voidT: VoidType = Object.freeze({ type: "void" });
export const unicharT: UnicharType = Object.freeze({ type: "unichar" });
export const blobT: BlobType = Object.freeze({ type: "blob" });

export const stringT = (ownership: Ownership = "borrowed", length?: number): StringType =>
    length === undefined ? { type: "string", ownership } : { type: "string", ownership, length };

export const objectT = (ownership: Ownership = "borrowed", typeName?: string): GObjectType =>
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

export const boxedT = (innerType: string, options: BoxedOptions = {}): BoxedType => {
    const result: BoxedType = { type: "boxed", ownership: options.ownership ?? "borrowed", innerType };
    if (options.library !== undefined) result.library = options.library;
    if (options.getTypeFn !== undefined) result.getTypeFn = options.getTypeFn;
    if (options.freeFn !== undefined) result.freeFn = options.freeFn;
    if (options.callerAllocated) result.callerAllocated = true;
    return result;
};

export const structT = (ownership: Ownership = "borrowed", options: StructOptions = {}): StructType => {
    const result: StructType = { type: "struct", ownership };
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
): FundamentalType => {
    const ownership = options.ownership ?? "borrowed";
    const result: FundamentalType = { type: "fundamental", ownership, library, refFn, unrefFn };
    if (options.typeName !== undefined) result.typeName = options.typeName;
    if (options.wrapperClass !== undefined) setDescriptorWrapperClass(result, options.wrapperClass);
    return result;
};

export const refT = (innerType: Type, inout = false): RefType =>
    inout ? { type: "ref", innerType, inout: true } : { type: "ref", innerType };

export const hashTableT = (keyType: Type, valueType: Type, ownership: Ownership = "borrowed"): HashTableType => ({
    type: "hashtable",
    keyType,
    valueType,
    ownership,
});

export const enumT = (library: string, getTypeFn: string, signed: boolean): EnumType => ({
    type: "enum",
    library,
    getTypeFn,
    signed,
});

export const flagsT = (library: string, getTypeFn: string, signed: boolean): FlagsType => ({
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
    itemType: Type,
    kind: ArrayType["kind"] = "array",
    ownership: Ownership = "borrowed",
    options?: ArrayOptions,
): ArrayType => {
    const result: ArrayType = { type: "array", itemType, kind, ownership };
    if (options?.elementSize !== undefined) result.elementSize = options.elementSize;
    if (options?.sizeParamIndex !== undefined) result.sizeParamIndex = options.sizeParamIndex;
    if (options?.fixedSize !== undefined) result.fixedSize = options.fixedSize;
    return result;
};

export const listT = (itemType: Type, ownership: Ownership = "borrowed"): ArrayType =>
    arrayT(itemType, "glist", ownership);

export const slistT = (itemType: Type, ownership: Ownership = "borrowed"): ArrayType =>
    arrayT(itemType, "gslist", ownership);

export const ptrArrayT = (itemType: Type, ownership: Ownership = "borrowed"): ArrayType =>
    arrayT(itemType, "gptrarray", ownership);

export const garrayT = (itemType: Type, ownership: Ownership = "borrowed", elementSize?: number): ArrayType =>
    arrayT(itemType, "garray", ownership, elementSize === undefined ? undefined : { elementSize });

export const byteArrayT = (ownership: Ownership = "borrowed"): ArrayType => arrayT(uint8T, "gbytearray", ownership);

export const sizedArrayT = (
    itemType: Type,
    sizeParamIndex: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayType => arrayT(itemType, "sized", ownership, { sizeParamIndex, elementSize });

export const fixedArrayT = (
    itemType: Type,
    fixedSize: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayType => arrayT(itemType, "fixed", ownership, { fixedSize, elementSize });

type CallbackOptions = {
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: CallbackType["scope"];
};

export const callbackT = (argTypes: Type[], returnType: Type, options?: CallbackOptions): CallbackType => {
    const result: CallbackType = { type: "callback", argTypes, returnType };
    if (options?.hasDestroy !== undefined) result.hasDestroy = options.hasDestroy;
    if (options?.userDataIndex !== undefined) result.userDataIndex = options.userDataIndex;
    if (options?.scope !== undefined) result.scope = options.scope;
    return result;
};
