import { type BoxedDescriptor, boxedT } from "./descriptors.js";

export const LIB = "libgobject-2.0.so.0,libglib-2.0.so.0";
export const VALUE_SIZE = 24;
export const VALUE_T: BoxedDescriptor = boxedT("GValue", { sharedLibrary: LIB, getTypeFnName: "g_value_get_type" });
