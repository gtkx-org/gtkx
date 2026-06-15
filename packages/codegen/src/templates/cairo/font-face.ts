import { getHandle, t, wrapHandle } from "@gtkx/ffi";
import type { NativeHandle } from "@gtkx/native";
import type { FontSlant, FontType, FontWeight, Status } from "../cairo.js";
import { FontFace } from "../cairo.js";

const { bind } = t;
const FC_PATTERN_T = t.boxed("FcPattern", "borrowed", "libcairo.so.2");
const FT_FACE_T = t.boxed("FT_Face", "borrowed", "libcairo.so.2");

declare module "../cairo.js" {
    interface FontFace {
        status(): Status;
        getType(): FontType;
        getReferenceCount(): number;
    }

    namespace FontFace {
        function create(family: string, slant: FontSlant, weight: FontWeight): ToyFontFace;
        function createForFtFace(face: NativeHandle, loadFlags: number): FtFontFace;
        function createForPattern(pattern: NativeHandle): FtFontFace;
    }
}

const cairo_font_face_status = bind(
    "libcairo.so.2",
    "cairo_font_face_status",
    [{ type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") }],
    t.int32,
);
FontFace.prototype.status = function (): Status {
    return cairo_font_face_status(getHandle(this)) as Status;
};

const cairo_font_face_get_type = bind(
    "libcairo.so.2",
    "cairo_font_face_get_type",
    [{ type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") }],
    t.int32,
);
FontFace.prototype.getType = function (): FontType {
    return cairo_font_face_get_type(getHandle(this)) as FontType;
};

const cairo_font_face_get_reference_count = bind(
    "libcairo.so.2",
    "cairo_font_face_get_reference_count",
    [{ type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") }],
    t.int32,
);
FontFace.prototype.getReferenceCount = function (): number {
    return cairo_font_face_get_reference_count(getHandle(this)) as number;
};

const cairo_toy_font_face_get_family = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_get_family",
    [{ type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") }],
    t.string("borrowed"),
);
const cairo_toy_font_face_get_slant = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_get_slant",
    [{ type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") }],
    t.int32,
);
const cairo_toy_font_face_get_weight = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_get_weight",
    [{ type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") }],
    t.int32,
);
const cairo_ft_font_face_get_synthesize = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_get_synthesize",
    [{ type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") }],
    t.int32,
);
const cairo_ft_font_face_set_synthesize = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_set_synthesize",
    [
        { type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
const cairo_ft_font_face_unset_synthesize = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_unset_synthesize",
    [
        { type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") },
        { type: t.int32 },
    ],
    t.void,
);

/**
 * Toy-API font face produced by {@link FontFace.create}.
 */
export class ToyFontFace extends FontFace {
    /**
     * Returns the font family name.
     */
    getFamily(): string {
        return cairo_toy_font_face_get_family(getHandle(this)) as string;
    }

    /**
     * Returns the font slant.
     */
    getSlant(): FontSlant {
        return cairo_toy_font_face_get_slant(getHandle(this)) as FontSlant;
    }

    /**
     * Returns the font weight.
     */
    getWeight(): FontWeight {
        return cairo_toy_font_face_get_weight(getHandle(this)) as FontWeight;
    }
}

/**
 * FreeType-backed font face produced by {@link FontFace.createForFtFace} and
 * {@link FontFace.createForPattern}.
 */
export class FtFontFace extends FontFace {
    /**
     * Returns the synthesis flags applied to the font.
     */
    getSynthesize(): number {
        return cairo_ft_font_face_get_synthesize(getHandle(this)) as number;
    }

    /**
     * Enables the given synthesis flags on the font.
     */
    setSynthesize(synthFlags: number): void {
        cairo_ft_font_face_set_synthesize(getHandle(this), synthFlags);
    }

    /**
     * Disables the given synthesis flags on the font.
     */
    unsetSynthesize(synthFlags: number): void {
        cairo_ft_font_face_unset_synthesize(getHandle(this), synthFlags);
    }
}

type FontFaceStatic = {
    create(family: string, slant: FontSlant, weight: FontWeight): ToyFontFace;
    createForFtFace(face: NativeHandle, loadFlags: number): FtFontFace;
    createForPattern(pattern: NativeHandle): FtFontFace;
};

const FontFaceWithStatics = FontFace as typeof FontFace & FontFaceStatic;

const cairo_toy_font_face_create = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_create",
    [{ type: t.string("full") }, { type: t.int32 }, { type: t.int32 }],
    t.boxed("CairoFontFace", "full", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"),
);
FontFaceWithStatics.create = (family: string, slant: FontSlant, weight: FontWeight): ToyFontFace => {
    return wrapHandle(cairo_toy_font_face_create(family, slant, weight) as NativeHandle, ToyFontFace);
};

const cairo_ft_font_face_create_for_ft_face = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_create_for_ft_face",
    [{ type: FT_FACE_T }, { type: t.int32 }],
    t.boxed("CairoFontFace", "full", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"),
);
FontFaceWithStatics.createForFtFace = (face: NativeHandle, loadFlags: number): FtFontFace => {
    return wrapHandle(cairo_ft_font_face_create_for_ft_face(face, loadFlags) as NativeHandle, FtFontFace);
};

const cairo_ft_font_face_create_for_pattern = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_create_for_pattern",
    [{ type: FC_PATTERN_T }],
    t.boxed("CairoFontFace", "full", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"),
);
FontFaceWithStatics.createForPattern = (pattern: NativeHandle): FtFontFace => {
    return wrapHandle(cairo_ft_font_face_create_for_pattern(pattern) as NativeHandle, FtFontFace);
};
