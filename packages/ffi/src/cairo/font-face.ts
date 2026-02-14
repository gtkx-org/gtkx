import type { NativeHandle } from "@gtkx/native";
import type { FontSlant, FontType, FontWeight, Status } from "../generated/cairo/enums.js";
import { FontFace } from "../generated/cairo/font-face.js";
import { call } from "../native.js";
import { getNativeObject } from "../registry.js";
import { FONT_FACE_T, FONT_FACE_T_NONE, INT_TYPE, LIB } from "./common.js";

declare module "../generated/cairo/font-face.js" {
    interface FontFace {
        status(): Status;
        getType(): FontType;
        toyGetFamily(): string;
        toyGetSlant(): FontSlant;
        toyGetWeight(): FontWeight;
    }

    namespace FontFace {
        function createToy(family: string, slant: FontSlant, weight: FontWeight): FontFace;
    }
}

type FontFaceStatic = {
    createToy(family: string, slant: FontSlant, weight: FontWeight): FontFace;
    createFromFcPattern(pattern: NativeHandle): FontFace;
    createFromFtFace(ftFace: NativeHandle, loadFlags: number): FontFace;
};

const FontFaceWithStatics = FontFace as typeof FontFace & FontFaceStatic;

FontFaceWithStatics.createToy = (family: string, slant: FontSlant, weight: FontWeight): FontFace => {
    const ptr = call(
        LIB,
        "cairo_toy_font_face_create",
        [
            { type: { type: "string", ownership: "full" }, value: family },
            { type: INT_TYPE, value: slant },
            { type: INT_TYPE, value: weight },
        ],
        FONT_FACE_T,
    ) as NativeHandle;
    return getNativeObject(ptr, FontFace) as FontFace;
};

FontFace.prototype.status = function (): Status {
    return call(LIB, "cairo_font_face_status", [{ type: FONT_FACE_T_NONE, value: this.handle }], INT_TYPE) as Status;
};

FontFace.prototype.getType = function (): FontType {
    return call(
        LIB,
        "cairo_font_face_get_type",
        [{ type: FONT_FACE_T_NONE, value: this.handle }],
        INT_TYPE,
    ) as FontType;
};

FontFace.prototype.toyGetFamily = function (): string {
    return call(LIB, "cairo_toy_font_face_get_family", [{ type: FONT_FACE_T_NONE, value: this.handle }], {
        type: "string",
        ownership: "borrowed",
    }) as string;
};

FontFace.prototype.toyGetSlant = function (): FontSlant {
    return call(
        LIB,
        "cairo_toy_font_face_get_slant",
        [{ type: FONT_FACE_T_NONE, value: this.handle }],
        INT_TYPE,
    ) as FontSlant;
};

FontFace.prototype.toyGetWeight = function (): FontWeight {
    return call(
        LIB,
        "cairo_toy_font_face_get_weight",
        [{ type: FONT_FACE_T_NONE, value: this.handle }],
        INT_TYPE,
    ) as FontWeight;
};

declare module "../generated/cairo/font-face.js" {
    interface FontFace {
        ftGetSynthesize(): number;
        ftSetSynthesize(flags: number): void;
        ftUnsetSynthesize(flags: number): void;
    }

    namespace FontFace {
        function createFromFcPattern(pattern: NativeHandle): FontFace;
        function createFromFtFace(ftFace: NativeHandle, loadFlags: number): FontFace;
    }
}

FontFaceWithStatics.createFromFcPattern = (pattern: NativeHandle): FontFace => {
    const ptr = call(
        LIB,
        "cairo_ft_font_face_create_for_pattern",
        [{ type: { type: "boxed", innerType: "FcPattern", library: LIB, ownership: "borrowed" }, value: pattern }],
        FONT_FACE_T,
    ) as NativeHandle;
    return getNativeObject(ptr, FontFace) as FontFace;
};

FontFaceWithStatics.createFromFtFace = (ftFace: NativeHandle, loadFlags: number): FontFace => {
    const ptr = call(
        LIB,
        "cairo_ft_font_face_create_for_ft_face",
        [
            { type: { type: "boxed", innerType: "FT_Face", library: LIB, ownership: "borrowed" }, value: ftFace },
            { type: INT_TYPE, value: loadFlags },
        ],
        FONT_FACE_T,
    ) as NativeHandle;
    return getNativeObject(ptr, FontFace) as FontFace;
};

FontFace.prototype.ftGetSynthesize = function (): number {
    return call(
        LIB,
        "cairo_ft_font_face_get_synthesize",
        [{ type: FONT_FACE_T_NONE, value: this.handle }],
        INT_TYPE,
    ) as number;
};

FontFace.prototype.ftSetSynthesize = function (flags: number): void {
    call(
        LIB,
        "cairo_ft_font_face_set_synthesize",
        [
            { type: FONT_FACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: flags },
        ],
        { type: "undefined" },
    );
};

FontFace.prototype.ftUnsetSynthesize = function (flags: number): void {
    call(
        LIB,
        "cairo_ft_font_face_unset_synthesize",
        [
            { type: FONT_FACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: flags },
        ],
        { type: "undefined" },
    );
};
