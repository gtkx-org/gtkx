import type { ArrayKind, Descriptor, Ownership } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";

/** Descriptor variant for a `gint8`. */
type Int8Descriptor = Extract<Descriptor, { kind: "int8" }>;
/** Descriptor variant for a `guint8`. */
type Uint8Descriptor = Extract<Descriptor, { kind: "uint8" }>;
/** Descriptor variant for a `gint16`. */
type Int16Descriptor = Extract<Descriptor, { kind: "int16" }>;
/** Descriptor variant for a `guint16`. */
type Uint16Descriptor = Extract<Descriptor, { kind: "uint16" }>;
/** Descriptor variant for a `gint32`. */
type Int32Descriptor = Extract<Descriptor, { kind: "int32" }>;
/** Descriptor variant for a `guint32`. */
type Uint32Descriptor = Extract<Descriptor, { kind: "uint32" }>;
/** Descriptor variant for a `gint64` marshalled as a number. */
type Int64Descriptor = Extract<Descriptor, { kind: "int64" }>;
/** Descriptor variant for a `guint64` marshalled as a number. */
type Uint64Descriptor = Extract<Descriptor, { kind: "uint64" }>;
/** Descriptor variant for a `gint64` marshalled as a bigint. */
type BigInt64Descriptor = Extract<Descriptor, { kind: "bigint64" }>;
/** Descriptor variant for a `guint64` marshalled as a bigint. */
type BigUint64Descriptor = Extract<Descriptor, { kind: "biguint64" }>;
/** Descriptor variant for a `gfloat`. */
type Float32Descriptor = Extract<Descriptor, { kind: "float32" }>;
/** Descriptor variant for a `gdouble`. */
type Float64Descriptor = Extract<Descriptor, { kind: "float64" }>;
/** Descriptor variant for an enumeration, carrying the library and `get_type` symbol its GType comes from. */
type EnumDescriptor = Extract<Descriptor, { kind: "enum" }>;
/** Descriptor variant for a flags type, carrying the library and `get_type` symbol its GType comes from. */
type FlagsDescriptor = Extract<Descriptor, { kind: "flags" }>;
/** Descriptor variant for a `gboolean`. */
type BooleanDescriptor = Extract<Descriptor, { kind: "boolean" }>;
/** Descriptor variant for a C string. */
type StringDescriptor = Extract<Descriptor, { kind: "string" }>;

/** Descriptor variant for a `GObject`, extended with the statically declared type of its value. */
type ObjectDescriptor = Extract<Descriptor, { kind: "object" }> & {
    /**
     * Returns the wrapper class of the value's declared type. Referencing the class here keeps it
     * in a tree-shaken bundle; the registry is still consulted first, so the thunk only decides
     * the wrapper when no class is registered for the value's runtime type or an ancestor below
     * the declared one.
     */
    fallbackClass?: () => AnyClass;
};

/** Descriptor variant for a `gunichar`. */
type UnicharDescriptor = Extract<Descriptor, { kind: "unichar" }>;
/** Descriptor variant for the absence of a value. */
type VoidDescriptor = Extract<Descriptor, { kind: "void" }>;
/** Descriptor variant for an opaque `gpointer`. */
type BufferDescriptor = Extract<Descriptor, { kind: "buffer" }>;

/** Descriptor variant for a `GBoxed` value, extended with the statically declared type of its value. */
type BoxedDescriptor = Extract<Descriptor, { kind: "boxed" }> & {
    /**
     * Returns the wrapper class of the value's declared type, used when no class is registered
     * for the boxed GType. Referencing the class here keeps it in a tree-shaken bundle.
     */
    fallbackClass?: () => AnyClass;
};

/** Descriptor variant for a plain C struct, extended with the class its decoded value is wrapped in. */
type StructDescriptor = Extract<Descriptor, { kind: "struct" }> & {
    /** Class a decoded value is wrapped in; without it the wrapper comes from the value's own GType. */
    wrapperClass?: AnyClass;
};

/** Descriptor variant for a ref-counted fundamental type, extended with the class its decoded value is wrapped in. */
type FundamentalDescriptor = Extract<Descriptor, { kind: "fundamental" }> & {
    /** Class a decoded value is wrapped in; without it the wrapper comes from the type named by `typeName`. */
    wrapperClass?: AnyClass;
    /**
     * Returns the wrapper class of the value's declared type, used when no class is registered
     * for the value's runtime type or an ancestor. Referencing the class here keeps it in a
     * tree-shaken bundle. Unlike `wrapperClass`, the registry is consulted first, so a value of
     * a more derived registered type keeps its own wrapper.
     */
    fallbackClass?: () => AnyClass;
};

