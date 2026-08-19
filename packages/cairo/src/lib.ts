import { resolveType, t } from "@gtkx/runtime";

type Descriptor = Parameters<typeof t.bind>[3];
type BoundFunction = ReturnType<typeof t.bind>;
type BoxedDescriptor = ReturnType<typeof t.boxed>;

const CAIRO_LIBRARY = "libcairo.so.2";
const CAIRO_GOBJECT_LIBRARY = "libcairo-gobject.so.2";

const CONTEXT_T: BoxedDescriptor = t.boxed("CairoContext", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_context_get_type",
});

const CONTEXT_FULL_T: BoxedDescriptor = t.boxed("CairoContext", {
    ownership: "full",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_context_get_type",
});

const SURFACE_T: BoxedDescriptor = t.boxed("CairoSurface", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_surface_get_type",
});

const SURFACE_FULL_T: BoxedDescriptor = t.boxed("CairoSurface", {
    ownership: "full",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_surface_get_type",
});

const DEVICE_T: BoxedDescriptor = t.boxed("CairoDevice", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_device_get_type",
});

const PATTERN_T: BoxedDescriptor = t.boxed("CairoPattern", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_pattern_get_type",
});

const PATTERN_FULL_T: BoxedDescriptor = t.boxed("CairoPattern", {
    ownership: "full",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_pattern_get_type",
});

const REGION_T: BoxedDescriptor = t.boxed("CairoRegion", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_region_get_type",
});

const REGION_FULL_T: BoxedDescriptor = t.boxed("CairoRegion", {
    ownership: "full",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_region_get_type",
});

const FONT_OPTIONS_T: BoxedDescriptor = t.boxed("CairoFontOptions", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_font_options_get_type",
});

const FONT_FACE_T: BoxedDescriptor = t.boxed("CairoFontFace", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_font_face_get_type",
});

const SCALED_FONT_T: BoxedDescriptor = t.boxed("CairoScaledFont", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_GOBJECT_LIBRARY,
    getTypeFnName: "cairo_gobject_scaled_font_get_type",
});

const MATRIX_T: BoxedDescriptor = t.boxed("cairo_matrix_t", { ownership: "borrowed", sharedLibrary: CAIRO_LIBRARY });

const RECTANGLE_T: BoxedDescriptor = t.boxed("cairo_rectangle_t", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_LIBRARY,
});

const RECTANGLE_INT_T: BoxedDescriptor = t.boxed("cairo_rectangle_int_t", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_LIBRARY,
});

const RECTANGLE_INT_ARRAY_T: BoxedDescriptor = t.boxed("cairo_rectangle_int_t[]", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_LIBRARY,
});

const RECTANGLE_LIST_T: BoxedDescriptor = t.boxed("cairo_rectangle_list_t", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_LIBRARY,
});

const GLYPH_T: BoxedDescriptor = t.boxed("cairo_glyph_t", { ownership: "borrowed", sharedLibrary: CAIRO_LIBRARY });

const TEXT_CLUSTER_T: BoxedDescriptor = t.boxed("cairo_text_cluster_t", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_LIBRARY,
});

const TEXT_EXTENTS_T: BoxedDescriptor = t.boxed("cairo_text_extents_t", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_LIBRARY,
});

const FONT_EXTENTS_T: BoxedDescriptor = t.boxed("cairo_font_extents_t", {
    ownership: "borrowed",
    sharedLibrary: CAIRO_LIBRARY,
});

const PATH_T: BoxedDescriptor = t.boxed("cairo_path_t", {
    ownership: "full",
    sharedLibrary: CAIRO_LIBRARY,
    freeFnName: "cairo_path_destroy",
});

const DOUBLE_BUFFER_T: BoxedDescriptor = t.boxed("double[]", { ownership: "borrowed", sharedLibrary: CAIRO_LIBRARY });

const bindCairo = (symbol: string, args: Descriptor[], returns: Descriptor): BoundFunction =>
    t.bind(CAIRO_LIBRARY, symbol, args, returns);

const cairoGType = (typeSymbol: string): bigint => resolveType(CAIRO_GOBJECT_LIBRARY, typeSymbol);

export {
    bindCairo,
    type BoundFunction,
    cairoGType,
    CONTEXT_FULL_T,
    CONTEXT_T,
    DEVICE_T,
    DOUBLE_BUFFER_T,
    FONT_EXTENTS_T,
    FONT_FACE_T,
    FONT_OPTIONS_T,
    GLYPH_T,
    MATRIX_T,
    PATH_T,
    PATTERN_FULL_T,
    PATTERN_T,
    RECTANGLE_INT_ARRAY_T,
    RECTANGLE_INT_T,
    RECTANGLE_LIST_T,
    RECTANGLE_T,
    REGION_FULL_T,
    REGION_T,
    SCALED_FONT_T,
    SURFACE_FULL_T,
    SURFACE_T,
    TEXT_CLUSTER_T,
    TEXT_EXTENTS_T,
};
