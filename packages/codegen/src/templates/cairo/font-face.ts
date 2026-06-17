import { getHandle, t, wrapHandle } from "@gtkx/ffi";
import type { Handle } from "@gtkx/native";
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
        function createForFtFace(face: Handle, loadFlags: number): FtFontFace;
        function createForPattern(pattern: Handle): FtFontFace;
    }
}

const cairoFontFaceStatus = bind(
    "libcairo.so.2",
    "cairo_font_face_status",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type")],
    t.int32,
);
FontFace.prototype.status = function (): Status {
    return cairoFontFaceStatus(getHandle(this)) as Status;
};

const cairoFontFaceGetType = bind(
    "libcairo.so.2",
    "cairo_font_face_get_type",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type")],
    t.int32,
);
FontFace.prototype.getType = function (): FontType {
    return cairoFontFaceGetType(getHandle(this)) as FontType;
};

const cairoFontFaceGetReferenceCount = bind(
    "libcairo.so.2",
    "cairo_font_face_get_reference_count",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type")],
    t.int32,
);
FontFace.prototype.getReferenceCount = function (): number {
    return cairoFontFaceGetReferenceCount(getHandle(this)) as number;
};

const cairoToyFontFaceGetFamily = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_get_family",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type")],
    t.string("borrowed"),
);
const cairoToyFontFaceGetSlant = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_get_slant",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type")],
    t.int32,
);
const cairoToyFontFaceGetWeight = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_get_weight",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type")],
    t.int32,
);
const cairoFtFontFaceGetSynthesize = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_get_synthesize",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type")],
    t.int32,
);
const cairoFtFontFaceSetSynthesize = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_set_synthesize",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"), t.int32],
    t.void,
);
const cairoFtFontFaceUnsetSynthesize = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_unset_synthesize",
    [t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"), t.int32],
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
        return cairoToyFontFaceGetFamily(getHandle(this)) as string;
    }

    /**
     * Returns the font slant.
     */
    getSlant(): FontSlant {
        return cairoToyFontFaceGetSlant(getHandle(this)) as FontSlant;
    }

    /**
     * Returns the font weight.
     */
    getWeight(): FontWeight {
        return cairoToyFontFaceGetWeight(getHandle(this)) as FontWeight;
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
        return cairoFtFontFaceGetSynthesize(getHandle(this)) as number;
    }

    /**
     * Enables the given synthesis flags on the font.
     */
    setSynthesize(synthFlags: number): void {
        cairoFtFontFaceSetSynthesize(getHandle(this), synthFlags);
    }

    /**
     * Disables the given synthesis flags on the font.
     */
    unsetSynthesize(synthFlags: number): void {
        cairoFtFontFaceUnsetSynthesize(getHandle(this), synthFlags);
    }
}

type FontFaceStatic = {
    create(family: string, slant: FontSlant, weight: FontWeight): ToyFontFace;
    createForFtFace(face: Handle, loadFlags: number): FtFontFace;
    createForPattern(pattern: Handle): FtFontFace;
};

const FontFaceWithStatics = FontFace as typeof FontFace & FontFaceStatic;

const cairoToyFontFaceCreate = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_create",
    [t.string("full"), t.int32, t.int32],
    t.boxed("CairoFontFace", "full", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"),
);
FontFaceWithStatics.create = (family: string, slant: FontSlant, weight: FontWeight): ToyFontFace => {
    return wrapHandle(cairoToyFontFaceCreate(family, slant, weight) as Handle, ToyFontFace);
};

const cairoFtFontFaceCreateForFtFace = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_create_for_ft_face",
    [FT_FACE_T, t.int32],
    t.boxed("CairoFontFace", "full", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"),
);
FontFaceWithStatics.createForFtFace = (face: Handle, loadFlags: number): FtFontFace => {
    return wrapHandle(cairoFtFontFaceCreateForFtFace(face, loadFlags) as Handle, FtFontFace);
};

const cairoFtFontFaceCreateForPattern = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_create_for_pattern",
    [FC_PATTERN_T],
    t.boxed("CairoFontFace", "full", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"),
);
FontFaceWithStatics.createForPattern = (pattern: Handle): FtFontFace => {
    return wrapHandle(cairoFtFontFaceCreateForPattern(pattern) as Handle, FtFontFace);
};
