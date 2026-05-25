import type { NativeHandle } from "@gtkx/native";
import { PathDataType } from "../generated/cairo/cairo.js";
import { alloc, read, t, write } from "../native.js";

export const LIB = "libcairo.so.2";
const LIB_GOBJECT = "libcairo-gobject.so.2";

const cairoBoxed = (innerType: string, ownership: "borrowed" | "full" = "borrowed", getTypeFn?: string) =>
    t.boxed(innerType, ownership, LIB_GOBJECT, getTypeFn);

export const FONT_OPTIONS_T = cairoBoxed("CairoFontOptions", "borrowed", "cairo_gobject_font_options_get_type");
export const FONT_OPTIONS_T_FULL = cairoBoxed("CairoFontOptions", "full", "cairo_gobject_font_options_get_type");
export const CAIRO_T = cairoBoxed("CairoContext", "borrowed", "cairo_gobject_context_get_type");
export const PATTERN_T = cairoBoxed("CairoPattern", "full", "cairo_gobject_pattern_get_type");
export const PATTERN_T_NONE = cairoBoxed("CairoPattern", "borrowed", "cairo_gobject_pattern_get_type");
export const SURFACE_T = cairoBoxed("CairoSurface", "full", "cairo_gobject_surface_get_type");
export const SURFACE_T_NONE = cairoBoxed("CairoSurface", "borrowed", "cairo_gobject_surface_get_type");
export const FONT_FACE_T = cairoBoxed("CairoFontFace", "full", "cairo_gobject_font_face_get_type");
export const FONT_FACE_T_NONE = cairoBoxed("CairoFontFace", "borrowed", "cairo_gobject_font_face_get_type");
export const SCALED_FONT_T = cairoBoxed("CairoScaledFont", "full", "cairo_gobject_scaled_font_get_type");
export const SCALED_FONT_T_NONE = cairoBoxed("CairoScaledFont", "borrowed", "cairo_gobject_scaled_font_get_type");
export const REGION_T = cairoBoxed("CairoRegion", "full", "cairo_gobject_region_get_type");
export const REGION_T_NONE = cairoBoxed("CairoRegion", "borrowed", "cairo_gobject_region_get_type");

export const DOUBLE_TYPE = t.float64;
export const INT_TYPE = t.int32;
export const ULONG_TYPE = t.uint64;

export const DOUBLE_REF = t.ref(DOUBLE_TYPE);
export const INT_REF = t.ref(INT_TYPE);
export const STRING_FULL = t.string("full");
export const STRING_BORROWED = t.string("borrowed");

export const RECT_INT_T = t.boxed("cairo_rectangle_int_t", "borrowed", LIB);
export const PATH_STRUCT_T = t.boxed("cairo_path_t", "full", LIB, undefined, "cairo_path_destroy");
export const GLYPH_BUF_T = t.boxed("cairo_glyph_t", "borrowed", LIB);
export const RECT_LIST_T = t.boxed("cairo_rectangle_list_t", "borrowed", LIB);
export const MATRIX_T = t.boxed("cairo_matrix_t", "borrowed", LIB);
export const CLUSTER_BUF_T = t.boxed("cairo_text_cluster_t", "borrowed", LIB);
export const TEXT_EXTENTS_T = t.boxed("cairo_text_extents_t", "borrowed", LIB);
export const FONT_EXTENTS_T = t.boxed("cairo_font_extents_t", "borrowed", LIB);

export const allocGlyphBuffer = (glyphs: Array<{ index: number; x: number; y: number }>): NativeHandle => {
    const buf = alloc(glyphs.length * 24, "cairo_glyph_t[]", LIB);
    let offset = 0;
    for (const glyph of glyphs) {
        write(buf, ULONG_TYPE, offset, glyph.index);
        write(buf, DOUBLE_TYPE, offset + 8, glyph.x);
        write(buf, DOUBLE_TYPE, offset + 16, glyph.y);
        offset += 24;
    }
    return buf;
};

export const allocClusterBuffer = (clusters: Array<{ numBytes: number; numGlyphs: number }>): NativeHandle => {
    const buf = alloc(clusters.length * 8, "cairo_text_cluster_t[]", LIB);
    let offset = 0;
    for (const cluster of clusters) {
        write(buf, INT_TYPE, offset, cluster.numBytes);
        write(buf, INT_TYPE, offset + 4, cluster.numGlyphs);
        offset += 8;
    }
    return buf;
};

