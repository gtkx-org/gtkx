import { getHandle, t, wrapHandle } from "@gtkx/ffi";
import { alloc, type NativeHandle, read } from "@gtkx/native";
import type { FontOptions, FontType, Status, TextClusterFlags } from "../cairo.js";
import { FontFace, ScaledFont } from "../cairo.js";
import {
    allocGlyphBuffer,
    type CairoGlyph,
    type CairoTextCluster,
    type FontExtents,
    readFontExtents,
    readTextExtents,
    type TextExtents,
} from "./context.js";
import { FontOptions as FontOptionsConstructor } from "./font-options.js";
import { allocMatrix, type Matrix as CairoMatrix } from "./matrix.js";

const { bind } = t;
const GLYPH_BUF_REF = t.ref(t.boxed("cairo_glyph_t", "borrowed", "libcairo.so.2"));
const CLUSTER_BUF_REF = t.ref(t.boxed("cairo_text_cluster_t", "borrowed", "libcairo.so.2"));

declare module "../cairo.js" {
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

const cairo_scaled_font_create = bind(
    "libcairo.so.2",
    "cairo_scaled_font_create",
    [
        { type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
    ],
    t.boxed("CairoScaledFont", "full", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type"),
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
    return wrapHandle(ptr, ScaledFont) as ScaledFont;
};

const cairo_scaled_font_status = bind(
    "libcairo.so.2",
    "cairo_scaled_font_status",
    [{ type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") }],
    t.int32,
);
ScaledFont.prototype.status = function (): Status {
    return cairo_scaled_font_status(getHandle(this)) as Status;
};

const cairo_scaled_font_extents = bind(
    "libcairo.so.2",
    "cairo_scaled_font_extents",
    [
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
        { type: t.boxed("cairo_font_extents_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
ScaledFont.prototype.extents = function (): FontExtents {
    const ext = alloc(40, "cairo_font_extents_t");
    cairo_scaled_font_extents(getHandle(this), ext);
    return readFontExtents(ext);
};

const cairo_scaled_font_text_extents = bind(
    "libcairo.so.2",
    "cairo_scaled_font_text_extents",
    [
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
        { type: t.string("full") },
        { type: t.boxed("cairo_text_extents_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
ScaledFont.prototype.textExtents = function (text: string): TextExtents {
    const ext = alloc(48, "cairo_text_extents_t");
    cairo_scaled_font_text_extents(getHandle(this), text, ext);
    return readTextExtents(ext);
};

const cairo_scaled_font_glyph_extents = bind(
    "libcairo.so.2",
    "cairo_scaled_font_glyph_extents",
    [
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
        { type: t.boxed("cairo_glyph_t", "borrowed", "libcairo.so.2") },
        { type: t.int32 },
        { type: t.boxed("cairo_text_extents_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
ScaledFont.prototype.glyphExtents = function (glyphs: Array<{ index: number; x: number; y: number }>): TextExtents {
    const buf = allocGlyphBuffer(glyphs);
    const ext = alloc(48, "cairo_text_extents_t");
    cairo_scaled_font_glyph_extents(getHandle(this), buf, glyphs.length, ext);
    return readTextExtents(ext);
};

const cairo_scaled_font_get_font_face = bind(
    "libcairo.so.2",
    "cairo_scaled_font_get_font_face",
    [{ type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") }],
    t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"),
);
ScaledFont.prototype.getFontFace = function (): FontFace {
    return wrapHandle(cairo_scaled_font_get_font_face(getHandle(this)) as NativeHandle, FontFace) as FontFace;
};

const cairo_scaled_font_get_font_options = bind(
    "libcairo.so.2",
    "cairo_scaled_font_get_font_options",
    [
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
    ],
    t.void,
);
ScaledFont.prototype.getFontOptions = function (): FontOptions {
    const options = FontOptionsConstructor.create();
    cairo_scaled_font_get_font_options(getHandle(this), getHandle(options));
    return options;
};

const cairo_scaled_font_get_font_matrix = bind(
    "libcairo.so.2",
    "cairo_scaled_font_get_font_matrix",
    [
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
const cairo_scaled_font_get_ctm = bind(
    "libcairo.so.2",
    "cairo_scaled_font_get_ctm",
    [
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
const cairo_scaled_font_get_scale_matrix = bind(
    "libcairo.so.2",
    "cairo_scaled_font_get_scale_matrix",
    [
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
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

const cairo_scaled_font_get_type = bind(
    "libcairo.so.2",
    "cairo_scaled_font_get_type",
    [{ type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") }],
    t.int32,
);
ScaledFont.prototype.getType = function (): FontType {
    return cairo_scaled_font_get_type(getHandle(this)) as FontType;
};

const cairo_scaled_font_get_reference_count = bind(
    "libcairo.so.2",
    "cairo_scaled_font_get_reference_count",
    [{ type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") }],
    t.int32,
);
ScaledFont.prototype.getReferenceCount = function (): number {
    return cairo_scaled_font_get_reference_count(getHandle(this)) as number;
};

declare module "../cairo.js" {
    interface ScaledFont {
        textToGlyphs(x: number, y: number, text: string): [CairoGlyph[], CairoTextCluster[], TextClusterFlags];
    }
}

const cairo_scaled_font_text_to_glyphs = bind(
    "libcairo.so.2",
    "cairo_scaled_font_text_to_glyphs",
    [
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.string("full") },
        { type: t.int32 },
        { type: GLYPH_BUF_REF },
        { type: t.ref(t.int32) },
        { type: CLUSTER_BUF_REF },
        { type: t.ref(t.int32) },
        { type: t.ref(t.int32) },
    ],
    t.int32,
);
const cairo_glyph_free = bind(
    "libcairo.so.2",
    "cairo_glyph_free",
    [{ type: t.boxed("cairo_glyph_t", "borrowed", "libcairo.so.2") }],
    t.void,
);
const cairo_text_cluster_free = bind(
    "libcairo.so.2",
    "cairo_text_cluster_free",
    [{ type: t.boxed("cairo_text_cluster_t", "borrowed", "libcairo.so.2") }],
    t.void,
);

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
                index: read(glyphsBuf, t.uint64, offset) as number,
                x: read(glyphsBuf, t.float64, offset + 8) as number,
                y: read(glyphsBuf, t.float64, offset + 16) as number,
            });
        }
    }

    const clusters: CairoTextCluster[] = [];
    if (clustersBuf !== null) {
        for (let i = 0; i < numClusters; i++) {
            const offset = i * 8;
            clusters.push({
                numBytes: read(clustersBuf, t.int32, offset) as number,
                numGlyphs: read(clustersBuf, t.int32, offset + 4) as number,
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
