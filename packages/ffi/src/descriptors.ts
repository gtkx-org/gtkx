import {
    type Arg,
    type ArrayType,
    type BigInt64Type,
    type BigUint64Type,
    type BlobType,
    type BooleanType,
    type BoxedType,
    call,
    type EnumType,
    type FlagsType,
    type Float32Type,
    type Float64Type,
    type FundamentalType,
    type HashTableType,
    type Int8Type,
    type Int16Type,
    type Int32Type,
    type Int64Type,
    type Ownership,
    type RefType,
    type StructType,
    type CallbackType,
    type Type,
    type Uint8Type,
    type Uint16Type,
    type Uint32Type,
    type Uint64Type,
    type UnicharType,
    type Value,
    type VoidType,
} from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

const wrapperClassByDescriptor = new WeakMap<Type, AnyClass>();

/**
 * Pairs `descriptor` with the wrapper class `wrapValue` lifts its value into.
 * Called by the descriptor factories (`t.struct`, `t.fundamental`) when a
 * binding supplies a fallback class for an identity-less value type.
 *
 * @param descriptor - The FFI type descriptor the class is paired with.
 * @param wrapperClass - The generated wrapper class to lift the value into.
 */
export const setDescriptorWrapperClass = (descriptor: Type, wrapperClass: AnyClass): void => {
    wrapperClassByDescriptor.set(descriptor, wrapperClass);
};

/**
 * Returns the wrapper class paired with `descriptor`, or `undefined` when the
 * descriptor's value type recovers its class from its own runtime `GType`.
 *
 * @param descriptor - The FFI type descriptor to resolve.
 */
export const getDescriptorWrapperClass = (descriptor: Type): AnyClass | undefined =>
    wrapperClassByDescriptor.get(descriptor);

/**
 * Binds a native function symbol once and returns a callable that dispatches it,
 * returning the raw marshaled result with no wrapping.
 *
 * Exposed as `t.bind`. GObject bindings use the sugared `t.fn` (which adds
 * out-parameter tupling, `GError` handling, and result wrapping); low-level
 * non-GObject bindings and the runtime's own type-system and `GValue`
 * marshalling use `t.bind` for the unwrapped native result.
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
 * @param library - Library name (e.g., "libgtk-4.so.1")
 * @param symbol - Function symbol name
 * @param argTypes - Argument type descriptors in positional order
 * @param returnType - Expected return type descriptor
 * @returns A function that, given argument values, dispatches the FFI call
 */
export const bind = (
    library: string,
    symbol: string,
    argTypes: Type[],
    returnType: Type,
): ((...values: Value[]) => Value) => {
    const args: Arg[] = argTypes.map((argType) => ({ type: argType, value: undefined }));
    return (...values) => {
        let i = 0;
        for (const arg of args) {
            arg.value = values[i++] as Value;
        }
        return call(library, symbol, args, returnType);
    };
};

export const int8T: Int8Type = Object.freeze({ type: "int8" });
export const uint8T: Uint8Type = Object.freeze({ type: "uint8" });
export const int16T: Int16Type = Object.freeze({ type: "int16" });
export const uint16T: Uint16Type = Object.freeze({ type: "uint16" });
export const int32T: Int32Type = Object.freeze({ type: "int32" });
export const uint32T: Uint32Type = Object.freeze({ type: "uint32" });
export const int64T: Int64Type = Object.freeze({ type: "int64" });
export const uint64T: Uint64Type = Object.freeze({ type: "uint64" });
export const bigint64T: BigInt64Type = Object.freeze({ type: "bigint64" });
export const biguint64T: BigUint64Type = Object.freeze({ type: "biguint64" });
export const float32T: Float32Type = Object.freeze({ type: "float32" });
export const float64T: Float64Type = Object.freeze({ type: "float64" });
export const booleanT: BooleanType = Object.freeze({ type: "boolean" });
export const voidT: VoidType = Object.freeze({ type: "void" });
export const unicharT: UnicharType = Object.freeze({ type: "unichar" });
export const blobT: BlobType = Object.freeze({ type: "blob" });

export const stringT = (ownership: Ownership = "borrowed", length?: number): Type =>
    length === undefined ? { type: "string", ownership } : { type: "string", ownership, length };

export const objectT = (ownership: Ownership = "borrowed", typeName?: string): Type =>
    typeName === undefined ? { type: "gobject", ownership } : { type: "gobject", ownership, typeName };

/**
 * Optional flags a boxed descriptor carries beyond its positional core, for the
 * less-common configuration a vtable slot needs.
 */
type BoxedOptions = {
    /**
     * A caller-allocated out parameter: the native trampoline reads the
     * argument as a borrowed view of the caller's buffer (no copy) so a vfunc
     * handler's field writes land on it in place.
     */
    callerAllocated?: boolean;
};

/** Optional configuration for {@link structT}. */
type StructOptions = BoxedOptions & {
    /** Struct size in bytes, for copying a borrowed value into an owned one. */
    size?: number;
    /**
     * Wrapper class for a plain struct, whose pointer carries no runtime type
     * to recover a class from.
     */
    wrapperClass?: AnyClass;
};

