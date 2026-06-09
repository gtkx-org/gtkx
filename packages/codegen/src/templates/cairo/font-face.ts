import { getHandle, t, wrapHandle } from "@gtkx/ffi";
import type { NativeHandle } from "@gtkx/ffi/cairo";
import { FONT_FACE_T, FONT_FACE_T_NONE, INT_TYPE, LIB, STRING_BORROWED, STRING_FULL } from "@gtkx/ffi/cairo";
import type { FontSlant, FontType, FontWeight, Status } from "@gtkx/gi/cairo/cairo.js";
import { FontFace } from "@gtkx/gi/cairo/cairo.js";

const { fn } = t;
const FC_PATTERN_T = t.boxed("FcPattern", "borrowed", LIB);
const FT_FACE_T = t.boxed("FT_Face", "borrowed", LIB);

declare module "@gtkx/gi/cairo/cairo.js" {
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

const cairo_font_face_status = fn(LIB, "cairo_font_face_status", [{ type: FONT_FACE_T_NONE }], INT_TYPE);
FontFace.prototype.status = function (): Status {
    return cairo_font_face_status(getHandle(this)) as Status;
};

const cairo_font_face_get_type = fn(LIB, "cairo_font_face_get_type", [{ type: FONT_FACE_T_NONE }], INT_TYPE);
FontFace.prototype.getType = function (): FontType {
    return cairo_font_face_get_type(getHandle(this)) as FontType;
};

const cairo_font_face_get_reference_count = fn(
    LIB,
    "cairo_font_face_get_reference_count",
    [{ type: FONT_FACE_T_NONE }],
    INT_TYPE,
);
FontFace.prototype.getReferenceCount = function (): number {
    return cairo_font_face_get_reference_count(getHandle(this)) as number;
};

const cairo_toy_font_face_get_family = fn(
    LIB,
    "cairo_toy_font_face_get_family",
    [{ type: FONT_FACE_T_NONE }],
    STRING_BORROWED,
);
const cairo_toy_font_face_get_slant = fn(LIB, "cairo_toy_font_face_get_slant", [{ type: FONT_FACE_T_NONE }], INT_TYPE);
const cairo_toy_font_face_get_weight = fn(
    LIB,
    "cairo_toy_font_face_get_weight",
    [{ type: FONT_FACE_T_NONE }],
    INT_TYPE,
);
const cairo_ft_font_face_get_synthesize = fn(
    LIB,
    "cairo_ft_font_face_get_synthesize",
    [{ type: FONT_FACE_T_NONE }],
    INT_TYPE,
);
const cairo_ft_font_face_set_synthesize = fn(
    LIB,
    "cairo_ft_font_face_set_synthesize",
    [{ type: FONT_FACE_T_NONE }, { type: INT_TYPE }],
    t.void,
);
const cairo_ft_font_face_unset_synthesize = fn(
    LIB,
    "cairo_ft_font_face_unset_synthesize",
    [{ type: FONT_FACE_T_NONE }, { type: INT_TYPE }],
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

const cairo_toy_font_face_create = fn(
    LIB,
    "cairo_toy_font_face_create",
    [{ type: STRING_FULL }, { type: INT_TYPE }, { type: INT_TYPE }],
    FONT_FACE_T,
);
FontFaceWithStatics.create = (family: string, slant: FontSlant, weight: FontWeight): ToyFontFace => {
    return wrapHandle(ToyFontFace, cairo_toy_font_face_create(family, slant, weight) as NativeHandle);
};

const cairo_ft_font_face_create_for_ft_face = fn(
    LIB,
    "cairo_ft_font_face_create_for_ft_face",
    [{ type: FT_FACE_T }, { type: INT_TYPE }],
    FONT_FACE_T,
);
FontFaceWithStatics.createForFtFace = (face: NativeHandle, loadFlags: number): FtFontFace => {
    return wrapHandle(FtFontFace, cairo_ft_font_face_create_for_ft_face(face, loadFlags) as NativeHandle);
};

const cairo_ft_font_face_create_for_pattern = fn(
    LIB,
    "cairo_ft_font_face_create_for_pattern",
    [{ type: FC_PATTERN_T }],
    FONT_FACE_T,
);
FontFaceWithStatics.createForPattern = (pattern: NativeHandle): FtFontFace => {
    return wrapHandle(FtFontFace, cairo_ft_font_face_create_for_pattern(pattern) as NativeHandle);
};