/** Descriptor variant for an array of items in one of the supported container layouts. */
type ArrayDescriptor = Extract<Descriptor, { kind: "array" }>;
/** Descriptor variant for a `GHashTable`, marshalled as an array of key/value pairs. */
type HashTableDescriptor = Extract<Descriptor, { kind: "hashtable" }>;
/** Descriptor variant for a function pointer a JavaScript function is marshalled into. */
type CallbackDescriptor = Extract<Descriptor, { kind: "callback" }>;
/** Descriptor variant for a pointer to another descriptor's value, for an output or inout argument. */
type RefDescriptor = Extract<Descriptor, { kind: "ref" }>;

/** Descriptor for a `GType`: a `guint64` marked so it resolves to `G_TYPE_GTYPE` rather than an integer. */
type TypeDescriptor = BigUint64Descriptor & {
    /** Distinguishes a GType from a plain `guint64` when the GLib type and the GValue type are resolved. */
    type: true;
};

/** How a boxed value is stored, and where its GType and free function are resolved from. */
type BoxedOptions = {
    /** The caller owns the storage the callee fills, so a decoded value is borrowed instead of copied. */
    isCallerAllocated?: boolean;
    /** The value is embedded in the containing struct rather than reached through a pointer. */
    isInline?: boolean;
    /** Whether a decoded value is owned by the caller; defaults to `"borrowed"`. */
    ownership?: Ownership;
    /** Library `getTypeFnName` and `freeFnName` are resolved in. */
    sharedLibrary?: string;
    /** Symbol returning the boxed GType, used when the type is not already registered under its name. */
    getTypeFnName?: string;
    /** Symbol that frees the value, for a boxed type with no GType of its own. */
    freeFnName?: string;
    /** Byte size of the value, needed to copy it into an inline field. */
    size?: number;
    /** Returns the wrapper class of the declared type, used when none is registered for the GType. */
    fallbackClass?: () => AnyClass;
};

/**
 * What the bindings do with a callback's return value, how the callee takes its closure, and how
 * long that closure has to stay alive.
 */
type CallbackOptions = {
    /** The callee also takes a destroy notify, which frees the closure once it is done with it. */
    hasDestroy?: boolean;
    /** Signature of that destroy notify; defaults to `destroyNotify`, a one-argument `GDestroyNotify`. */
    destroyKind?: CallbackDescriptor["destroyKind"];
    /** The callee also takes a `user_data` pointer; without one the closure can never be freed. */
    hasUserData?: boolean;
    /** Position of `user_data` among the callback's own arguments, dropped before the closure is called. */
    userDataIndex?: number;
    /**
     * The callback's C signature ends with a `GError**`, which receives a `GError` built from
     * whatever the JavaScript function throws while the callback returns its failure value.
     */
    canThrow?: boolean;
    /** Lifetime of the closure; defaults to `notified` when `hasDestroy` is set and `call` otherwise. */
    scope?: CallbackDescriptor["scope"];
};

/** The lengths and strides a C array layout needs beyond its element type. */
type ArrayOptions = {
    /** Stride in bytes between elements stored inline in the array. */
    elementSize?: number | undefined;
    /** Position of the argument whose buffer a cursor array points into. */
    baseParamIndex?: number | undefined;
    /** Position of the argument carrying the element count, for a length-bounded array. */
    sizeParamIndex?: number | undefined;
    /** Element count of a fixed-length array. */
    fixedSize?: number | undefined;
    /** Whether the array carries raw bytes, and so decodes to a `Uint8Array` rather than to numbers. */
    isBytes?: boolean | undefined;
    /**
     * Whether the caller supplies the storage for a fixed-length out array: the runtime allocates
     * a buffer of the element stride times the fixed element count, passes its pointer, and
     * decodes the elements the callee wrote into it.
     */
    isCallerAllocated?: boolean | undefined;
    /**
     * Whether a length-bounded array also ends at a zero element, as `zero-terminated=1` alongside
     * a length declares: the encoded buffer carries one zero element past the declared length, so a
     * callee that walks to the terminator instead of trusting the count stays inside it.
     */
    isZeroTerminated?: boolean | undefined;
};

