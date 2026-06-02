import { getHandle, getNativeObject, t } from "@gtkx/ffi";
import type { FontOptions, FontType, Status, TextClusterFlags } from "@gtkx/gi/cairo/cairo.js";
import { FontFace, ScaledFont } from "@gtkx/gi/cairo/cairo.js";
import { alloc, type NativeHandle, read } from "@gtkx/native";
import {
    allocGlyphBuffer,
    type CairoGlyph,
    type CairoTextCluster,
    CLUSTER_BUF_T,
    DOUBLE_TYPE,
    FONT_EXTENTS_T,
    FONT_FACE_T_NONE,
    FONT_OPTIONS_T,
    type FontExtents,
    GLYPH_BUF_T,
    INT_REF,
    INT_TYPE,
    LIB,
    MATRIX_T,
    readFontExtents,
    readTextExtents,
    SCALED_FONT_T,
    SCALED_FONT_T_NONE,
    STRING_FULL,
    TEXT_EXTENTS_T,
    type TextExtents,
    ULONG_TYPE,
} from "./common.js";
import { FontOptions as FontOptionsConstructor } from "./font-options.js";
import { allocMatrix, type Matrix as CairoMatrix } from "./matrix.js";

const { fn } = t;
const GLYPH_BUF_REF = t.ref(GLYPH_BUF_T);
const CLUSTER_BUF_REF = t.ref(CLUSTER_BUF_T);

declare module "@gtkx/gi/cairo/cairo.js" {
    interface ScaledFont {
        status(): Status;
        extents(): FontExtents;
        textExtents(text: string): TextExtents;
        glyphExtents(glyphs: Array<{ index: number; x: number; y: number }>): TextExtents;
        getFontFace(): FontFace;
        getFontOptions(): FontOptions;
        getFontMatrix(): CairoMatrix;
        getCtm(): CairoMatrix;
        getScaleMatrix(): CairoMatrix;
        getType(): FontType;
        getReferenceCount(): number;
    }

    namespace ScaledFont {
        function create(
            fontFace: FontFace,
            fontMatrix: CairoMatrix,
            ctm: CairoMatrix,
            options: FontOptions,
        ): ScaledFont;
    }
}

type ScaledFontStatic = {
    create(fontFace: FontFace, fontMatrix: CairoMatrix, ctm: CairoMatrix, options: FontOptions): ScaledFont;
};

const ScaledFontWithStatics = ScaledFont as typeof ScaledFont & ScaledFontStatic;

const cairo_scaled_font_create = fn(
    LIB,
    "cairo_scaled_font_create",
    [{ type: FONT_FACE_T_NONE }, { type: MATRIX_T }, { type: MATRIX_T }, { type: FONT_OPTIONS_T }],
    SCALED_FONT_T,
);

ScaledFontWithStatics.create = (
    fontFace: FontFace,
    fontMatrix: CairoMatrix,
    ctm: CairoMatrix,
    options: FontOptions,
): ScaledFont => {
    const ptr = cairo_scaled_font_create(
        getHandle(fontFace),
        getHandle(fontMatrix),
        getHandle(ctm),
        getHandle(options),
    ) as NativeHandle;
    return getNativeObject(ptr, ScaledFont) as ScaledFont;
};

const cairo_scaled_font_status = fn(LIB, "cairo_scaled_font_status", [{ type: SCALED_FONT_T_NONE }], INT_TYPE);
ScaledFont.prototype.status = function (): Status {
    return cairo_scaled_font_status(getHandle(this)) as Status;
};

const cairo_scaled_font_extents = fn(
    LIB,
    "cairo_scaled_font_extents",
    [{ type: SCALED_FONT_T_NONE }, { type: FONT_EXTENTS_T }],
    t.void,
);
ScaledFont.prototype.extents = function (): FontExtents {
    const ext = alloc(40, "cairo_font_extents_t", LIB);
    cairo_scaled_font_extents(getHandle(this), ext);
    return readFontExtents(ext);
};

const cairo_scaled_font_text_extents = fn(
    LIB,
    "cairo_scaled_font_text_extents",
    [{ type: SCALED_FONT_T_NONE }, { type: STRING_FULL }, { type: TEXT_EXTENTS_T }],
    t.void,
);
ScaledFont.prototype.textExtents = function (text: string): TextExtents {
    const ext = alloc(48, "cairo_text_extents_t", LIB);
    cairo_scaled_font_text_extents(getHandle(this), text, ext);
    return readTextExtents(ext);
};

const cairo_scaled_font_glyph_extents = fn(
    LIB,
    "cairo_scaled_font_glyph_extents",
    [{ type: SCALED_FONT_T_NONE }, { type: GLYPH_BUF_T }, { type: INT_TYPE }, { type: TEXT_EXTENTS_T }],
    t.void,
);
ScaledFont.prototype.glyphExtents = function (glyphs: Array<{ index: number; x: number; y: number }>): TextExtents {
    const buf = allocGlyphBuffer(glyphs);
    const ext = alloc(48, "cairo_text_extents_t", LIB);
    cairo_scaled_font_glyph_extents(getHandle(this), buf, glyphs.length, ext);
    return readTextExtents(ext);
};

