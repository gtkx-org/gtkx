import type { ExternalObject } from "./native-binding.cjs";

type AnyValue = Handle | number | bigint | string | boolean | ArrayBufferView | [Value, Value][] | null | undefined;

export type Handle = ExternalObject<unknown>;
export type CallDescriptor = ExternalObject<unknown>;
export type Value = Ref | AnyValue | Value[] | ((...args: never[]) => unknown);
export type Ref = { value: Value | null };
export type Int8Descriptor = { kind: "int8" };
export type Uint8Descriptor = { kind: "uint8" };
export type Int16Descriptor = { kind: "int16" };
export type Uint16Descriptor = { kind: "uint16" };
export type Int32Descriptor = { kind: "int32" };
export type Uint32Descriptor = { kind: "uint32" };
export type Int64Descriptor = { kind: "int64" };
export type Uint64Descriptor = { kind: "uint64" };
export type BigInt64Descriptor = { kind: "bigint64" };
export type BigUint64Descriptor = { kind: "biguint64" };
export type Float32Descriptor = { kind: "float32" };
export type Float64Descriptor = { kind: "float64" };
export type EnumDescriptor = { kind: "enum"; sharedLibrary: string; getTypeFn: string; signed: boolean };
export type FlagsDescriptor = { kind: "flags"; sharedLibrary: string; getTypeFn: string; signed: boolean };
export type BooleanDescriptor = { kind: "boolean" };
export type Ownership = "full" | "borrowed";
export type StringDescriptor = { kind: "string"; ownership: Ownership; length?: number };
export type GObjectDescriptor = { kind: "gobject"; ownership: Ownership };
export type UnicharDescriptor = { kind: "unichar" };
export type VoidDescriptor = { kind: "void" };
export type BufferDescriptor = { kind: "buffer" };
export type StructDescriptor = { kind: "struct"; ownership: Ownership; size?: number; callerAllocated?: boolean };
export type RefDescriptor = { kind: "ref"; innerType: Descriptor; inout?: boolean };

export type BoxedDescriptor = {
    kind: "boxed";
    ownership: Ownership;
    typeName: string;
    sharedLibrary?: string;
    getTypeFn?: string;
    freeFn?: string;
    callerAllocated?: boolean;
};

export type FundamentalDescriptor = {
    kind: "fundamental";
    ownership: Ownership;
    sharedLibrary: string;
    refFn: string;
    unrefFn: string;
    typeName?: string;
};

export type ArrayDescriptor = {
    kind: "array";
    itemDescriptor: Descriptor;
    arrayKind: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray" | "sized" | "fixed";
    ownership: Ownership;
    elementSize?: number;
    sizeParamIndex?: number;
    fixedSize?: number;
};

export type HashTableDescriptor = {
    kind: "hashtable";
    keyDescriptor: Descriptor;
    valueDescriptor: Descriptor;
    ownership: Ownership;
};

export type CallbackDescriptor = {
    kind: "callback";
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: "call" | "notified" | "async" | "forever";
};

export type Descriptor =
    | Int8Descriptor
    | Uint8Descriptor
    | Int16Descriptor
    | Uint16Descriptor
    | Int32Descriptor
    | Uint32Descriptor
    | Int64Descriptor
    | Uint64Descriptor
    | BigInt64Descriptor
    | BigUint64Descriptor
    | Float32Descriptor
    | Float64Descriptor
    | EnumDescriptor
    | FlagsDescriptor
    | BooleanDescriptor
    | StringDescriptor
    | GObjectDescriptor
    | BoxedDescriptor
    | StructDescriptor
    | FundamentalDescriptor
    | ArrayDescriptor
    | BufferDescriptor
    | HashTableDescriptor
    | RefDescriptor
    | CallbackDescriptor
    | UnicharDescriptor
    | VoidDescriptor;

export type RegisterClassVfunc = {
    byteOffset: number;
    argDescriptors: Descriptor[];
    returnDescriptor: Descriptor;
    fn: (...args: Value[]) => Value;
};

export type RegisterClassInterface = {
    gtype: bigint;
    vfuncs: RegisterClassVfunc[];
};

export type RegisterClassOptions = {
    vfuncs?: RegisterClassVfunc[];
    interfaces?: RegisterClassInterface[];
};