/** Where a cursor array's base buffer and total length come from. */
type CursorBounds = {
    /** Position of the argument holding the buffer the cursor points into. */
    baseParamIndex: number;
    /** Position of the argument carrying that buffer's element count. */
    sizeParamIndex: number;
};

/** How a ref-counted fundamental value is named, wrapped and stored. */
type FundamentalOptions = {
    /** Whether a decoded value is owned by the caller; defaults to `"borrowed"`. */
    ownership?: Ownership;
    /** GLib type name the wrapper class is looked up by. */
    typeName?: string;
    /** Class a decoded value is wrapped in, instead of the one registered for `typeName`. */
    wrapperClass?: AnyClass;
    /** Returns the wrapper class of the declared type, used when none is registered for the value's type. */
    fallbackClass?: () => AnyClass;
    /** The caller owns the storage the callee fills, so a decoded value is borrowed instead of acquired. */
    isCallerAllocated?: boolean;
    /** The value is embedded in the containing struct rather than reached through a pointer. */
    isInline?: boolean;
};

type FundamentalLifecycle = {
    sharedLibrary: string;
    refFnName: string;
    unrefFnName: string;
};

/** How a plain C struct is stored and wrapped. */
type StructOptions = {
    /** The caller owns the storage the callee fills, so a decoded value is borrowed instead of copied. */
    isCallerAllocated?: boolean;
    /** The value is embedded in the containing struct rather than reached through a pointer. */
    isInline?: boolean;
    /** Byte size of the struct, needed to copy it rather than borrow the pointer. */
    size?: number;
    /** Class a decoded value is wrapped in, instead of the one registered for its GType. */
    wrapperClass?: AnyClass;
    /** Library the struct's declared copy and free functions are resolved from; without it neither is used. */
    sharedLibrary?: string;
    /** Function duplicating an instance, used instead of a byte copy when the struct declares one. */
    copyFnName?: string;
    /** Function releasing an instance, used instead of `g_free` when the struct declares one. */
    freeFnName?: string;
};

/** Descriptor for a `gint8`, marshalled as a number. */
const int8T: Int8Descriptor = { kind: "int8" };
/** Descriptor for a `guint8`, marshalled as a number. */
const uint8T: Uint8Descriptor = { kind: "uint8" };
/** Descriptor for a `gint16`, marshalled as a number. */
const int16T: Int16Descriptor = { kind: "int16" };
/** Descriptor for a `guint16`, marshalled as a number. */
const uint16T: Uint16Descriptor = { kind: "uint16" };
/** Descriptor for a `gint32`, marshalled as a number. */
const int32T: Int32Descriptor = { kind: "int32" };
/** Descriptor for a `guint32`, marshalled as a number. */
const uint32T: Uint32Descriptor = { kind: "uint32" };
/** Descriptor for a `gint64`, marshalled as a number and rejected outside the 2^53 safe range. */
const int64T: Int64Descriptor = { kind: "int64" };
/** Descriptor for a `guint64`, marshalled as a number and rejected outside the 2^53 safe range. */
const uint64T: Uint64Descriptor = { kind: "uint64" };
/** Descriptor for a `gint64`, marshalled as a bigint so the full 64-bit range survives. */
const bigint64T: BigInt64Descriptor = { kind: "bigint64" };
/** Descriptor for a `guint64`, marshalled as a bigint so the full 64-bit range survives. */
const biguint64T: BigUint64Descriptor = { kind: "biguint64" };
/** Descriptor for a `GType`, marshalled as a bigint and recognized as a GType by GValue conversion. */
const gtypeT: TypeDescriptor = { kind: "biguint64", type: true };
/** Descriptor for a `gfloat`. */
const float32T: Float32Descriptor = { kind: "float32" };
/** Descriptor for a `gdouble`. */
const float64T: Float64Descriptor = { kind: "float64" };
/** Descriptor for a `gboolean`, marshalled as a JavaScript boolean. */
const booleanT: BooleanDescriptor = { kind: "boolean" };
/** Descriptor for the absence of a value, used as the return descriptor of a `void` function. */
const voidT: VoidDescriptor = { kind: "void" };
/** Descriptor for a `gunichar`, marshalled as a single-character string or a codepoint number. */
const unicharT: UnicharDescriptor = { kind: "unichar" };
/** Descriptor for an opaque `gpointer`, taken from a typed array's memory or a numeric address. */
const bufferT: BufferDescriptor = { kind: "buffer" };
const fundamentalLifecycles: Map<string, FundamentalLifecycle> = new Map();

