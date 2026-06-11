import type * as native from "./native-binding.cjs";

/**
 * Opaque reference to a native pointer (GObject, Boxed, Fundamental, or struct).
 *
 * Values of this type are produced exclusively by the binding's primitives
 * (`alloc`, `call`, etc.) and must never be constructed by user code. It is
 * the napi `ExternalObject` wrapping a raw native pointer, so TypeScript
 * treats it opaquely.
 */
export type NativeHandle = Parameters<typeof native.read>[0];

/**
 * Union of all possible FFI return value types.
 *
 * Returned by `call()` and `read()` where the concrete type
 * depends on the type descriptor passed to the function.
 */
export type FfiValue = NativeHandle | number | string | boolean | FfiValue[] | null | undefined;

type Int8Type = { type: "int8" };
type Uint8Type = { type: "uint8" };
type Int16Type = { type: "int16" };
type Uint16Type = { type: "uint16" };
type Int32Type = { type: "int32" };
type Uint32Type = { type: "uint32" };
type Int64Type = { type: "int64" };
type Uint64Type = { type: "uint64" };

type Float32Type = { type: "float32" };
type Float64Type = { type: "float64" };

type EnumType = { type: "enum"; library: string; getTypeFn: string; signed: boolean };
type FlagsType = { type: "flags"; library: string; getTypeFn: string; signed: boolean };

type BooleanType = { type: "boolean" };

type Ownership = "full" | "borrowed" | "none";

type StringType = { type: "string"; ownership: Ownership; length?: number };

type GObjectType = { type: "gobject"; ownership: Ownership };

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

export type ArrayType = {
    type: "array";
    itemType: Type;
    kind: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray" | "sized" | "fixed";
    ownership: Ownership;
    elementSize?: number;
    sizeParamIndex?: number;
    fixedSize?: number;
};

type BlobType = { type: "blob" };

export type HashTableType = {
    type: "hashtable";
    keyType: Type;
    valueType: Type;
    ownership: Ownership;
};

export type RefType = { type: "ref"; innerType: Type };

type UnicharType = { type: "unichar" };

type VoidType = { type: "void" };

export type TrampolineType = {
    type: "trampoline";
    argTypes: Type[];
    returnType: Type;
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: "call" | "notified" | "async" | "forever";
};

/**
 * Discriminated union of all FFI type descriptors.
 *
 * Describes how to marshal values between JavaScript and native code.
 */
export type Type =
    | Int8Type
    | Uint8Type
    | Int16Type
    | Uint16Type
    | Int32Type
    | Uint32Type
    | Int64Type
    | Uint64Type
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
export type Arg = {
    /** Type descriptor for marshaling */
    type: Type;
    /** The argument value */
    value: unknown;
    /** Whether the argument can be null/undefined */
    optional?: boolean;
};
