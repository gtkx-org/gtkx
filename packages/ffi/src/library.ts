import { type BoxedDescriptor, boxedT, type FundamentalDescriptor, fundamentalT } from "./descriptors.js";

export const LIB = "libgobject-2.0.so.0,libglib-2.0.so.0";
export const VALUE_SIZE = 24;
export const VALUE_T: BoxedDescriptor = boxedT("GValue", { sharedLibrary: LIB, getTypeFnName: "g_value_get_type" });

export const PARAM_T: FundamentalDescriptor = fundamentalT(LIB, "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});

export const VARIANT_T: FundamentalDescriptor = fundamentalT(LIB, "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
