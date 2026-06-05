/**
 * GObject fundamental type constants.
 *
 * The GObject type system exposes a fixed set of fundamental `GType`
 * identifiers (`TYPE_INT`, `TYPE_STRING`, `TYPE_OBJECT`, ...). They have no
 * GIR backing, so the gtkx FFI resolves each one at runtime from
 * `g_type_from_name` and re-exports it under its `TYPE_*` name.
 */

import { typeFromName } from "../gtype.js";

/**
 * The fundamental `GType` of an uninitialized or invalid value.
 */
export const TYPE_INVALID = typeFromName("void");

/**
 * The fundamental `GType` denoting the absence of a typed value.
 */
export const TYPE_NONE = typeFromName("void");

/**
 * The fundamental `GType` from which all interface types are derived.
 */
export const TYPE_INTERFACE = typeFromName("GInterface");

/**
 * The fundamental `GType` of a signed 8-bit integer (`gchar`).
 */
export const TYPE_CHAR = typeFromName("gchar");

/**
 * The fundamental `GType` of an unsigned 8-bit integer (`guchar`).
 */
export const TYPE_UCHAR = typeFromName("guchar");

/**
 * The fundamental `GType` of a boolean value.
 */
export const TYPE_BOOLEAN = typeFromName("gboolean");

/**
 * The fundamental `GType` of a signed integer (`gint`).
 */
export const TYPE_INT = typeFromName("gint");

/**
 * The fundamental `GType` of an unsigned integer (`guint`).
 */
export const TYPE_UINT = typeFromName("guint");

/**
 * The fundamental `GType` of a signed long integer (`glong`).
 */
export const TYPE_LONG = typeFromName("glong");

/**
 * The fundamental `GType` of an unsigned long integer (`gulong`).
 */
export const TYPE_ULONG = typeFromName("gulong");

/**
 * The fundamental `GType` of a signed 64-bit integer (`gint64`).
 */
export const TYPE_INT64 = typeFromName("gint64");

/**
 * The fundamental `GType` of an unsigned 64-bit integer (`guint64`).
 */
export const TYPE_UINT64 = typeFromName("guint64");

/**
 * The fundamental `GType` from which all enumeration types are derived.
 */
export const TYPE_ENUM = typeFromName("GEnum");

/**
 * The fundamental `GType` from which all flags types are derived.
 */
export const TYPE_FLAGS = typeFromName("GFlags");

/**
 * The fundamental `GType` of a single-precision float (`gfloat`).
 */
export const TYPE_FLOAT = typeFromName("gfloat");

/**
 * The fundamental `GType` of a double-precision float (`gdouble`).
 */
export const TYPE_DOUBLE = typeFromName("gdouble");

/**
 * The fundamental `GType` of a string (`gchararray`).
 */
export const TYPE_STRING = typeFromName("gchararray");

/**
 * The fundamental `GType` of an untyped pointer (`gpointer`).
 */
export const TYPE_POINTER = typeFromName("gpointer");

/**
 * The fundamental `GType` from which all boxed types are derived.
 */
export const TYPE_BOXED = typeFromName("GBoxed");

/**
 * The fundamental `GType` from which all `GParamSpec` types are derived.
 */
export const TYPE_PARAM = typeFromName("GParam");

/**
 * The fundamental `GType` from which all `GObject` types are derived.
 */
export const TYPE_OBJECT = typeFromName("GObject");

/**
 * The fundamental `GType` representing a `GType` identifier itself.
 */
export const TYPE_GTYPE = typeFromName("GType");

/**
 * The fundamental `GType` of a `GVariant` value.
 */
export const TYPE_VARIANT = typeFromName("GVariant");

/**
 * The fundamental `GType` of a Unicode code point, mapped to `guint`.
 */
export const TYPE_UNICHAR = typeFromName("guint");
