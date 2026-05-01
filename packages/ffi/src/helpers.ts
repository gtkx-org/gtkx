import { type Arg, call as nativeCall, type Type } from "@gtkx/native";

export { alloc, call, freeze, read, unfreeze, write } from "@gtkx/native";

/** Whether the caller takes ownership of a returned native value (`"full"`) or only borrows it (`"borrowed"`). */
export type Ownership = "full" | "borrowed";

/** Container shape for array-like FFI types. */
export type ArrayKind = "array" | "glist" | "gslist" | "gptrarray" | "garray" | "gbytearray" | "sized" | "fixed";

/** Lifetime of a callback trampoline. */
export type TrampolineScope = "call" | "notified" | "async" | "forever";

/**
 * Binds a native function symbol once and returns a callable that dispatches it.
 *
 * Captures the library, symbol, and a pre-built `Arg` array in a closure so
 * the descriptor objects are allocated once at module load. Each invocation
 * mutates only the per-arg `value` slot before dispatching, making calls
 * allocation-free on the hot path.
 *
 * Reentrancy is safe: native marshals all argument values up-front before
 * dispatching, so trampolines that re-enter the same binding during signal
 * emission cannot observe a partially-marshaled state.
 *
 * Most code should use the generated bindings in `@gtkx/ffi` instead of
 * calling this directly.
 *
 * @param library - Library name (e.g., "libgtk-4.so.1")
 * @param symbol - Function symbol name
 * @param argTypes - Argument type descriptors in positional order
 * @param returnType - Expected return type descriptor
 * @returns A function that, given argument values, dispatches the FFI call
 */
const fn = (
    library: string,
    symbol: string,
    argTypes: ReadonlyArray<{ type: Type; optional?: boolean }>,
    returnType: Type,
): ((...values: unknown[]) => unknown) => {
    const args: Arg[] = argTypes.map((argType) =>
        argType.optional
            ? { type: argType.type, value: undefined, optional: true }
            : { type: argType.type, value: undefined },
    );
    return (...values) => {
        let i = 0;
        for (const arg of args) {
            arg.value = values[i++];
        }
        return nativeCall(library, symbol, args, returnType);
    };
};

const int8: Type = Object.freeze({ type: "int8" });
const uint8: Type = Object.freeze({ type: "uint8" });
const int16: Type = Object.freeze({ type: "int16" });
const uint16: Type = Object.freeze({ type: "uint16" });
const int32: Type = Object.freeze({ type: "int32" });
const uint32: Type = Object.freeze({ type: "uint32" });
const int64: Type = Object.freeze({ type: "int64" });
const uint64: Type = Object.freeze({ type: "uint64" });
const float32: Type = Object.freeze({ type: "float32" });
const float64: Type = Object.freeze({ type: "float64" });
const booleanT: Type = Object.freeze({ type: "boolean" });
const voidT: Type = Object.freeze({ type: "void" });
const unicharT: Type = Object.freeze({ type: "unichar" });

const stringT = (ownership: Ownership = "borrowed", length?: number): Type =>
    length !== undefined ? { type: "string", ownership, length } : { type: "string", ownership };

const objectT = (ownership: Ownership = "borrowed"): Type => ({ type: "gobject", ownership });

const boxedT = (innerType: string, ownership: Ownership = "borrowed", library?: string, getTypeFn?: string): Type => {
    const result: Type = { type: "boxed", ownership, innerType };
    if (library !== undefined) result.library = library;
    if (getTypeFn !== undefined) result.getTypeFn = getTypeFn;
    return result;
};

const structT = (innerType: string, ownership: Ownership = "borrowed", size?: number): Type => {
    const result: Type = { type: "struct", ownership, innerType };
    if (size !== undefined) result.size = size;
    return result;
};

const fundamentalT = (
    library: string,
    refFn: string,
    unrefFn: string,
    ownership: Ownership = "borrowed",
    typeName?: string,
): Type => {
    const result: Type = { type: "fundamental", ownership, library, refFn, unrefFn };
    if (typeName !== undefined) result.typeName = typeName;
    return result;
};

const refT = (innerType: Type): Type => ({ type: "ref", innerType });

const hashTableT = (keyType: Type, valueType: Type, ownership: Ownership = "borrowed"): Type => ({
    type: "hashtable",
    keyType,
    valueType,
    ownership,
});

