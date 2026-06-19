import type { ExternalObject } from "./native-binding.cjs";

type AnyValue = Handle | number | bigint | string | boolean | ArrayBufferView | [Value, Value][] | null | undefined;

/**
 * Opaque reference to a native pointer (GObject, Boxed, Fundamental, or struct).
 *
 * Values of this type are produced exclusively by the binding's primitives
 * (`alloc`, `call`, etc.) and must never be constructed by user code. It is
 * the napi `ExternalObject` wrapping a raw native pointer, so TypeScript
 * treats it opaquely.
 */
export type Handle = ExternalObject<unknown>;

/**
 * Union of all possible native return value types.
 *
 * Returned by `call()` and `read()` where the concrete type
 * depends on the type descriptor passed to the function.
 */
export type Value = Ref | AnyValue | readonly Value[] | ((...args: never[]) => unknown);

/**
 * Out-parameter reference to a native value.
 *
 * Used for FFI calls that return values via out-parameters. The `value` field
 * is populated by the FFI call and read by the caller. The `value` may be
 * `null` or `undefined` if the out-parameter was not populated.
 */
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
export type Ownership = "full" | "borrowed" | "none";
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

export type TrampolineType = {
    type: "trampoline";
    argTypes: Type[];
    returnType: Type;
    hasDestroy?: boolean;
    userDataIndex?: number;
    scope?: "call" | "notified" | "async" | "forever";
};

/**
 * Discriminated union of all native type descriptors.
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
export type Arg = {
    /** The argument's type descriptor. */
    type: Type;
    /** The argument value */
    value: Value;
};

/**
 * Virtual function override installed into a registered class's vtable.
 *
 * `byteOffset` is the offset (in bytes) of the function pointer slot inside
 * the class struct relative to the class struct base; the JavaScript function
 * is wrapped in a libffi trampoline whose generated C function pointer is
 * written at that offset during class initialization.
 */
export type RegisterClassVfunc = {
    /** Byte offset of the vfunc slot within the class struct. */
    byteOffset: number;
    /** FFI argument types matching the vfunc signature. */
    argTypes: Type[];
    /** FFI return type matching the vfunc signature. */
    returnType: Type;
    /** Implementation invoked on each vfunc call. */
    fn: (...args: Value[]) => Value;
};

/**
 * Vfunc overrides targeting one interface that the registered class inherits
 * from its parent.
 *
 * `gtype` is the GType of the inherited interface. `vfuncs` are the overrides,
 * with `byteOffset` relative to the interface struct base (not the class
 * struct). Each vfunc is wrapped in a libffi trampoline whose function pointer
 * is written into the new class's own copy of the inherited interface vtable.
 */
export type RegisterClassInterface = {
    /** GType of the inherited interface whose vfuncs are overridden. */
    gtype: number;
    /** Vfunc overrides relative to the interface struct base. */
    vfuncs: RegisterClassVfunc[];
};

export type RegisterClassOptions = {
    vfuncs?: RegisterClassVfunc[];
    interfaces?: RegisterClassInterface[];
};
