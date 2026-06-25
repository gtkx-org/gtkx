import { getHandle, t, wrapHandle } from "@gtkx/ffi";
import type { Handle } from "@gtkx/native";
import type { FontSlant, FontType, FontWeight, Status } from "../cairo.js";
import { FontFace } from "../cairo.js";

const { bind } = t;
const FONT_FACE_T = t.boxed("CairoFontFace", {
    ownership: "borrowed",
    library: "libcairo-gobject.so.2",
    getTypeFn: "cairo_gobject_font_face_get_type",
});
const FC_PATTERN_T = t.boxed("FcPattern", { ownership: "borrowed", library: "libcairo.so.2" });
const FT_FACE_T = t.boxed("FT_Face", { ownership: "borrowed", library: "libcairo.so.2" });

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

const cairoFontFaceStatus = bind("libcairo.so.2", "cairo_font_face_status", [FONT_FACE_T], t.int32);
FontFace.prototype.status = function (): Status {
    return cairoFontFaceStatus(getHandle(this)) as Status;
};

const cairoFontFaceGetType = bind("libcairo.so.2", "cairo_font_face_get_type", [FONT_FACE_T], t.int32);
FontFace.prototype.getType = function (): FontType {
    return cairoFontFaceGetType(getHandle(this)) as FontType;
};

const cairoFontFaceGetReferenceCount = bind(
    "libcairo.so.2",
    "cairo_font_face_get_reference_count",
    [FONT_FACE_T],
    t.int32,
);
FontFace.prototype.getReferenceCount = function (): number {
    return cairoFontFaceGetReferenceCount(getHandle(this)) as number;
};

const cairoToyFontFaceGetFamily = bind(
    "libcairo.so.2",
    "cairo_toy_font_face_get_family",
    [FONT_FACE_T],
    t.string("borrowed"),
);
const cairoToyFontFaceGetSlant = bind("libcairo.so.2", "cairo_toy_font_face_get_slant", [FONT_FACE_T], t.int32);
const cairoToyFontFaceGetWeight = bind("libcairo.so.2", "cairo_toy_font_face_get_weight", [FONT_FACE_T], t.int32);
const cairoFtFontFaceGetSynthesize = bind("libcairo.so.2", "cairo_ft_font_face_get_synthesize", [FONT_FACE_T], t.int32);
const cairoFtFontFaceSetSynthesize = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_set_synthesize",
    [FONT_FACE_T, t.int32],
    t.void,
);
const cairoFtFontFaceUnsetSynthesize = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_unset_synthesize",
    [FONT_FACE_T, t.int32],
    t.void,
);

export class ToyFontFace extends FontFace {
    getFamily(): string {
        return cairoToyFontFaceGetFamily(getHandle(this)) as string;
    }

    getSlant(): FontSlant {
        return cairoToyFontFaceGetSlant(getHandle(this)) as FontSlant;
    }

    getWeight(): FontWeight {
        return cairoToyFontFaceGetWeight(getHandle(this)) as FontWeight;
    }
}

export enum FtSynthesize {
    BOLD = 1,
    OBLIQUE = 2,
}

export class FtFontFace extends FontFace {
    getSynthesize(): FtSynthesize {
        return cairoFtFontFaceGetSynthesize(getHandle(this)) as FtSynthesize;
    }

    setSynthesize(synthFlags: FtSynthesize): void {
        cairoFtFontFaceSetSynthesize(getHandle(this), synthFlags);
    }

    unsetSynthesize(synthFlags: FtSynthesize): void {
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
    t.boxed("CairoFontFace", {
        ownership: "full",
        library: "libcairo-gobject.so.2",
        getTypeFn: "cairo_gobject_font_face_get_type",
    }),
);
FontFaceWithStatics.create = (family: string, slant: FontSlant, weight: FontWeight): ToyFontFace => {
    return wrapHandle(cairoToyFontFaceCreate(family, slant, weight) as Handle, ToyFontFace);
};

const cairoFtFontFaceCreateForFtFace = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_create_for_ft_face",
    [FT_FACE_T, t.int32],
    t.boxed("CairoFontFace", {
        ownership: "full",
        library: "libcairo-gobject.so.2",
        getTypeFn: "cairo_gobject_font_face_get_type",
    }),
);
FontFaceWithStatics.createForFtFace = (face: Handle, loadFlags: number): FtFontFace => {
    return wrapHandle(cairoFtFontFaceCreateForFtFace(face, loadFlags) as Handle, FtFontFace);
};

const cairoFtFontFaceCreateForPattern = bind(
    "libcairo.so.2",
    "cairo_ft_font_face_create_for_pattern",
    [FC_PATTERN_T],
    t.boxed("CairoFontFace", {
        ownership: "full",
        library: "libcairo-gobject.so.2",
        getTypeFn: "cairo_gobject_font_face_get_type",
    }),
);
FontFaceWithStatics.createForPattern = (pattern: Handle): FtFontFace => {
    return wrapHandle(cairoFtFontFaceCreateForPattern(pattern) as Handle, FtFontFace);
};