const cairo_scaled_font_get_font_face = fn(
    LIB,
    "cairo_scaled_font_get_font_face",
    [{ type: SCALED_FONT_T_NONE }],
    FONT_FACE_T_NONE,
);
ScaledFont.prototype.getFontFace = function (): FontFace {
    return getNativeObject(cairo_scaled_font_get_font_face(getHandle(this)) as NativeHandle, FontFace) as FontFace;
};

const cairo_scaled_font_get_font_options = fn(
    LIB,
    "cairo_scaled_font_get_font_options",
    [{ type: SCALED_FONT_T_NONE }, { type: FONT_OPTIONS_T }],
    t.void,
);
ScaledFont.prototype.getFontOptions = function (): FontOptions {
    const options = FontOptionsConstructor.create();
    cairo_scaled_font_get_font_options(getHandle(this), getHandle(options));
    return options;
};

const cairo_scaled_font_get_font_matrix = fn(
    LIB,
    "cairo_scaled_font_get_font_matrix",
    [{ type: SCALED_FONT_T_NONE }, { type: MATRIX_T }],
    t.void,
);
const cairo_scaled_font_get_ctm = fn(
    LIB,
    "cairo_scaled_font_get_ctm",
    [{ type: SCALED_FONT_T_NONE }, { type: MATRIX_T }],
    t.void,
);
const cairo_scaled_font_get_scale_matrix = fn(
    LIB,
    "cairo_scaled_font_get_scale_matrix",
    [{ type: SCALED_FONT_T_NONE }, { type: MATRIX_T }],
    t.void,
);

function readMatrixVia(self: ScaledFont, boundFn: (...args: unknown[]) => unknown): CairoMatrix {
    const { handle, obj } = allocMatrix();
    boundFn(getHandle(self), handle);
    return obj;
}

ScaledFont.prototype.getFontMatrix = function (): CairoMatrix {
    return readMatrixVia(this, cairo_scaled_font_get_font_matrix);
};

ScaledFont.prototype.getCtm = function (): CairoMatrix {
    return readMatrixVia(this, cairo_scaled_font_get_ctm);
};

ScaledFont.prototype.getScaleMatrix = function (): CairoMatrix {
    return readMatrixVia(this, cairo_scaled_font_get_scale_matrix);
};

const cairo_scaled_font_get_type = fn(LIB, "cairo_scaled_font_get_type", [{ type: SCALED_FONT_T_NONE }], INT_TYPE);
ScaledFont.prototype.getType = function (): FontType {
    return cairo_scaled_font_get_type(getHandle(this)) as FontType;
};

const cairo_scaled_font_get_reference_count = fn(
    LIB,
    "cairo_scaled_font_get_reference_count",
    [{ type: SCALED_FONT_T_NONE }],
    INT_TYPE,
);
ScaledFont.prototype.getReferenceCount = function (): number {
    return cairo_scaled_font_get_reference_count(getHandle(this)) as number;
};

declare module "@gtkx/gi/cairo/cairo.js" {
    interface ScaledFont {
        textToGlyphs(x: number, y: number, text: string): [CairoGlyph[], CairoTextCluster[], TextClusterFlags];
    }
}

const cairo_scaled_font_text_to_glyphs = fn(
    LIB,
    "cairo_scaled_font_text_to_glyphs",
    [
        { type: SCALED_FONT_T_NONE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: STRING_FULL },
        { type: INT_TYPE },
        { type: GLYPH_BUF_REF },
        { type: INT_REF },
        { type: CLUSTER_BUF_REF },
        { type: INT_REF },
        { type: INT_REF },
    ],
    INT_TYPE,
);
const cairo_glyph_free = fn(LIB, "cairo_glyph_free", [{ type: GLYPH_BUF_T }], t.void);
const cairo_text_cluster_free = fn(LIB, "cairo_text_cluster_free", [{ type: CLUSTER_BUF_T }], t.void);

ScaledFont.prototype.textToGlyphs = function (
    x: number,
    y: number,
    text: string,
): [CairoGlyph[], CairoTextCluster[], TextClusterFlags] {
    const utf8 = new TextEncoder().encode(text);

    const glyphsRef: { value: NativeHandle | null } = { value: null };
    const numGlyphsRef = { value: 0 };
    const clustersRef: { value: NativeHandle | null } = { value: null };
    const numClustersRef = { value: 0 };
    const clusterFlagsRef = { value: 0 };

    cairo_scaled_font_text_to_glyphs(
        getHandle(this),
        x,
        y,
        text,
        utf8.length,
        glyphsRef,
        numGlyphsRef,
        clustersRef,
        numClustersRef,
        clusterFlagsRef,
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

    if (glyphsBuf !== null) {
        cairo_glyph_free(glyphsBuf);
    }
    if (clustersBuf !== null) {
        cairo_text_cluster_free(clustersBuf);
    }

    return [glyphs, clusters, clusterFlagsRef.value as TextClusterFlags];
};
