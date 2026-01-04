/**
 * Opaque identifier for a native GObject.
 *
 * This branded type ensures type safety for native object references.
 */
export type ObjectId = { readonly __brand: "ObjectId" };

type IntegerType = { type: "int"; size: 8 | 16 | 32 | 64; unsigned: boolean };

type FloatType = { type: "float"; size: 32 | 64 };

type BooleanType = { type: "boolean" };

type Ownership = "full" | "none";

type StringType = { type: "string"; ownership: Ownership; length?: number };

type GObjectType = { type: "gobject"; ownership: Ownership };

type BoxedType = { type: "boxed"; ownership: Ownership; innerType: string; lib?: string; getTypeFn?: string };

type StructType = { type: "struct"; ownership: Ownership; innerType: string; size?: number };

type FundamentalType = {
    type: "fundamental";
    ownership: Ownership;
    library: string;
    refFunc: string;
    unrefFunc: string;
};

type ArrayType = {
    type: "array";
    itemType: Type;
    listType: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "sized" | "fixed";
    ownership: Ownership;
    elementSize?: number;
    lengthParamIndex?: number;
    fixedSize?: number;
};

type HashTableType = {
    type: "hashtable";
    keyType: Type;
    valueType: Type;
    listType: "ghashtable";
    ownership: Ownership;
};

type RefType = { type: "ref"; innerType: Type };

type NullType = { type: "null" };

type UndefinedType = { type: "undefined" };

type CallbackType = {
    type: "callback";
    trampoline: "closure" | "asyncReady" | "destroy" | "drawFunc" | "shortcutFunc" | "treeListModelCreateFunc";
    argTypes?: Type[];
    sourceType?: Type;
    resultType?: Type;
    returnType?: Type;
};

/**
 * Discriminated union of all FFI type descriptors.
 *
 * Describes how to marshal values between JavaScript and native code.
 */
export type Type =
    | IntegerType
    | FloatType
    | BooleanType
    | StringType
    | GObjectType
    | BoxedType
    | StructType
    | FundamentalType
    | ArrayType
    | HashTableType
    | RefType
    | CallbackType
    | NullType
    | UndefinedType;

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

/**
 * A mutable reference wrapper for out-parameters.
 *
 * @typeParam T - The type of the referenced value
 */
export type Ref<T> = {
    /** The current value */
    value: T;
};
