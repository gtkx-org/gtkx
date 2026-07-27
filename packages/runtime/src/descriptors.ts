import type { ArrayKind, Descriptor, Ownership } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

type Int8Descriptor = Extract<Descriptor, { kind: "int8" }>;
type Uint8Descriptor = Extract<Descriptor, { kind: "uint8" }>;
type Int16Descriptor = Extract<Descriptor, { kind: "int16" }>;
type Uint16Descriptor = Extract<Descriptor, { kind: "uint16" }>;
type Int32Descriptor = Extract<Descriptor, { kind: "int32" }>;
type Uint32Descriptor = Extract<Descriptor, { kind: "uint32" }>;
type Int64Descriptor = Extract<Descriptor, { kind: "int64" }>;
type Uint64Descriptor = Extract<Descriptor, { kind: "uint64" }>;
type BigInt64Descriptor = Extract<Descriptor, { kind: "bigint64" }>;
type BigUint64Descriptor = Extract<Descriptor, { kind: "biguint64" }>;
type Float32Descriptor = Extract<Descriptor, { kind: "float32" }>;
type Float64Descriptor = Extract<Descriptor, { kind: "float64" }>;
type EnumDescriptor = Extract<Descriptor, { kind: "enum" }>;
type FlagsDescriptor = Extract<Descriptor, { kind: "flags" }>;
type BooleanDescriptor = Extract<Descriptor, { kind: "boolean" }>;
type StringDescriptor = Extract<Descriptor, { kind: "string" }>;
type ObjectDescriptor = Extract<Descriptor, { kind: "object" }>;
type UnicharDescriptor = Extract<Descriptor, { kind: "unichar" }>;
type VoidDescriptor = Extract<Descriptor, { kind: "void" }>;
type BufferDescriptor = Extract<Descriptor, { kind: "buffer" }>;
type BoxedDescriptor = Extract<Descriptor, { kind: "boxed" }>;
type StructDescriptor = Extract<Descriptor, { kind: "struct" }> & { wrapperClass?: AnyClass };
type FundamentalDescriptor = Extract<Descriptor, { kind: "fundamental" }> & { wrapperClass?: AnyClass };
type ArrayDescriptor = Extract<Descriptor, { kind: "array" }>;
type HashTableDescriptor = Extract<Descriptor, { kind: "hashtable" }>;
type CallbackDescriptor = Extract<Descriptor, { kind: "callback" }>;
type RefDescriptor = Extract<Descriptor, { kind: "ref" }>;
type TypeDescriptor = BigUint64Descriptor & { type: true };

type BoxedOptions = {
    callerAllocated?: boolean;
    inline?: boolean;
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
    inline?: boolean;
};

type StructOptions = {
    callerAllocated?: boolean;
    inline?: boolean;
    size?: number;
    wrapperClass?: AnyClass;
};

const int8T: Int8Descriptor = { kind: "int8" };
const uint8T: Uint8Descriptor = { kind: "uint8" };
const int16T: Int16Descriptor = { kind: "int16" };
const uint16T: Uint16Descriptor = { kind: "uint16" };
const int32T: Int32Descriptor = { kind: "int32" };
const uint32T: Uint32Descriptor = { kind: "uint32" };
const int64T: Int64Descriptor = { kind: "int64" };
const uint64T: Uint64Descriptor = { kind: "uint64" };
const bigint64T: BigInt64Descriptor = { kind: "bigint64" };
const biguint64T: BigUint64Descriptor = { kind: "biguint64" };
const gtypeT: TypeDescriptor = { kind: "biguint64", type: true };
const float32T: Float32Descriptor = { kind: "float32" };
const float64T: Float64Descriptor = { kind: "float64" };
const booleanT: BooleanDescriptor = { kind: "boolean" };
const voidT: VoidDescriptor = { kind: "void" };
const unicharT: UnicharDescriptor = { kind: "unichar" };
const bufferT: BufferDescriptor = { kind: "buffer" };

const stringT = (ownership: Ownership = "borrowed", length?: number): StringDescriptor =>
    length === undefined ? { kind: "string", ownership } : { kind: "string", ownership, length };

const objectT = (ownership: Ownership = "borrowed"): ObjectDescriptor => ({ kind: "object", ownership });

const refT = (innerDescriptor: Descriptor, isInout = false): RefDescriptor =>
    isInout ? { kind: "ref", innerDescriptor, inout: true } : { kind: "ref", innerDescriptor };

const hashTableT = (
    keyDescriptor: Descriptor,
    valueDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
): HashTableDescriptor => ({
    kind: "hashtable",
    keyDescriptor,
    valueDescriptor,
    ownership,
});

const enumT = (sharedLibrary: string, typeFnName: string, isSigned: boolean): EnumDescriptor => ({
    kind: "enum",
    sharedLibrary,
    getTypeFnName: typeFnName,
    signed: isSigned,
});

const flagsT = (sharedLibrary: string, typeFnName: string, isSigned: boolean): FlagsDescriptor => ({
    kind: "flags",
    sharedLibrary,
    getTypeFnName: typeFnName,
    signed: isSigned,
});

const applyBoxedNames = (result: BoxedDescriptor, options: BoxedOptions): void => {
    if (options.sharedLibrary !== undefined) {
        result.sharedLibrary = options.sharedLibrary;
    }

    if (options.getTypeFnName !== undefined) {
        result.getTypeFnName = options.getTypeFnName;
    }

    if (options.freeFnName !== undefined) {
        result.freeFnName = options.freeFnName;
    }
};

