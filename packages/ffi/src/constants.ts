import type { BoxedType } from "@gtkx/native";
import { boxedT } from "./descriptors.js";

export const LIB = "libgobject-2.0.so.0,libglib-2.0.so.0";

export const GVALUE_SIZE = 24;

/**
 * Byte layout of a `GValue` struct as read directly from native memory.
 *
 * A `GValue` is a `GType g_type` field followed by a two-element union of
 * `data` slots. `gTypeOffset` locates the leading `g_type` field; `dataOffset`
 * locates the first data slot (used to read a stored pointer); `size` is the
 * total struct size shared with allocation.
 */
export const GVALUE_LAYOUT: { gTypeOffset: number; dataOffset: number; size: number } = {
    gTypeOffset: 0,
    dataOffset: 8,
    size: GVALUE_SIZE,
};

export const GVALUE_T: BoxedType = boxedT("GValue", { library: LIB, getTypeFn: "g_value_get_type" });
