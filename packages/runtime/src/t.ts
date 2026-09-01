import { bind } from "./bind.js";
import * as helpers from "./descriptors.js";
import { field, fieldAt } from "./field.js";
import { fn } from "./fn.js";

/** The descriptor factories and function binders exposed as {@link t}. */
type T = {
    /** Binds a symbol in a shared library to a callable that marshals its arguments and return value. */
    bind: typeof bind;
    /** Descriptor for a `gint8`, marshalled as a number. */
    int8: typeof helpers.int8T;
    /** Descriptor for a `guint8`, marshalled as a number. */
    uint8: typeof helpers.uint8T;
    /** Descriptor for a `gint16`, marshalled as a number. */
    int16: typeof helpers.int16T;
    /** Descriptor for a `guint16`, marshalled as a number. */
    uint16: typeof helpers.uint16T;
    /** Descriptor for a `gint32`, marshalled as a number. */
    int32: typeof helpers.int32T;
    /** Descriptor for a `guint32`, marshalled as a number. */
    uint32: typeof helpers.uint32T;
    /** Descriptor for a `gint64`, marshalled as a number and rejected outside the 2^53 safe range. */
    int64: typeof helpers.int64T;
    /** Descriptor for a `guint64`, marshalled as a number and rejected outside the 2^53 safe range. */
    uint64: typeof helpers.uint64T;
    /** Descriptor for a `gint64`, marshalled as a bigint so the full 64-bit range survives. */
    bigint64: typeof helpers.bigint64T;
    /** Descriptor for a `guint64`, marshalled as a bigint so the full 64-bit range survives. */
    biguint64: typeof helpers.biguint64T;
    /** Descriptor for a `GType`, marshalled as a bigint and recognized as a GType by GValue conversion. */
    gtype: typeof helpers.gtypeT;
    /** Descriptor for a `gfloat`. */
    float32: typeof helpers.float32T;
    /** Descriptor for a `gdouble`. */
    float64: typeof helpers.float64T;
    /** Descriptor for a `gboolean`, marshalled as a JavaScript boolean. */
    boolean: typeof helpers.booleanT;
    /** Descriptor for the absence of a value, used as the return descriptor of a `void` function. */
    void: typeof helpers.voidT;
    /** Descriptor for a `gunichar`, marshalled as a single-character string or a codepoint number. */
    unichar: typeof helpers.unicharT;
    /** Descriptor for an opaque `gpointer` argument, taken from a typed array's memory or a numeric address. */
    buffer: typeof helpers.bufferT;
    /** Builds a C-string descriptor with optional caller-allocated length. */
    string: typeof helpers.stringT;
    /** Builds a descriptor for a `GObject`, wrapped in the class registered for its runtime GType. */
    object: typeof helpers.objectT;
    /** Builds a descriptor for a `GBoxed` value of the named type. */
    boxed: typeof helpers.boxedT;
    /** Builds a descriptor for a plain C struct. */
    struct: typeof helpers.structT;
    /** Builds a descriptor for a fundamental type whose lifetime is managed by named ref and unref functions. */
    fundamental: typeof helpers.fundamentalT;
    /** Wraps a descriptor in a pointer to it, for an output or inout argument. */
    ref: typeof helpers.refT;
    /** Builds a descriptor for a `GHashTable`, marshalled as an array of key/value pairs. */
    hashTable: typeof helpers.hashTableT;
    /** Builds a descriptor for an enumeration, resolving its GType from the named `get_type` function. */
    enum: typeof helpers.enumT;
    /** Builds a descriptor for a flags type, resolving its GType from the named `get_type` function. */
    flags: typeof helpers.flagsT;
    /** Builds a descriptor for an array of items in one of the supported container layouts. */
    array: typeof helpers.arrayT;
    /** Builds a descriptor for a `GList` of items. */
    list: typeof helpers.listT;
    /** Builds a descriptor for a `GSList` of items. */
    slist: typeof helpers.slistT;
    /** Builds a descriptor for a `GPtrArray` of items. */
    ptrArray: typeof helpers.ptrArrayT;
    /** Builds a descriptor for a `GArray` of items. */
    gArray: typeof helpers.gArrayT;
    /** Builds a descriptor for a `GByteArray`. */
    byteArray: typeof helpers.byteArrayT;
    /** Builds a descriptor for a C array whose length is carried by another argument. */
    sizedArray: typeof helpers.sizedArrayT;
    /** Builds a descriptor for a C array of a fixed length. */
    fixedArray: typeof helpers.fixedArrayT;
    /** Builds a descriptor for an out pointer into the buffer another argument supplied. */
    cursorArray: typeof helpers.cursorArrayT;
    /** Builds a descriptor for a function pointer, marshalling a JavaScript function into a native closure. */
    callback: typeof helpers.callbackT;
    /** Binds a native function with argument directions, errors, and packed outputs. */
    fn: typeof fn;
    /** Binds a struct field at a fixed offset. */
    field: typeof field;
    /** Binds a struct field whose offset is supplied per access. */
    fieldAt: typeof fieldAt;
};

/** FFI descriptor factories and native function binders. */
const t: T = {
    bind,
    int8: helpers.int8T,
    uint8: helpers.uint8T,
    int16: helpers.int16T,
    uint16: helpers.uint16T,
    int32: helpers.int32T,
    uint32: helpers.uint32T,
    int64: helpers.int64T,
    uint64: helpers.uint64T,
    bigint64: helpers.bigint64T,
    biguint64: helpers.biguint64T,
    gtype: helpers.gtypeT,
    float32: helpers.float32T,
    float64: helpers.float64T,
    boolean: helpers.booleanT,
    void: helpers.voidT,
    unichar: helpers.unicharT,
    buffer: helpers.bufferT,
    string: helpers.stringT,
    object: helpers.objectT,
    boxed: helpers.boxedT,
    struct: helpers.structT,
    fundamental: helpers.fundamentalT,
    ref: helpers.refT,
    hashTable: helpers.hashTableT,
    enum: helpers.enumT,
    flags: helpers.flagsT,
    array: helpers.arrayT,
    list: helpers.listT,
    slist: helpers.slistT,
    ptrArray: helpers.ptrArrayT,
    gArray: helpers.gArrayT,
    byteArray: helpers.byteArrayT,
    sizedArray: helpers.sizedArrayT,
    fixedArray: helpers.fixedArrayT,
    cursorArray: helpers.cursorArrayT,
    callback: helpers.callbackT,
    fn,
    field,
    fieldAt,
};

export { t };
