import type { ExternalObject } from "./native-binding.cjs";

type AnyValue = Handle | number | bigint | string | boolean | ArrayBufferView | [Value, Value][] | null | undefined;

export type Handle = ExternalObject<unknown>;

export type CallDescriptor = ExternalObject<unknown>;

export type Value = Ref | AnyValue | Value[] | ((...args: never[]) => unknown);

export type Ref = { value: Value | null };

export type Int8Descriptor = { type: "int8" };
export type Uint8Descriptor = { type: "uint8" };
export type Int16Descriptor = { type: "int16" };
export type Uint16Descriptor = { type: "uint16" };
export type Int32Descriptor = { type: "int32" };
export type Uint32Descriptor = { type: "uint32" };
export type Int64Descriptor = { type: "int64" };
export type Uint64Descriptor = { type: "uint64" };
export type BigInt64Descriptor = { type: "bigint64" };
export type BigUint64Descriptor = { type: "biguint64" };
export type Float32Descriptor = { type: "float32" };
export type Float64Descriptor = { type: "float64" };
export type EnumDescriptor = { type: "enum"; library: string; getTypeFn: string; signed: boolean };
export type FlagsDescriptor = { type: "flags"; library: string; getTypeFn: string; signed: boolean };
export type BooleanDescriptor = { type: "boolean" };
export type Ownership = "full" | "borrowed";
export type StringDescriptor = { type: "string"; ownership: Ownership; length?: number };
export type GObjectDescriptor = { type: "gobject"; ownership: Ownership; typeName?: string };
export type UnicharDescriptor = { type: "unichar" };
export type VoidDescriptor = { type: "void" };
export type BufferDescriptor = { type: "buffer" };
export type StructDescriptor = { type: "struct"; ownership: Ownership; size?: number; callerAllocated?: boolean };
export type RefDescriptor = { type: "ref"; innerType: Descriptor; inout?: boolean };

export type BoxedDescriptor = {
    type: "boxed";
    ownership: Ownership;
    innerType: string;
    library?: string;
    getTypeFn?: string;
    freeFn?: string;
    callerAllocated?: boolean;
};

export type FundamentalDescriptor = {
    type: "fundamental";
    ownership: Ownership;
    library: string;
    refFn: string;
    unrefFn: string;
    typeName?: string;
};

export type ArrayDescriptor = {
    type: "array";
    itemType: Descriptor;
    kind: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray" | "sized" | "fixed";
    ownership: Ownership;
    elementSize?: number;
    sizeParamIndex?: number;
    fixedSize?: number;
};

export type HashTableDescriptor = {
    type: "hashtable";
    keyType: Descriptor;
    valueType: Descriptor;
    ownership: Ownership;
};

export type CallbackDescriptor = {
    type: "callback";
    argTypes: Descriptor[];
    returnType: Descriptor;
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

export type ValueOf<D extends Descriptor> = D extends { type: infer Tag }
    ? Tag extends
          | "int8"
          | "uint8"
          | "int16"
          | "uint16"
          | "int32"
          | "uint32"
          | "float32"
          | "float64"
          | "enum"
          | "flags"
          | "unichar"
        ? number
        : Tag extends "int64" | "uint64" | "bigint64" | "biguint64"
          ? bigint
          : Tag extends "boolean"
            ? boolean
            : Tag extends "string"
              ? string | null
              : Tag extends "gobject" | "boxed" | "struct" | "fundamental"
                ? Handle | null
                : Tag extends "void"
                  ? undefined
                  : Value
    : Value;

export type RegisterClassVfunc = {
    byteOffset: number;
    argTypes: Descriptor[];
    returnType: Descriptor;
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
