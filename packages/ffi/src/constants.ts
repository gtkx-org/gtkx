import type { BoxedType } from "@gtkx/native";
import { boxedT } from "./descriptors.js";

export const LIB = "libgobject-2.0.so.0,libglib-2.0.so.0";

export const GVALUE_SIZE = 24;

export const GVALUE_LAYOUT: { gTypeOffset: number; dataOffset: number; size: number } = {
    gTypeOffset: 0,
    dataOffset: 8,
    size: GVALUE_SIZE,
};

export const GVALUE_T: BoxedType = boxedT("GValue", { library: LIB, getTypeFn: "g_value_get_type" });