const enumT = (library: string, getTypeFn: string, signed: boolean): Type => ({
    type: "enum",
    library,
    getTypeFn,
    signed,
});

const flagsT = (library: string, getTypeFn: string, signed: boolean): Type => ({
    type: "flags",
    library,
    getTypeFn,
    signed,
});

/** Optional sizing metadata for array-like FFI descriptors. */
export type ArrayOptions = {
    /** Size of each element in bytes (used for `garray`). */
    elementSize?: number;
    /** Index of the parameter carrying the array length (used for `sized`). */
    sizeParamIndex?: number;
    /** Compile-time known length (used for `fixed`). */
    fixedSize?: number;
};

const arrayT = (
    itemType: Type,
    kind: ArrayKind = "array",
    ownership: Ownership = "borrowed",
    options?: ArrayOptions,
): Type => {
    const result: Type = { type: "array", itemType, kind, ownership };
    if (options?.elementSize !== undefined) result.elementSize = options.elementSize;
    if (options?.sizeParamIndex !== undefined) result.sizeParamIndex = options.sizeParamIndex;
    if (options?.fixedSize !== undefined) result.fixedSize = options.fixedSize;
    return result;
};

const list = (itemType: Type, ownership: Ownership = "borrowed"): Type => arrayT(itemType, "glist", ownership);

const slist = (itemType: Type, ownership: Ownership = "borrowed"): Type => arrayT(itemType, "gslist", ownership);

const ptrArray = (itemType: Type, ownership: Ownership = "borrowed"): Type => arrayT(itemType, "gptrarray", ownership);

const gArray = (itemType: Type, ownership: Ownership = "borrowed", elementSize?: number): Type =>
    arrayT(itemType, "garray", ownership, elementSize !== undefined ? { elementSize } : undefined);

const byteArray = (ownership: Ownership = "borrowed"): Type => arrayT(uint8, "gbytearray", ownership);

const sizedArray = (itemType: Type, sizeParamIndex: number, ownership: Ownership = "borrowed"): Type =>
    arrayT(itemType, "sized", ownership, { sizeParamIndex });

const fixedArray = (itemType: Type, fixedSize: number, ownership: Ownership = "borrowed"): Type =>
    arrayT(itemType, "fixed", ownership, { fixedSize });

const callbackT = (argTypes: Type[], returnType: Type): Type => ({
    type: "callback",
    kind: "closure",
    argTypes,
    returnType,
});

/** Optional configuration for a trampoline FFI descriptor. */
export type TrampolineOptions = {
    /** Whether the call has a paired destroy-notify parameter. */
    hasDestroy?: boolean;
    /** Index of the user-data parameter passed to the callback. */
    userDataIndex?: number;
    /** Lifetime of the callback. */
    scope?: TrampolineScope;
};

const trampolineT = (argTypes: Type[], returnType: Type, options?: TrampolineOptions): Type => {
    const result: Type = { type: "trampoline", argTypes, returnType };
    if (options?.hasDestroy !== undefined) result.hasDestroy = options.hasDestroy;
    if (options?.userDataIndex !== undefined) result.userDataIndex = options.userDataIndex;
    if (options?.scope !== undefined) result.scope = options.scope;
    return result;
};

/**
 * Type helpers and `fn` binding factory for FFI bindings.
 *
 * Most code should use the generated bindings in `@gtkx/ffi` instead.
 * This namespace exists to keep hand-written bindings (and generated code)
 * compact and free of inline type-descriptor object literals.
 *
 * @example
 * ```tsx
 * const gtk_button_set_label = t.fn(
 *     "libgtk-4.so.1",
 *     "gtk_button_set_label",
 *     [{ type: t.object("borrowed") }, { type: t.string("borrowed") }],
 *     t.void,
 * );
 * ```
 */
export const t = {
    fn,
    int8,
    uint8,
    int16,
    uint16,
    int32,
    uint32,
    int64,
    uint64,
    float32,
    float64,
    boolean: booleanT,
    void: voidT,
    unichar: unicharT,
    string: stringT,
    object: objectT,
    boxed: boxedT,
    struct: structT,
    fundamental: fundamentalT,
    ref: refT,
    hashTable: hashTableT,
    enum: enumT,
    flags: flagsT,
    array: arrayT,
    list,
    slist,
    ptrArray,
    gArray,
    byteArray,
    sizedArray,
    fixedArray,
    callback: callbackT,
    trampoline: trampolineT,
} as const;
