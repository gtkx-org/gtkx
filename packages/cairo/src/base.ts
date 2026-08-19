import { registerWrapperClass, resolveType } from "@gtkx/runtime";

const CAIRO_GOBJECT_LIBRARY = "libcairo-gobject.so.2";
const DEVICE_TYPE = resolveType(CAIRO_GOBJECT_LIBRARY, "cairo_gobject_device_get_type");
const FONT_OPTIONS_TYPE = resolveType(CAIRO_GOBJECT_LIBRARY, "cairo_gobject_font_options_get_type");
const FONT_FACE_TYPE = resolveType(CAIRO_GOBJECT_LIBRARY, "cairo_gobject_font_face_get_type");
const SCALED_FONT_TYPE = resolveType(CAIRO_GOBJECT_LIBRARY, "cairo_gobject_scaled_font_get_type");

/** A cairo device (`cairo_device_t`), the backend-specific object behind a surface. */
class Device {
    static {
        registerWrapperClass(this, DEVICE_TYPE);
    }

    /** GType of `CairoDevice`, the boxed type this class is registered under. */
    declare __type__: bigint;
}

/** Cairo font options (`cairo_font_options_t`), the rendering settings applied to text. */
class FontOptions {
    static {
        registerWrapperClass(this, FONT_OPTIONS_TYPE);
    }

    /** GType of `CairoFontOptions`, the boxed type this class is registered under. */
    declare __type__: bigint;
}

/** A cairo font face (`cairo_font_face_t`), a typeface independent of size and transformation. */
class FontFace {
    static {
        registerWrapperClass(this, FONT_FACE_TYPE);
    }

    /** GType of `CairoFontFace`, the boxed type this class is registered under. */
    declare __type__: bigint;
}

/** A cairo scaled font (`cairo_scaled_font_t`), a font face at a given size and transformation. */
class ScaledFont {
    static {
        registerWrapperClass(this, SCALED_FONT_TYPE);
    }

    /** GType of `CairoScaledFont`, the boxed type this class is registered under. */
    declare __type__: bigint;
}

export { Device, FontFace, FontOptions, ScaledFont };
