import { createRef, type NativeHandle } from "@gtkx/native";
import type { FontType, Status, TextClusterFlags } from "../generated/cairo/enums.js";
import { FontFace } from "../generated/cairo/font-face.js";
import type { FontOptions } from "../generated/cairo/font-options.js";
import type { Matrix } from "../generated/cairo/matrix.js";
import { ScaledFont } from "../generated/cairo/scaled-font.js";
import { alloc, call, read, t } from "../native.js";
import { getNativeObject } from "../registry.js";
import {
    allocGlyphBuffer,
    type CairoGlyph,
    type CairoTextCluster,
    CLUSTER_BUF_T,
    DOUBLE_TYPE,
    FONT_FACE_T_NONE,
    FONT_OPTIONS_T,
    type FontExtents,
    GLYPH_BUF_T,
    INT_TYPE,
    LIB,
    MATRIX_T,
    readFontExtents,
    readTextExtents,
    SCALED_FONT_T,
    SCALED_FONT_T_NONE,
    type TextExtents,
    ULONG_TYPE,
} from "./common.js";
import { FontOptions as FontOptionsConstructor } from "./font-options.js";
import { allocMatrix } from "./matrix.js";

declare module "../generated/cairo/scaled-font.js" {
    interface ScaledFont {
        status(): Status;
        extents(): FontExtents;
        textExtents(text: string): TextExtents;
        glyphExtents(glyphs: Array<{ index: number; x: number; y: number }>): TextExtents;
        getFontFace(): FontFace;
        getFontOptions(): FontOptions;
        getFontMatrix(): Matrix;
        getCtm(): Matrix;
        getScaleMatrix(): Matrix;
        getType(): FontType;
    }

    namespace ScaledFont {
        function create(fontFace: FontFace, fontMatrix: Matrix, ctm: Matrix, options: FontOptions): ScaledFont;
    }
}

type ScaledFontStatic = {
    create(fontFace: FontFace, fontMatrix: Matrix, ctm: Matrix, options: FontOptions): ScaledFont;
};

const ScaledFontWithStatics = ScaledFont as typeof ScaledFont & ScaledFontStatic;

ScaledFontWithStatics.create = (
    fontFace: FontFace,
    fontMatrix: Matrix,
    ctm: Matrix,
    options: FontOptions,
): ScaledFont => {
    const ptr = call(
        LIB,
        "cairo_scaled_font_create",
        [
            { type: FONT_FACE_T_NONE, value: fontFace.handle },
            { type: MATRIX_T, value: fontMatrix.handle },
            { type: MATRIX_T, value: ctm.handle },
            { type: FONT_OPTIONS_T, value: options.handle },
        ],
        SCALED_FONT_T,
    ) as NativeHandle;
    return getNativeObject(ptr, ScaledFont) as ScaledFont;
};

ScaledFont.prototype.status = function (): Status {
    return call(
        LIB,
        "cairo_scaled_font_status",
        [{ type: SCALED_FONT_T_NONE, value: this.handle }],
        INT_TYPE,
    ) as Status;
};

ScaledFont.prototype.extents = function (): FontExtents {
    const ext = alloc(40, "cairo_font_extents_t", LIB);
    call(
        LIB,
        "cairo_scaled_font_extents",
        [
            { type: SCALED_FONT_T_NONE, value: this.handle },
            {
                type: t.boxed("cairo_font_extents_t", "borrowed", LIB),
                value: ext,
            },
        ],
        t.void,
    );
    return readFontExtents(ext);
};

ScaledFont.prototype.textExtents = function (text: string): TextExtents {
    const ext = alloc(48, "cairo_text_extents_t", LIB);
    call(
        LIB,
        "cairo_scaled_font_text_extents",
        [
            { type: SCALED_FONT_T_NONE, value: this.handle },
            { type: t.string("full"), value: text },
            {
                type: t.boxed("cairo_text_extents_t", "borrowed", LIB),
                value: ext,
            },
        ],
        t.void,
    );
    return readTextExtents(ext);
};

ScaledFont.prototype.glyphExtents = function (glyphs: Array<{ index: number; x: number; y: number }>): TextExtents {
    const buf = allocGlyphBuffer(glyphs);
    const ext = alloc(48, "cairo_text_extents_t", LIB);
    call(
        LIB,
        "cairo_scaled_font_glyph_extents",
        [
            { type: SCALED_FONT_T_NONE, value: this.handle },
            { type: GLYPH_BUF_T, value: buf },
            { type: INT_TYPE, value: glyphs.length },
            {
                type: t.boxed("cairo_text_extents_t", "borrowed", LIB),
                value: ext,
            },
        ],
        t.void,
    );
    return readTextExtents(ext);
};

ScaledFont.prototype.getFontFace = function (): FontFace {
    const ptr = call(
        LIB,
        "cairo_scaled_font_get_font_face",
        [{ type: SCALED_FONT_T_NONE, value: this.handle }],
        FONT_FACE_T_NONE,
    ) as NativeHandle;
    return getNativeObject(ptr, FontFace) as FontFace;
};

