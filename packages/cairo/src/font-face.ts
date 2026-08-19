import {
    type ExternalObject,
    getHandle,
    type Handle,
    registerWrapperClass,
    registerWrapperClassResolver,
    t,
    wrapHandle,
    type WrapperClassResolver,
} from "@gtkx/runtime";
import { type FontSlant, FontType, type FontWeight, type Status } from "./enums.js";
import { bindCairo, cairoGType, FC_PATTERN_T, FONT_FACE_FULL_T, FONT_FACE_T, FT_FACE_T } from "./lib.js";

/** One of the `FtSynthesize` styles a FreeType font face synthesizes. */
type FtSynthesize = (typeof FtSynthesize)[keyof typeof FtSynthesize];

const FONT_FACE_TYPE = cairoGType("cairo_gobject_font_face_get_type");
const cairoFontFaceStatus = bindCairo("cairo_font_face_status", [FONT_FACE_T], t.int32);
const cairoFontFaceGetType = bindCairo("cairo_font_face_get_type", [FONT_FACE_T], t.int32);
const cairoFontFaceGetReferenceCount = bindCairo("cairo_font_face_get_reference_count", [FONT_FACE_T], t.int32);
const cairoToyFontFaceGetSlant = bindCairo("cairo_toy_font_face_get_slant", [FONT_FACE_T], t.int32);
const cairoToyFontFaceGetWeight = bindCairo("cairo_toy_font_face_get_weight", [FONT_FACE_T], t.int32);
const cairoFtFontFaceGetSynthesize = bindCairo("cairo_ft_font_face_get_synthesize", [FONT_FACE_T], t.int32);
const cairoFtFontFaceSetSynthesize = bindCairo("cairo_ft_font_face_set_synthesize", [FONT_FACE_T, t.int32], t.void);
const cairoToyFontFaceGetFamily = bindCairo("cairo_toy_font_face_get_family", [FONT_FACE_T], t.string("borrowed"));

const cairoFtFontFaceCreateForPattern = bindCairo(
    "cairo_ft_font_face_create_for_pattern",
    [FC_PATTERN_T],
    FONT_FACE_FULL_T,
);

const cairoToyFontFaceCreate = bindCairo(
    "cairo_toy_font_face_create",
    [t.string("full"), t.int32, t.int32],
    FONT_FACE_FULL_T,
);

const cairoFtFontFaceCreateForFtFace = bindCairo(
    "cairo_ft_font_face_create_for_ft_face",
    [FT_FACE_T, t.int32],
    FONT_FACE_FULL_T,
);

const cairoFtFontFaceUnsetSynthesize = bindCairo(
    "cairo_ft_font_face_unset_synthesize",
    [FONT_FACE_T, t.int32],
    t.void,
);

/**
 * Styles a FreeType font face synthesizes when the font itself lacks them.
 * @enum
 */
const FtSynthesize = {
    /** Embolden the glyphs. */
    BOLD: 1,
    /** Slant the glyphs. */
    OBLIQUE: 2,
} as const;

const fontFaceClassFor: WrapperClassResolver = (handle) => {
    const type = cairoFontFaceGetType(handle) as FontType;

    if (type === FontType.TOY) {
        return ToyFontFace;
    }

    if (type === FontType.FT) {
        return FtFontFace;
    }

    return FontFace;
};

/**
 * A cairo font face (`cairo_font_face_t`): a typeface independent of size and transformation. Font faces come
 * from the `create*` statics or from a context, and wrap as the concrete class their type reports
 * (`instanceof ToyFontFace` after `selectFontFace`).
 */
abstract class FontFace {
    static {
        registerWrapperClass(this, FONT_FACE_TYPE);
        registerWrapperClassResolver(this, fontFaceClassFor);
    }

    /** Creates a toy font face from a family name, slant and weight. */
    static create(family: string, slant: FontSlant, weight: FontWeight): ToyFontFace {
        return wrapHandle(cairoToyFontFaceCreate(family, slant, weight) as ExternalObject<Handle>, ToyFontFace);
    }

    /** Creates a font face for a FreeType `FT_Face` handle, with the given `FT_LOAD_*` flags. */
    static createForFtFace(face: ExternalObject<Handle>, loadFlags: number): FtFontFace {
        return wrapHandle(cairoFtFontFaceCreateForFtFace(face, loadFlags) as ExternalObject<Handle>, FtFontFace);
    }

    /** Creates a font face for a fontconfig `FcPattern` handle. */
    static createForPattern(pattern: ExternalObject<Handle>): FtFontFace {
        return wrapHandle(cairoFtFontFaceCreateForPattern(pattern) as ExternalObject<Handle>, FtFontFace);
    }

    /** GType of `CairoFontFace`, the boxed type this class is registered under. */
    declare __type__: bigint;

    /** Returns the error status of the font face, `Status.SUCCESS` when it is usable. */
    status(): Status {
        return cairoFontFaceStatus(getHandle(this)) as Status;
    }

    /** Returns the backend the font face belongs to. */
    getType(): FontType {
        return cairoFontFaceGetType(getHandle(this)) as FontType;
    }

    /** Returns the reference count of the font face. */
    getReferenceCount(): number {
        return cairoFontFaceGetReferenceCount(getHandle(this)) as number;
    }
}

/** A toy font face, created with `FontFace.create` or a context's `selectFontFace`. */
class ToyFontFace extends FontFace {
    /** Returns the family name the font face was created with. */
    getFamily(): string {
        return cairoToyFontFaceGetFamily(getHandle(this)) as string;
    }

    /** Returns the slant the font face was created with. */
    getSlant(): FontSlant {
        return cairoToyFontFaceGetSlant(getHandle(this)) as FontSlant;
    }

    /** Returns the weight the font face was created with. */
    getWeight(): FontWeight {
        return cairoToyFontFaceGetWeight(getHandle(this)) as FontWeight;
    }
}

/** A FreeType font face, created with `FontFace.createForFtFace` or `FontFace.createForPattern`. */
class FtFontFace extends FontFace {
    /** Returns the styles currently synthesized for the font face. */
    getSynthesize(): FtSynthesize {
        return cairoFtFontFaceGetSynthesize(getHandle(this)) as FtSynthesize;
    }

    /** Enables synthesizing of the given styles. */
    setSynthesize(synthFlags: FtSynthesize): void {
        cairoFtFontFaceSetSynthesize(getHandle(this), synthFlags);
    }

    /** Disables synthesizing of the given styles. */
    unsetSynthesize(synthFlags: FtSynthesize): void {
        cairoFtFontFaceUnsetSynthesize(getHandle(this), synthFlags);
    }
}

export { FontFace, FtFontFace, FtSynthesize, ToyFontFace };
