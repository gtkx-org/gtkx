type IntegerType = { type: "int"; size: 8 | 16 | 32 | 64; unsigned: boolean };

type FloatType = { type: "float"; size: 32 | 64 };

type BooleanType = { type: "boolean" };

type Ownership = "full" | "none";

type StringType = { type: "string"; ownership: Ownership; length?: number };

type GObjectType = { type: "gobject"; ownership: Ownership };

type GParamType = { type: "gparam"; ownership: Ownership };

type BoxedType = { type: "boxed"; ownership: Ownership; innerType: string; lib?: string; getTypeFn?: string };

type StructType = { type: "struct"; ownership: Ownership; innerType: string; size?: number };

type GVariantType = { type: "gvariant"; ownership: Ownership };

type ArrayType = { type: "array"; itemType: Type; listType: "array" | "glist" | "gslist"; ownership: Ownership };

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

export type Type =
    | IntegerType
    | FloatType
    | BooleanType
    | StringType
    | GObjectType
    | GParamType
    | BoxedType
    | StructType
    | GVariantType
    | ArrayType
    | RefType
    | CallbackType
    | NullType
    | UndefinedType;

export type Arg = { type: Type; value: unknown; optional?: boolean };

export type Ref<T> = { value: T };