ScaledFont.prototype.getFontOptions = function (): FontOptions {
    const options = new FontOptionsConstructor();
    call(
        LIB,
        "cairo_scaled_font_get_font_options",
        [
            { type: SCALED_FONT_T_NONE, value: this.handle },
            { type: FONT_OPTIONS_T, value: options.handle },
        ],
        t.void,
    );
    return options;
};

function readMatrixVia(self: ScaledFont, fnName: string): Matrix {
    const { handle, obj } = allocMatrix();
    call(
        LIB,
        fnName,
        [
            { type: SCALED_FONT_T_NONE, value: self.handle },
            { type: MATRIX_T, value: handle },
        ],
        t.void,
    );
    return obj;
}

ScaledFont.prototype.getFontMatrix = function (): Matrix {
    return readMatrixVia(this, "cairo_scaled_font_get_font_matrix");
};

ScaledFont.prototype.getCtm = function (): Matrix {
    return readMatrixVia(this, "cairo_scaled_font_get_ctm");
};

ScaledFont.prototype.getScaleMatrix = function (): Matrix {
    return readMatrixVia(this, "cairo_scaled_font_get_scale_matrix");
};

ScaledFont.prototype.getType = function (): FontType {
    return call(
        LIB,
        "cairo_scaled_font_get_type",
        [{ type: SCALED_FONT_T_NONE, value: this.handle }],
        INT_TYPE,
    ) as FontType;
};

declare module "../generated/cairo/scaled-font.js" {
    interface ScaledFont {
        textToGlyphs(x: number, y: number, text: string): [CairoGlyph[], CairoTextCluster[], TextClusterFlags];
        ftLockFace(): NativeHandle;
        ftUnlockFace(): void;
    }
}

ScaledFont.prototype.textToGlyphs = function (
    x: number,
    y: number,
    text: string,
): [CairoGlyph[], CairoTextCluster[], TextClusterFlags] {
    const encoder = new TextEncoder();
    const utf8 = encoder.encode(text);

    const glyphsRef = createRef<NativeHandle | null>(null);
    const numGlyphsRef = createRef(0);
    const clustersRef = createRef<NativeHandle | null>(null);
    const numClustersRef = createRef(0);
    const clusterFlagsRef = createRef(0);

    call(
        LIB,
        "cairo_scaled_font_text_to_glyphs",
        [
            { type: SCALED_FONT_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
            { type: t.string("full"), value: text },
            { type: INT_TYPE, value: utf8.length },
            { type: t.ref(GLYPH_BUF_T), value: glyphsRef },
            { type: t.ref(INT_TYPE), value: numGlyphsRef },
            { type: t.ref(CLUSTER_BUF_T), value: clustersRef },
            { type: t.ref(INT_TYPE), value: numClustersRef },
            { type: t.ref(INT_TYPE), value: clusterFlagsRef },
        ],
        INT_TYPE,
    );

    const numGlyphs = numGlyphsRef.value;
    const numClusters = numClustersRef.value;

    const glyphsBuf = glyphsRef.value;
    const clustersBuf = clustersRef.value;

    const glyphs: CairoGlyph[] = [];
    if (glyphsBuf !== null) {
        for (let i = 0; i < numGlyphs; i++) {
            const offset = i * 24;
            glyphs.push({
                index: read(glyphsBuf, ULONG_TYPE, offset) as number,
                x: read(glyphsBuf, DOUBLE_TYPE, offset + 8) as number,
                y: read(glyphsBuf, DOUBLE_TYPE, offset + 16) as number,
            });
        }
    }

    const clusters: CairoTextCluster[] = [];
    if (clustersBuf !== null) {
        for (let i = 0; i < numClusters; i++) {
            const offset = i * 8;
            clusters.push({
                numBytes: read(clustersBuf, INT_TYPE, offset) as number,
                numGlyphs: read(clustersBuf, INT_TYPE, offset + 4) as number,
            });
        }
    }

    if (glyphsRef.value !== null) {
        call(LIB, "cairo_glyph_free", [{ type: GLYPH_BUF_T, value: glyphsRef.value }], t.void);
    }
    if (clustersRef.value !== null) {
        call(LIB, "cairo_text_cluster_free", [{ type: CLUSTER_BUF_T, value: clustersRef.value }], t.void);
    }

    return [glyphs, clusters, clusterFlagsRef.value as TextClusterFlags];
};

ScaledFont.prototype.ftLockFace = function (): NativeHandle {
    return call(
        LIB,
        "cairo_ft_scaled_font_lock_face",
        [{ type: SCALED_FONT_T_NONE, value: this.handle }],
        t.boxed("FT_Face", "borrowed", LIB),
    ) as NativeHandle;
};

ScaledFont.prototype.ftUnlockFace = function (): void {
    call(LIB, "cairo_ft_scaled_font_unlock_face", [{ type: SCALED_FONT_T_NONE, value: this.handle }], t.void);
};
