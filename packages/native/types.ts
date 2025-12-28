type IntegerType = { type: "int"; size: 8 | 16 | 32 | 64; unsigned?: boolean };

type FloatType = { type: "float"; size: 32 | 64 };

type BooleanType = { type: "boolean" };

type StringType = { type: "string"; borrowed?: boolean };

type GObjectType = { type: "gobject"; borrowed?: boolean };

type BoxedType = { type: "boxed"; borrowed?: boolean; innerType: string; lib?: string; getTypeFn?: string };

type GVariantType = { type: "gvariant"; borrowed?: boolean };

type ArrayType = { type: "array"; itemType: Type; listType?: "glist" | "gslist"; borrowed?: boolean };

type RefType = { type: "ref"; innerType: Type };

type NullType = { type: "null" };

type UndefinedType = { type: "undefined" };

type CallbackType = {
    type: "callback";
    trampoline?:
        | "closure"
        | "asyncReady"
        | "destroy"
        | "sourceFunc"
        | "drawFunc"
        | "compareDataFunc"
        | "tickFunc"
        | "shortcutFunc"
        | "treeListModelCreateFunc";
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
    | BoxedType
    | GVariantType
    | ArrayType
    | RefType
    | CallbackType
    | NullType
    | UndefinedType;

export type Arg = { type: Type; value: unknown; optional?: boolean };

export type Ref<T> = { value: T };