// biome-ignore lint/complexity/useMaxParams: positional descriptor mirrors the native BoxedType fields and is the format generated bindings emit
export const boxedT = (
    innerType: string,
    ownership: Ownership = "borrowed",
    library?: string,
    getTypeFn?: string,
    freeFn?: string,
    options: BoxedOptions = {},
): BoxedType => {
    const result: BoxedType = { type: "boxed", ownership, innerType };
    if (library !== undefined) result.library = library;
    if (getTypeFn !== undefined) result.getTypeFn = getTypeFn;
    if (freeFn !== undefined) result.freeFn = freeFn;
    if (options.callerAllocated) result.callerAllocated = true;
    return result;
};

export const structT = (ownership: Ownership = "borrowed", options: StructOptions = {}): StructType => {
    const result: StructType = { type: "struct", ownership };
    if (options.size !== undefined) result.size = options.size;
    if (options.wrapperClass !== undefined) setDescriptorWrapperClass(result, options.wrapperClass);
    if (options.callerAllocated) result.callerAllocated = true;
    return result;
};

/** Optional configuration for {@link t.fundamental}. */
type FundamentalOptions = {
    /** Owned (`"full"`) or borrowed (`"borrowed"`) value. */
    ownership?: Ownership;
    /** Fundamental GType name (e.g., `"GBytes"`). */
    typeName?: string;
    /**
     * Wrapper class for a `GType`-less fundamental, whose pointer carries no
     * runtime type to recover a class from. Omitted when {@link typeName}
     * resolves the class through the GLib type system instead.
     */
    wrapperClass?: AnyClass;
};

export const fundamentalT = (
    library: string,
    refFn: string,
    unrefFn: string,
    options: FundamentalOptions = {},
): FundamentalType => {
    const ownership = options.ownership ?? "borrowed";
    const result: FundamentalType = { type: "fundamental", ownership, library, refFn, unrefFn };
    if (options.typeName !== undefined) result.typeName = options.typeName;
    if (options.wrapperClass !== undefined) setDescriptorWrapperClass(result, options.wrapperClass);
    return result;
};

export const refT = (innerType: Type, inout = false): RefType =>
    inout ? { type: "ref", innerType, inout: true } : { type: "ref", innerType };

export const hashTableT = (keyType: Type, valueType: Type, ownership: Ownership = "borrowed"): HashTableType => ({
    type: "hashtable",
    keyType,
    valueType,
    ownership,
});

export const enumT = (library: string, getTypeFn: string, signed: boolean): EnumType => ({
    type: "enum",
    library,
    getTypeFn,
    signed,
});

export const flagsT = (library: string, getTypeFn: string, signed: boolean): FlagsType => ({
    type: "flags",
    library,
    getTypeFn,
    signed,
});

/** Optional sizing metadata for array-like FFI descriptors. */
type ArrayOptions = {
    /** Size of each element in bytes (used for `garray`). */
    elementSize?: number;
    /** Index of the parameter carrying the array length (used for `sized`). */
    sizeParamIndex?: number;
    /** Compile-time known length (used for `fixed`). */
    fixedSize?: number;
};

export const arrayT = (
    itemType: Type,
    kind: ArrayType["kind"] = "array",
    ownership: Ownership = "borrowed",
    options?: ArrayOptions,
): ArrayType => {
    const result: ArrayType = { type: "array", itemType, kind, ownership };
    if (options?.elementSize !== undefined) result.elementSize = options.elementSize;
    if (options?.sizeParamIndex !== undefined) result.sizeParamIndex = options.sizeParamIndex;
    if (options?.fixedSize !== undefined) result.fixedSize = options.fixedSize;
    return result;
};

export const listT = (itemType: Type, ownership: Ownership = "borrowed"): ArrayType =>
    arrayT(itemType, "glist", ownership);

export const slistT = (itemType: Type, ownership: Ownership = "borrowed"): ArrayType =>
    arrayT(itemType, "gslist", ownership);

export const ptrArrayT = (itemType: Type, ownership: Ownership = "borrowed"): ArrayType =>
    arrayT(itemType, "gptrarray", ownership);

export const garrayT = (itemType: Type, ownership: Ownership = "borrowed", elementSize?: number): ArrayType =>
    arrayT(itemType, "garray", ownership, elementSize === undefined ? undefined : { elementSize });

export const byteArrayT = (ownership: Ownership = "borrowed"): ArrayType => arrayT(uint8T, "gbytearray", ownership);

export const sizedArrayT = (
    itemType: Type,
    sizeParamIndex: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayType => arrayT(itemType, "sized", ownership, { sizeParamIndex, elementSize });

export const fixedArrayT = (
    itemType: Type,
    fixedSize: number,
    ownership: Ownership = "borrowed",
    elementSize?: number,
): ArrayType => arrayT(itemType, "fixed", ownership, { fixedSize, elementSize });

/** Optional configuration for a callback FFI descriptor. */
type CallbackOptions = {
    /** Whether the call has a paired destroy-notify parameter. */
    hasDestroy?: boolean;
    /** Index of the user-data parameter passed to the callback. */
    userDataIndex?: number;
    /** Lifetime of the callback. */
    scope?: CallbackType["scope"];
};

export const callbackT = (argTypes: Type[], returnType: Type, options?: CallbackOptions): CallbackType => {
    const result: CallbackType = { type: "callback", argTypes, returnType };
    if (options?.hasDestroy !== undefined) result.hasDestroy = options.hasDestroy;
    if (options?.userDataIndex !== undefined) result.userDataIndex = options.userDataIndex;
    if (options?.scope !== undefined) result.scope = options.scope;
    return result;
};