const isGtypeDescriptor = (descriptor: Descriptor): descriptor is TypeDescriptor =>
    descriptor.kind === "biguint64" && "type" in descriptor;

/**
 * Builds a descriptor for a C string, whose optional length sizes the caller-allocated buffer
 * used when the string is passed by reference. `hasOwnedStorage` marks a record field whose record
 * owns the string in it, so that writing the field releases the string it displaces.
 */
const stringT = (
    ownership: Ownership = "borrowed",
    length?: number,
    hasOwnedStorage?: boolean,
): StringDescriptor => {
    const result: StringDescriptor = { kind: "string", ownership };

    if (length !== undefined) {
        result.length = length;
    }

    if (hasOwnedStorage === true) {
        result.hasOwnedStorage = true;
    }

    return result;
};

/**
 * Builds a descriptor for a `GObject`, wrapped in the class registered for its runtime GType.
 * `fallbackClass` names the wrapper class of the declared type, retaining it in tree-shaken
 * bundles and wrapping the value in it when nothing at least as derived is registered.
 * `typeName` is the declared type's GType name, which an encoded instance must be one of.
 */
const objectT = (
    ownership: Ownership = "borrowed",
    fallbackClass?: () => AnyClass,
    typeName?: string,
): ObjectDescriptor => {
    const result: ObjectDescriptor = { kind: "object", ownership };

    if (fallbackClass !== undefined) {
        result.fallbackClass = fallbackClass;
    }

    if (typeName !== undefined) {
        result.typeName = typeName;
    }

    return result;
};

/** Wraps a descriptor in a pointer to it, for an output or inout argument. */
const refT = (innerDescriptor: Descriptor, isInout = false): RefDescriptor =>
    isInout ? { kind: "ref", innerDescriptor, inout: true } : { kind: "ref", innerDescriptor };

/** Builds a descriptor for a `GHashTable`, marshalled as an array of key/value pairs. */
const hashTableT = (
    keyDescriptor: Descriptor,
    valueDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
): HashTableDescriptor => ({
    kind: "hashtable",
    keyDescriptor,
    valueDescriptor,
    ownership,
});

/**
 * Builds a descriptor for an enumeration, resolving its GType from the named `get_type` function.
 * For an enumeration without a registered GType, pass empty library and function names and supply
 * `members`, the values the GIR declares, which anything outside is rejected against.
 */
const enumT = (
    sharedLibrary: string,
    typeFnName: string,
    isSigned: boolean,
    members?: number[],
): EnumDescriptor => {
    const result: EnumDescriptor = {
        kind: "enum",
        sharedLibrary,
        getTypeFnName: typeFnName,
        isSigned,
    };

    if (members !== undefined) {
        result.members = members;
    }

    return result;
};

/**
 * Builds a descriptor for a flags type, resolving its GType from the named `get_type` function.
 * For flags without a registered GType, pass empty library and function names and supply `mask`,
 * the union of all valid bits, which invalid combinations are rejected against.
 */
const flagsT = (sharedLibrary: string, typeFnName: string, isSigned: boolean, mask?: number): FlagsDescriptor => {
    const result: FlagsDescriptor = {
        kind: "flags",
        sharedLibrary,
        getTypeFnName: typeFnName,
        isSigned,
    };

    if (mask !== undefined) {
        result.mask = mask;
    }

    return result;
};

const applyBoxedNames = (result: BoxedDescriptor, options: BoxedOptions): void => {
    if (options.sharedLibrary !== undefined) {
        result.sharedLibrary = options.sharedLibrary;
    }

    if (options.getTypeFnName !== undefined) {
        result.getTypeFnName = options.getTypeFnName;
    }

    if (options.freeFnName !== undefined) {
        result.freeFnName = options.freeFnName;
    }
};

const applyBoxedOptions = (result: BoxedDescriptor, options: BoxedOptions): void => {
    applyBoxedNames(result, options);

    if (options.fallbackClass !== undefined) {
        result.fallbackClass = options.fallbackClass;
    }

    if (options.isCallerAllocated) {
        result.isCallerAllocated = true;
    }

    if (options.isInline) {
        result.isInline = true;
    }

    if (options.size !== undefined) {
        result.size = options.size;
    }
};

