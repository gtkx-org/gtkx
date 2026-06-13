/**
 * GObject fundamental type constants.
 *
 * The GObject type system exposes a fixed set of fundamental `GType`
 * identifiers (`TYPE_INT`, `TYPE_STRING`, `TYPE_OBJECT`, ...). They have no
 * GIR backing, so the gtkx FFI resolves each one at runtime from
 * `g_type_from_name` and re-exports it under its `TYPE_*` name.
 */

import { type GType, typeFromName } from "../gtype.js";

/**
 * The fundamental `GType` of an uninitialized or invalid value.
 */
export const TYPE_INVALID: GType = typeFromName("void");

/**
 * The fundamental `GType` denoting the absence of a typed value.
 */
export const TYPE_NONE: GType = typeFromName("void");

/**
 * The fundamental `GType` from which all interface types are derived.
 */
export const TYPE_INTERFACE: GType = typeFromName("GInterface");

/**
 * The fundamental `GType` of a signed 8-bit integer (`gchar`).
 */
export const TYPE_CHAR: GType = typeFromName("gchar");

/**
 * The fundamental `GType` of an unsigned 8-bit integer (`guchar`).
 */
export const TYPE_UCHAR: GType = typeFromName("guchar");

/**
 * The fundamental `GType` of a boolean value.
 */
export const TYPE_BOOLEAN: GType = typeFromName("gboolean");

/**
 * The fundamental `GType` of a signed integer (`gint`).
 */
export const TYPE_INT: GType = typeFromName("gint");

/**
 * The fundamental `GType` of an unsigned integer (`guint`).
 */
export const TYPE_UINT: GType = typeFromName("guint");

/**
 * The fundamental `GType` of a signed long integer (`glong`).
 */
export const TYPE_LONG: GType = typeFromName("glong");

/**
 * The fundamental `GType` of an unsigned long integer (`gulong`).
 */
export const TYPE_ULONG: GType = typeFromName("gulong");

/**
 * The fundamental `GType` of a signed 64-bit integer (`gint64`).
 */
export const TYPE_INT64: GType = typeFromName("gint64");

/**
 * The fundamental `GType` of an unsigned 64-bit integer (`guint64`).
 */
export const TYPE_UINT64: GType = typeFromName("guint64");

/**
 * The fundamental `GType` from which all enumeration types are derived.
 */
export const TYPE_ENUM: GType = typeFromName("GEnum");

/**
 * The fundamental `GType` from which all flags types are derived.
 */
export const TYPE_FLAGS: GType = typeFromName("GFlags");

/**
 * The fundamental `GType` of a single-precision float (`gfloat`).
 */
export const TYPE_FLOAT: GType = typeFromName("gfloat");

/**
 * The fundamental `GType` of a double-precision float (`gdouble`).
 */
export const TYPE_DOUBLE: GType = typeFromName("gdouble");

/**
 * The fundamental `GType` of a string (`gchararray`).
 */
export const TYPE_STRING: GType = typeFromName("gchararray");

/**
 * The fundamental `GType` of an untyped pointer (`gpointer`).
 */
export const TYPE_POINTER: GType = typeFromName("gpointer");

/**
 * The fundamental `GType` from which all boxed types are derived.
 */
export const TYPE_BOXED: GType = typeFromName("GBoxed");

/**
 * The fundamental `GType` from which all `GParamSpec` types are derived.
 */
export const TYPE_PARAM: GType = typeFromName("GParam");

/**
 * The fundamental `GType` from which all `GObject` types are derived.
 */
export const TYPE_OBJECT: GType = typeFromName("GObject");

/**
 * The fundamental `GType` representing a `GType` identifier itself.
 */
export const TYPE_GTYPE: GType = typeFromName("GType");

/**
 * The fundamental `GType` of a `GVariant` value.
 */
export const TYPE_VARIANT: GType = typeFromName("GVariant");

/**
 * The fundamental `GType` of a Unicode code point, mapped to `guint`.
 */
export const TYPE_UNICHAR: GType = typeFromName("guint");
