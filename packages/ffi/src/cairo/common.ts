import { PathDataType } from "../generated/cairo/enums.js";
import { alloc, call, read, readPointer, write } from "../native.js";

export const LIB = "libcairo.so.2";
const LIB_GOBJECT = "libcairo-gobject.so.2";

export const FONT_OPTIONS_T = {
    type: "boxed",
    innerType: "CairoFontOptions",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_font_options_get_type",
    ownership: "borrowed",
} as const;

export const FONT_OPTIONS_T_FULL = {
    type: "boxed",
    innerType: "CairoFontOptions",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_font_options_get_type",
    ownership: "full",
} as const;

export const CAIRO_T = {
    type: "boxed",
    innerType: "CairoContext",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_context_get_type",
    ownership: "borrowed",
} as const;

export const PATTERN_T = {
    type: "boxed",
    innerType: "CairoPattern",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_pattern_get_type",
    ownership: "full",
} as const;

export const PATTERN_T_NONE = {
    type: "boxed",
    innerType: "CairoPattern",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_pattern_get_type",
    ownership: "borrowed",
} as const;

export const SURFACE_T = {
    type: "boxed",
    innerType: "CairoSurface",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_surface_get_type",
    ownership: "full",
} as const;

export const SURFACE_T_NONE = {
    type: "boxed",
    innerType: "CairoSurface",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_surface_get_type",
    ownership: "borrowed",
} as const;

export const DOUBLE_TYPE = { type: "float", size: 64 } as const;
export const INT_TYPE = { type: "int", size: 32, unsigned: false } as const;
export const ULONG_TYPE = { type: "int", size: 64, unsigned: true } as const;

export const FONT_FACE_T = {
    type: "boxed",
    innerType: "CairoFontFace",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_font_face_get_type",
    ownership: "full",
} as const;

export const FONT_FACE_T_NONE = {
    type: "boxed",
    innerType: "CairoFontFace",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_font_face_get_type",
    ownership: "borrowed",
} as const;

export const SCALED_FONT_T = {
    type: "boxed",
    innerType: "CairoScaledFont",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_scaled_font_get_type",
    ownership: "full",
} as const;

export const SCALED_FONT_T_NONE = {
    type: "boxed",
    innerType: "CairoScaledFont",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_scaled_font_get_type",
    ownership: "borrowed",
} as const;

export const DEVICE_T = {
    type: "boxed",
    innerType: "CairoDevice",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_device_get_type",
    ownership: "borrowed",
} as const;

export const DEVICE_T_FULL = {
    type: "boxed",
    innerType: "CairoDevice",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_device_get_type",
    ownership: "full",
} as const;

export const REGION_T = {
    type: "boxed",
    innerType: "CairoRegion",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_region_get_type",
    ownership: "full",
} as const;

export const REGION_T_NONE = {
    type: "boxed",
    innerType: "CairoRegion",
    library: LIB_GOBJECT,
    getTypeFn: "cairo_gobject_region_get_type",
    ownership: "borrowed",
} as const;

export const RECT_INT_T = {
    type: "boxed",
    innerType: "cairo_rectangle_int_t",
    library: LIB,
    ownership: "borrowed",
} as const;

export const PATH_STRUCT_T = {
    type: "boxed",
    innerType: "cairo_path_t",
    library: LIB,
    ownership: "borrowed",
} as const;

export const GLYPH_BUF_T = {
    type: "boxed",
    innerType: "cairo_glyph_t",
    library: LIB,
    ownership: "borrowed",
} as const;

export const RECT_LIST_T = {
    type: "boxed",
    innerType: "cairo_rectangle_list_t",
    library: LIB,
    ownership: "borrowed",
} as const;

export const MATRIX_T = {
    type: "boxed",
    innerType: "cairo_matrix_t",
    library: LIB,
    ownership: "borrowed",
} as const;

export const CLUSTER_BUF_T = {
    type: "boxed",
    innerType: "cairo_text_cluster_t",
    library: LIB,
    ownership: "borrowed",
} as const;

export const allocGlyphBuffer = (glyphs: Array<{ index: number; x: number; y: number }>): unknown => {
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

export const allocClusterBuffer = (clusters: Array<{ numBytes: number; numGlyphs: number }>): unknown => {
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

export const readTextExtents = (handle: unknown): TextExtents => ({
    xBearing: read(handle, DOUBLE_TYPE, 0) as number,
    yBearing: read(handle, DOUBLE_TYPE, 8) as number,
    width: read(handle, DOUBLE_TYPE, 16) as number,
    height: read(handle, DOUBLE_TYPE, 24) as number,
    xAdvance: read(handle, DOUBLE_TYPE, 32) as number,
    yAdvance: read(handle, DOUBLE_TYPE, 40) as number,
});

export const readFontExtents = (handle: unknown): FontExtents => ({
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
 */
export const parsePath = (pathHandle: unknown): PathData[] => {
    const numData = read(pathHandle, INT_TYPE, 16) as number;
    const result: PathData[] = [];
    let i = 0;
    while (i < numData) {
        const element = readPointer(pathHandle, 8, i * 16);
        const headerType = read(element, INT_TYPE, 0) as number;
        const length = read(element, INT_TYPE, 4) as number;
        switch (headerType) {
            case PathDataType.MOVE_TO: {
                const pt = readPointer(pathHandle, 8, (i + 1) * 16);
                result.push({
                    type: "moveTo",
                    x: read(pt, DOUBLE_TYPE, 0) as number,
                    y: read(pt, DOUBLE_TYPE, 8) as number,
                });
                break;
            }
            case PathDataType.LINE_TO: {
                const pt = readPointer(pathHandle, 8, (i + 1) * 16);
                result.push({
                    type: "lineTo",
                    x: read(pt, DOUBLE_TYPE, 0) as number,
                    y: read(pt, DOUBLE_TYPE, 8) as number,
                });
                break;
            }
            case PathDataType.CURVE_TO: {
                const pt1 = readPointer(pathHandle, 8, (i + 1) * 16);
                const pt2 = readPointer(pathHandle, 8, (i + 2) * 16);
                const pt3 = readPointer(pathHandle, 8, (i + 3) * 16);
                result.push({
                    type: "curveTo",
                    x1: read(pt1, DOUBLE_TYPE, 0) as number,
                    y1: read(pt1, DOUBLE_TYPE, 8) as number,
                    x2: read(pt2, DOUBLE_TYPE, 0) as number,
                    y2: read(pt2, DOUBLE_TYPE, 8) as number,
                    x3: read(pt3, DOUBLE_TYPE, 0) as number,
                    y3: read(pt3, DOUBLE_TYPE, 8) as number,
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
    call(LIB, "cairo_path_destroy", [{ type: PATH_STRUCT_T, value: pathHandle }], { type: "undefined" });
    return result;
};
