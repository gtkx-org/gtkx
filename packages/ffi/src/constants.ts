import type { BoxedType } from "@gtkx/native";
import { boxedT } from "./descriptors.js";

/**
 * Shared-object name of libgobject, home of every `g_type_*`, `g_value_*`,
 * and `g_object_*` symbol bound across the runtime and value layer.
 */
export const LIB = "libgobject-2.0.so.0,libglib-2.0.so.0";

/** Size of a `GValue` struct in bytes — a fixed GObject ABI fact. */
export const GVALUE_SIZE = 24;

/**
 * FFI descriptor for a borrowed `GValue` pointer argument: the shape every
 * `g_value_*` and `g_object_*_property` call passes for a `GValue *` whose
 * ownership stays with the caller.
 */
export const GVALUE_T: BoxedType = boxedT("GValue", "borrowed", LIB, "g_value_get_type");
