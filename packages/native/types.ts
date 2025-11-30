/** Integer type descriptor for FFI calls. */
type IntegerType = { type: "int"; size: 8 | 32 | 64; unsigned?: boolean };

/** Floating-point type descriptor for FFI calls. */
type FloatType = { type: "float"; size: 32 | 64 };

/** Boolean type descriptor for FFI calls. */
type BooleanType = { type: "boolean" };

/** String type descriptor for FFI calls. */
type StringType = { type: "string"; borrowed?: boolean };

/** GObject pointer type descriptor for FFI calls. */
type GObjectType = { type: "gobject"; borrowed?: boolean };

/** Boxed type descriptor for FFI calls. */
type BoxedType = { type: "boxed"; borrowed?: boolean; innerType: string; lib?: string };

/** Array type descriptor for FFI calls. Supports regular arrays and GList/GSList. */
type ArrayType = { type: "array"; itemType: Type; listType?: "glist" | "gslist"; borrowed?: boolean };

/** Reference type descriptor for out/inout parameters. */
type RefType = { type: "ref"; innerType: Type };

/** Null type descriptor for FFI calls. */
type NullType = { type: "null" };

/** Undefined/void type descriptor for FFI calls. */
type UndefinedType = { type: "undefined" };

/**
 * Callback type descriptor for signal handlers and callbacks.
 * The trampoline field specifies which native trampoline function to use:
 * - "closure" or omitted: Use GClosure directly
 * - "asyncReady": Use async ready callback trampoline (GAsyncReadyCallback)
 * - "destroy": Use destroy notify trampoline (GDestroyNotify)
 * - "sourceFunc": Use source func trampoline (GSourceFunc)
 * - "drawFunc": Use draw func trampoline (GtkDrawingAreaDrawFunc)
 */
type CallbackType = {
    type: "callback";
    trampoline?: "closure" | "asyncReady" | "destroy" | "sourceFunc" | "drawFunc";
    argTypes?: Type[];
    sourceType?: Type;
    resultType?: Type;
};

/**
 * FFI type descriptor used to specify the type of arguments and return values
 * when calling native GTK functions via FFI.
 */
export type Type =
    | IntegerType
    | FloatType
    | BooleanType
    | StringType
    | GObjectType
    | BoxedType
    | ArrayType
    | RefType
    | CallbackType
    | NullType
    | UndefinedType;

/**
 * Argument descriptor for FFI calls, combining a type descriptor with a value.
 */
export type Arg = { type: Type; value: unknown };

/**
 * Reference wrapper for out/inout parameters in FFI calls.
 * The value property will be mutated by the native function.
 */
export type Ref<T> = { value: T };