/** Builds a descriptor for a `GBoxed` value of the named type. */
const boxedT = (typeName: string, options: BoxedOptions = {}): BoxedDescriptor => {
    const result: BoxedDescriptor = {
        kind: "boxed",
        ownership: options.ownership ?? "borrowed",
        typeName,
    };

    applyBoxedOptions(result, options);

    return result;
};

const applyStructLifecycle = (result: StructDescriptor, options: StructOptions): void => {
    if (options.sharedLibrary === undefined) {
        return;
    }

    result.sharedLibrary = options.sharedLibrary;

    if (options.copyFnName !== undefined) {
        result.copyFnName = options.copyFnName;
    }

    if (options.freeFnName !== undefined) {
        result.freeFnName = options.freeFnName;
    }
};

/** Builds a descriptor for a plain C struct. */
const structT = (ownership: Ownership = "borrowed", options: StructOptions = {}): StructDescriptor => {
    const result: StructDescriptor = { kind: "struct", ownership };

    if (options.size !== undefined) {
        result.size = options.size;
    }

    if (options.wrapperClass !== undefined) {
        result.wrapperClass = options.wrapperClass;
    }

    if (options.isCallerAllocated) {
        result.isCallerAllocated = true;
    }

    if (options.isInline) {
        result.isInline = true;
    }

    applyStructLifecycle(result, options);

    return result;
};

const recordFundamentalLifecycle = (typeName: string, lifecycle: FundamentalLifecycle): void => {
    if (!fundamentalLifecycles.has(typeName)) {
        fundamentalLifecycles.set(typeName, lifecycle);
    }
};

const fundamentalLifecycleFor = (typeName: string): FundamentalLifecycle | undefined =>
    fundamentalLifecycles.get(typeName);

const applyFundamentalClasses = (result: FundamentalDescriptor, options: FundamentalOptions): void => {
    if (options.wrapperClass !== undefined) {
        result.wrapperClass = options.wrapperClass;
    }

    if (options.fallbackClass !== undefined) {
        result.fallbackClass = options.fallbackClass;
    }
};

/** Builds a descriptor for a fundamental type whose lifetime is managed by named ref and unref functions. */
const fundamentalT = (
    sharedLibrary: string,
    refFnName: string,
    unrefFnName: string,
    options: FundamentalOptions = {},
): FundamentalDescriptor => {
    const ownership = options.ownership ?? "borrowed";
    const result: FundamentalDescriptor = { kind: "fundamental", ownership, sharedLibrary, refFnName, unrefFnName };

    if (options.typeName !== undefined) {
        result.typeName = options.typeName;
        recordFundamentalLifecycle(options.typeName, { sharedLibrary, refFnName, unrefFnName });
    }

    applyFundamentalClasses(result, options);

    if (options.isCallerAllocated) {
        result.isCallerAllocated = true;
    }

    if (options.isInline) {
        result.isInline = true;
    }

    return result;
};

const applyArrayBounds = (result: ArrayDescriptor, options: ArrayOptions): void => {
    if (options.baseParamIndex !== undefined) {
        result.baseParamIndex = options.baseParamIndex;
    }

    if (options.sizeParamIndex !== undefined) {
        result.sizeParamIndex = options.sizeParamIndex;
    }

    if (options.fixedSize !== undefined) {
        result.fixedSize = options.fixedSize;
    }
};

/** Builds a descriptor for an array of items in one of the supported container layouts. */
const arrayT = (
    itemDescriptor: Descriptor,
    arrayKind: ArrayKind = "array",
    ownership: Ownership = "borrowed",
    options?: ArrayOptions,
): ArrayDescriptor => {
    const result: ArrayDescriptor = { kind: "array", itemDescriptor, arrayKind, ownership };

    if (options === undefined) {
        return result;
    }

    applyArrayBounds(result, options);

    if (options.elementSize !== undefined) {
        result.elementSize = options.elementSize;
    }

    if (options.isBytes === true) {
        result.isBytes = true;
    }

    if (options.isCallerAllocated === true) {
        result.isCallerAllocated = true;
    }

    if (options.isZeroTerminated === true) {
        result.isZeroTerminated = true;
    }

    return result;
};

/** Builds a descriptor for a `GList` of items. */
const listT = (
    itemDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
    options: ArrayOptions = {},
): ArrayDescriptor => arrayT(itemDescriptor, "glist", ownership, options);