const applyBoxedOptions = (result: BoxedDescriptor, options: BoxedOptions): void => {
    applyBoxedNames(result, options);

    if (options.callerAllocated) {
        result.callerAllocated = true;
    }

    if (options.inline) {
        result.inline = true;
    }

    if (options.size !== undefined) {
        result.size = options.size;
    }
};

const boxedT = (typeName: string, options: BoxedOptions = {}): BoxedDescriptor => {
    const result: BoxedDescriptor = {
        kind: "boxed",
        ownership: options.ownership ?? "borrowed",
        typeName,
    };

    applyBoxedOptions(result, options);

    return result;
};

const structT = (ownership: Ownership = "borrowed", options: StructOptions = {}): StructDescriptor => {
    const result: StructDescriptor = { kind: "struct", ownership };

    if (options.size !== undefined) {
        result.size = options.size;
    }

    if (options.wrapperClass !== undefined) {
        result.wrapperClass = options.wrapperClass;
    }

    if (options.callerAllocated) {
        result.callerAllocated = true;
    }

    if (options.inline) {
        result.inline = true;
    }

    return result;
};

const fundamentalT = (
    sharedLibrary: string,
    refFnName: string,
    unrefFnName: string,
    options: FundamentalOptions = {},
): FundamentalDescriptor => {
    const ownership = options.ownership ?? "borrowed";
    const result: FundamentalDescriptor = { kind: "fundamental", ownership, sharedLibrary, refFnName, unrefFnName };

    if (options.typeName !== undefined) {
        result.typeName = options.typeName;
    }

    if (options.wrapperClass !== undefined) {
        result.wrapperClass = options.wrapperClass;
    }

    if (options.inline) {
        result.inline = true;
    }

    return result;
};

const arrayT = (
    itemDescriptor: Descriptor,
    arrayKind: ArrayKind = "array",
    ownership: Ownership = "borrowed",
    options?: ArrayOptions,
): ArrayDescriptor => {
    const result: ArrayDescriptor = { kind: "array", itemDescriptor, arrayKind, ownership };

    if (options?.elementSize !== undefined) {
        result.elementSize = options.elementSize;
    }

    if (options?.sizeParamIndex !== undefined) {
        result.sizeParamIndex = options.sizeParamIndex;
    }

    if (options?.fixedSize !== undefined) {
        result.fixedSize = options.fixedSize;
    }

    return result;
};

const listT = (itemDescriptor: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemDescriptor, "glist", ownership);

const slistT = (itemDescriptor: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemDescriptor, "gslist", ownership);

const ptrArrayT = (itemDescriptor: Descriptor, ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(itemDescriptor, "gptrarray", ownership);

const gArrayT = (
    itemDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor =>
    arrayT(itemDescriptor, "garray", ownership, elementSize === undefined ? undefined : { elementSize });

const byteArrayT = (ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(uint8T, "gbytearray", ownership);

const sizedArrayT = (
    itemDescriptor: Descriptor,
    sizeParamIndex: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor => arrayT(itemDescriptor, "sized", ownership, { sizeParamIndex, elementSize });

const fixedArrayT = (
    itemDescriptor: Descriptor,
    fixedSize: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayDescriptor => arrayT(itemDescriptor, "fixed", ownership, { fixedSize, elementSize });

const callbackT = (
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
    options?: CallbackOptions,
): CallbackDescriptor => {
    const result: CallbackDescriptor = { kind: "callback", argDescriptors, returnDescriptor };

    if (options?.hasDestroy !== undefined) {
        result.hasDestroy = options.hasDestroy;
    }

    if (options?.userDataIndex !== undefined) {
        result.userDataIndex = options.userDataIndex;
    }

    if (options?.scope !== undefined) {
        result.scope = options.scope;
    }

    return result;
};

export {
    int8T,
    uint8T,
    int16T,
    uint16T,
    int32T,
    uint32T,
    int64T,
    uint64T,
    bigint64T,
    biguint64T,
    gtypeT,
    float32T,
    float64T,
    booleanT,
    voidT,
    unicharT,
    bufferT,
    stringT,
    objectT,
    refT,
    hashTableT,
    enumT,
    flagsT,
    boxedT,
    structT,
    fundamentalT,
    arrayT,
    listT,
    slistT,
    ptrArrayT,
    gArrayT,
    byteArrayT,
    sizedArrayT,
    fixedArrayT,
    callbackT,
    type Int8Descriptor,
    type Uint8Descriptor,
    type Int16Descriptor,
    type Uint16Descriptor,
    type Int32Descriptor,
    type Uint32Descriptor,
    type Int64Descriptor,
    type Uint64Descriptor,
    type BigInt64Descriptor,
    type BigUint64Descriptor,
    type Float32Descriptor,
    type Float64Descriptor,
    type EnumDescriptor,
    type FlagsDescriptor,
    type BooleanDescriptor,
    type StringDescriptor,
    type ObjectDescriptor,
    type UnicharDescriptor,
    type VoidDescriptor,
    type BufferDescriptor,
    type BoxedDescriptor,
    type StructDescriptor,
    type FundamentalDescriptor,
    type ArrayDescriptor,
    type HashTableDescriptor,
    type CallbackDescriptor,
    type RefDescriptor,
    type TypeDescriptor,
};