export type CairoGlyph = { index: number; x: number; y: number };
export type CairoTextCluster = { numBytes: number; numGlyphs: number };

export type TextExtents = {
    xBearing: number;
    yBearing: number;
    width: number;
    height: number;
    xAdvance: number;
    yAdvance: number;
};

export type FontExtents = {
    ascent: number;
    descent: number;
    height: number;
    maxXAdvance: number;
    maxYAdvance: number;
};

export const readTextExtents = (handle: NativeHandle): TextExtents => ({
    xBearing: read(handle, DOUBLE_TYPE, 0) as number,
    yBearing: read(handle, DOUBLE_TYPE, 8) as number,
    width: read(handle, DOUBLE_TYPE, 16) as number,
    height: read(handle, DOUBLE_TYPE, 24) as number,
    xAdvance: read(handle, DOUBLE_TYPE, 32) as number,
    yAdvance: read(handle, DOUBLE_TYPE, 40) as number,
});

export const readFontExtents = (handle: NativeHandle): FontExtents => ({
    ascent: read(handle, DOUBLE_TYPE, 0) as number,
    descent: read(handle, DOUBLE_TYPE, 8) as number,
    height: read(handle, DOUBLE_TYPE, 16) as number,
    maxXAdvance: read(handle, DOUBLE_TYPE, 24) as number,
    maxYAdvance: read(handle, DOUBLE_TYPE, 32) as number,
});

export type PathData =
    | { type: "moveTo"; x: number; y: number }
    | { type: "lineTo"; x: number; y: number }
    | { type: "curveTo"; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
    | { type: "closePath" };

/**
 * Parses `cairo_path_t` struct layout:
 *   offset  0: cairo_status_t status (int32)
 *   offset  8: cairo_path_data_t *data (pointer)
 *   offset 16: int num_data (int32)
 *
 * Each `cairo_path_data_t` is a 16-byte union:
 *   Header variant:
 *     offset 0: cairo_path_data_type_t type (int32)
 *     offset 4: int length (int32, number of data elements including header)
 *   Point variant:
 *     offset 0: double x
 *     offset 8: double y
 *
 * The path wrapper carries its own `cairo_path_destroy` finalizer (declared
 * on {@link PATH_STRUCT_T}), so the GC releases it once `pathHandle` is no
 * longer reachable. The inner data-array read borrows cairo's own buffer
 * for the duration of the parse and is never freed independently.
 */
export const parsePath = (pathHandle: NativeHandle): PathData[] => {
    const numData = read(pathHandle, INT_TYPE, 16) as number;
    if (numData === 0) return [];

    const dataArray = read(pathHandle, t.struct("cairo_path_data_t", "borrowed", numData * 16), 8) as NativeHandle;
    const result: PathData[] = [];
    let i = 0;
    while (i < numData) {
        const base = i * 16;
        const headerType = read(dataArray, INT_TYPE, base) as number;
        const length = read(dataArray, INT_TYPE, base + 4) as number;
        switch (headerType) {
            case PathDataType.MOVE_TO: {
                const ptBase = (i + 1) * 16;
                result.push({
                    type: "moveTo",
                    x: read(dataArray, DOUBLE_TYPE, ptBase) as number,
                    y: read(dataArray, DOUBLE_TYPE, ptBase + 8) as number,
                });
                break;
            }
            case PathDataType.LINE_TO: {
                const ptBase = (i + 1) * 16;
                result.push({
                    type: "lineTo",
                    x: read(dataArray, DOUBLE_TYPE, ptBase) as number,
                    y: read(dataArray, DOUBLE_TYPE, ptBase + 8) as number,
                });
                break;
            }
            case PathDataType.CURVE_TO: {
                const pt1 = (i + 1) * 16;
                const pt2 = (i + 2) * 16;
                const pt3 = (i + 3) * 16;
                result.push({
                    type: "curveTo",
                    x1: read(dataArray, DOUBLE_TYPE, pt1) as number,
                    y1: read(dataArray, DOUBLE_TYPE, pt1 + 8) as number,
                    x2: read(dataArray, DOUBLE_TYPE, pt2) as number,
                    y2: read(dataArray, DOUBLE_TYPE, pt2 + 8) as number,
                    x3: read(dataArray, DOUBLE_TYPE, pt3) as number,
                    y3: read(dataArray, DOUBLE_TYPE, pt3 + 8) as number,
                });
                break;
            }
            case PathDataType.CLOSE_PATH: {
                result.push({ type: "closePath" });
                break;
            }
        }
        i += length;
    }
    return result;
};