/** Builds a descriptor for a `GSList` of items. */
const slistT = (
    itemDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
    options: ArrayOptions = {},
): ArrayDescriptor => arrayT(itemDescriptor, "gslist", ownership, options);

/** Builds a descriptor for a `GPtrArray` of items. */
const ptrArrayT = (
    itemDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
    options: ArrayOptions = {},
): ArrayDescriptor => arrayT(itemDescriptor, "gptrarray", ownership, options);

/** Builds a descriptor for a `GArray` of items. */
const gArrayT = (
    itemDescriptor: Descriptor,
    ownership: Ownership = "borrowed",
    options: ArrayOptions = {},
): ArrayDescriptor => arrayT(itemDescriptor, "garray", ownership, options);

/** Builds a descriptor for a `GByteArray`. */
const byteArrayT = (ownership: Ownership = "borrowed"): ArrayDescriptor =>
    arrayT(uint8T, "gbytearray", ownership, { isBytes: true });

/** Builds a descriptor for a C array whose length is carried by another argument. */
const sizedArrayT = (
    itemDescriptor: Descriptor,
    sizeParamIndex: number,
    ownership: Ownership = "borrowed",
    options: ArrayOptions = {},
): ArrayDescriptor => arrayT(itemDescriptor, "sized", ownership, { ...options, sizeParamIndex });

/**
 * Builds a descriptor for an out pointer into the buffer another argument supplied, decoded as the
 * elements from where it points to the end of that buffer.
 */
const cursorArrayT = (
    itemDescriptor: Descriptor,
    bounds: CursorBounds,
    ownership: Ownership = "borrowed",
    options: ArrayOptions = {},
): ArrayDescriptor => arrayT(itemDescriptor, "cursor", ownership, { ...options, ...bounds });

/** Builds a descriptor for a C array of a fixed length. */
const fixedArrayT = (
    itemDescriptor: Descriptor,
    fixedSize: number,
    ownership: Ownership = "borrowed",
    options: ArrayOptions = {},
): ArrayDescriptor => arrayT(itemDescriptor, "fixed", ownership, { ...options, fixedSize });

const applyClosureLifetimeOptions = (result: CallbackDescriptor, options: CallbackOptions): void => {
    if (options.hasDestroy !== undefined) {
        result.hasDestroy = options.hasDestroy;
    }

    if (options.destroyKind !== undefined) {
        result.destroyKind = options.destroyKind;
    }

    if (options.scope !== undefined) {
        result.scope = options.scope;
    }
};

const applyClosureOptions = (result: CallbackDescriptor, options: CallbackOptions): void => {
    applyClosureLifetimeOptions(result, options);

    if (options.hasUserData !== undefined) {
        result.hasUserData = options.hasUserData;
    }

    if (options.userDataIndex !== undefined) {
        result.userDataIndex = options.userDataIndex;
    }

    if (options.canThrow !== undefined) {
        result.canThrow = options.canThrow;
    }
};

/** Builds a descriptor for a function pointer, marshalling a JavaScript function into a native closure. */
const callbackT = (
    argDescriptors: Descriptor[],
    returnDescriptor: Descriptor,
    options?: CallbackOptions,
): CallbackDescriptor => {
    const result: CallbackDescriptor = { kind: "callback", argDescriptors, returnDescriptor };

    if (options === undefined) {
        return result;
    }

    applyClosureOptions(result, options);

    return result;
};

export {
    int8T,
    uint8T,
    int16T,
    uint16T,
    int32T,
    uint32T,
    int64T,
    uint64T,
    bigint64T,
    biguint64T,
    gtypeT,
    isGtypeDescriptor,
    float32T,
    float64T,
    booleanT,
    voidT,
    unicharT,
    bufferT,
    stringT,
    objectT,
    refT,
    hashTableT,
    enumT,
    flagsT,
    boxedT,
    structT,
    fundamentalLifecycleFor,
    fundamentalT,
    arrayT,
    listT,
    slistT,
    ptrArrayT,
    gArrayT,
    byteArrayT,
    sizedArrayT,
    fixedArrayT,
    cursorArrayT,
    callbackT,
    type BoxedDescriptor,
    type ObjectDescriptor,
    type StructDescriptor,
    type FundamentalDescriptor,
    type ArrayDescriptor,
    type HashTableDescriptor,
    type CallbackDescriptor,
    type RefDescriptor,
};
