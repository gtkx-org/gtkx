import type { ExternalObject } from "./native-binding.cjs";

/**
 * Opaque reference to a native pointer (GObject, Boxed, Fundamental, or struct).
 *
 * Values of this type are produced exclusively by the binding's primitives
 * (`alloc`, `call`, etc.) and must never be constructed by user code. It is
 * the napi `ExternalObject` wrapping a raw native pointer, so TypeScript
 * treats it opaquely.
 */
export type NativeHandle = ExternalObject<unknown>;

/**
 * Union of all possible native return value types.
 *
 * Returned by `call()` and `read()` where the concrete type
 * depends on the type descriptor passed to the function.
 */
export type NativeValue = NativeHandle | number | bigint | string | boolean | NativeValue[] | null | undefined;

type Int8Type = { type: "int8" };
type Uint8Type = { type: "uint8" };
type Int16Type = { type: "int16" };
type Uint16Type = { type: "uint16" };
type Int32Type = { type: "int32" };
type Uint32Type = { type: "uint32" };
type Int64Type = { type: "int64" };
type Uint64Type = { type: "uint64" };
type BigInt64Type = { type: "bigint64" };
type BigUint64Type = { type: "biguint64" };
type Float32Type = { type: "float32" };
type Float64Type = { type: "float64" };
type EnumType = { type: "enum"; library: string; getTypeFn: string; signed: boolean };
type FlagsType = { type: "flags"; library: string; getTypeFn: string; signed: boolean };
type BooleanType = { type: "boolean" };
type Ownership = "full" | "borrowed" | "none";
type StringType = { type: "string"; ownership: Ownership; length?: number };
type GObjectType = { type: "gobject"; ownership: Ownership };
type UnicharType = { type: "unichar" };
type VoidType = { type: "void" };
type BlobType = { type: "blob" };

type BoxedType = {
    type: "boxed";
    ownership: Ownership;
    innerType: string;
    library?: string;
    getTypeFn?: string;
    freeFn?: string;
};

type StructType = { type: "struct"; ownership: Ownership; size?: number };

type FundamentalType = {
    type: "fundamental";
    ownership: Ownership;
    library: string;
    refFn: string;
    unrefFn: string;
    typeName?: string;
};

export type RefType = { type: "ref"; innerType: NativeType };

export type ArrayType = {
    type: "array";
    itemType: NativeType;
    kind: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray" | "sized" | "fixed";
    ownership: Ownership;
    elementSize?: number;
    sizeParamIndex?: number;
    fixedSize?: number;
};

export type HashTableType = {
    type: "hashtable";
    keyType: NativeType;
    valueType: NativeType;
    ownership: Ownership;
};

export type TrampolineType = {
    type: "trampoline";
    argTypes: NativeType[];
    returnType: NativeType;
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: "call" | "notified" | "async" | "forever";
};

/**
 * Discriminated union of all native type descriptors.
 *
 * Describes how to marshal values between JavaScript and native code.
 */
export type NativeType =
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
    | TrampolineType
    | UnicharType
    | VoidType;

/**
 * An argument for an FFI call.
 *
 * Combines a value with its type information for marshaling.
 */
export type NativeArg = {
    /** Type descriptor for marshaling */
    type: NativeType;
    /** The argument value */
    value: unknown;
    /** Whether the argument can be null/undefined */
    optional?: boolean;
};
