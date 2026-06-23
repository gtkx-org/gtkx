import type { ExternalObject } from "./native-binding.cjs";

type AnyValue = Handle | number | bigint | string | boolean | ArrayBufferView | [Value, Value][] | null | undefined;

export type Handle = ExternalObject<unknown>;

export type CompiledSignature = ExternalObject<unknown>;

export type Value = Ref | AnyValue | Value[] | ((...args: never[]) => unknown);

export type Ref = { value: Value | null };

export type Int8Type = { type: "int8" };
export type Uint8Type = { type: "uint8" };
export type Int16Type = { type: "int16" };
export type Uint16Type = { type: "uint16" };
export type Int32Type = { type: "int32" };
export type Uint32Type = { type: "uint32" };
export type Int64Type = { type: "int64" };
export type Uint64Type = { type: "uint64" };
export type BigInt64Type = { type: "bigint64" };
export type BigUint64Type = { type: "biguint64" };
export type Float32Type = { type: "float32" };
export type Float64Type = { type: "float64" };
export type EnumType = { type: "enum"; library: string; getTypeFn: string; signed: boolean };
export type FlagsType = { type: "flags"; library: string; getTypeFn: string; signed: boolean };
export type BooleanType = { type: "boolean" };
export type Ownership = "full" | "borrowed";
export type StringType = { type: "string"; ownership: Ownership; length?: number };
export type GObjectType = { type: "gobject"; ownership: Ownership; typeName?: string };
export type UnicharType = { type: "unichar" };
export type VoidType = { type: "void" };
export type BlobType = { type: "blob" };
export type StructType = { type: "struct"; ownership: Ownership; size?: number; callerAllocated?: boolean };
export type RefType = { type: "ref"; innerType: Type; inout?: boolean };

export type BoxedType = {
    type: "boxed";
    ownership: Ownership;
    innerType: string;
    library?: string;
    getTypeFn?: string;
    freeFn?: string;
    callerAllocated?: boolean;
};

export type FundamentalType = {
    type: "fundamental";
    ownership: Ownership;
    library: string;
    refFn: string;
    unrefFn: string;
    typeName?: string;
};

export type ArrayType = {
    type: "array";
    itemType: Type;
    kind: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray" | "sized" | "fixed";
    ownership: Ownership;
    elementSize?: number;
    sizeParamIndex?: number;
    fixedSize?: number;
};

export type HashTableType = {
    type: "hashtable";
    keyType: Type;
    valueType: Type;
    ownership: Ownership;
};

export type CallbackType = {
    type: "callback";
    argTypes: Type[];
    returnType: Type;
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: "call" | "notified" | "async" | "forever";
};

export type Type =
    | Int8Type
    | Uint8Type
    | Int16Type
    | Uint16Type
    | Int32Type
    | Uint32Type
    | Int64Type
    | Uint64Type
    | BigInt64Type
    | BigUint64Type
    | Float32Type
    | Float64Type
    | EnumType
    | FlagsType
    | BooleanType
    | StringType
    | GObjectType
    | BoxedType
    | StructType
    | FundamentalType
    | ArrayType
    | BlobType
    | HashTableType
    | RefType
    | CallbackType
    | UnicharType
    | VoidType;

export type ValueOf<D extends Type> = D extends { type: infer Tag }
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

export type Arg = {
    type: Type;
    value: Value;
};

export type RegisterClassVfunc = {
    byteOffset: number;
    argTypes: Type[];
    returnType: Type;
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
