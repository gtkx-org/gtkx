/**
 * Non-introspectable cairo helpers shared by the hand-written cairo override
 * templates the codegen pipeline embeds into the generated `@gtkx/gi/cairo`
 * namespace.
 *
 * cairo's GIR exposes its types as opaque records, so every callable surface
 * is hand-written. This module owns the parts that need no generated class:
 * the boxed FFI type descriptors for cairo's GObject-integration types, the
 * glyph/cluster buffer allocators, the struct readers for extents, the
 * `cairo_path_t` parser, and the version queries. It also re-exports the
 * `@gtkx/native` primitives the templates build on, so template code imports
 * only `@gtkx/ffi/cairo` and generated modules.
 */
import { alloc, type Type as FfiType, type NativeHandle, read, write } from "@gtkx/native";
import { t } from "./helpers.js";

export type { NativeHandle, Type as FfiType } from "@gtkx/native";
export { alloc, call, read, write } from "@gtkx/native";

/** Shared library cairo's own symbols resolve from. */
export const LIB = "libcairo.so.2";
const LIB_GOBJECT = "libcairo-gobject.so.2";

const cairoBoxed = (innerType: string, ownership: "borrowed" | "full" = "borrowed", getTypeFn?: string) =>
    t.boxed(innerType, ownership, LIB_GOBJECT, getTypeFn);

/** Borrowed `cairo_font_options_t` boxed descriptor. */
export const FONT_OPTIONS_T: FfiType = cairoBoxed(
    "CairoFontOptions",
    "borrowed",
    "cairo_gobject_font_options_get_type",
);
/** Owned `cairo_font_options_t` boxed descriptor. */
export const FONT_OPTIONS_T_FULL: FfiType = cairoBoxed(
    "CairoFontOptions",
    "full",
    "cairo_gobject_font_options_get_type",
);
/** Borrowed `cairo_t` boxed descriptor. */
export const CAIRO_T: FfiType = cairoBoxed("CairoContext", "borrowed", "cairo_gobject_context_get_type");
/** Owned `cairo_pattern_t` boxed descriptor. */
export const PATTERN_T: FfiType = cairoBoxed("CairoPattern", "full", "cairo_gobject_pattern_get_type");
/** Borrowed `cairo_pattern_t` boxed descriptor. */
export const PATTERN_T_NONE: FfiType = cairoBoxed("CairoPattern", "borrowed", "cairo_gobject_pattern_get_type");
/** Owned `cairo_surface_t` boxed descriptor. */
export const SURFACE_T: FfiType = cairoBoxed("CairoSurface", "full", "cairo_gobject_surface_get_type");
/** Borrowed `cairo_surface_t` boxed descriptor. */
export const SURFACE_T_NONE: FfiType = cairoBoxed("CairoSurface", "borrowed", "cairo_gobject_surface_get_type");
/** Owned `cairo_font_face_t` boxed descriptor. */
export const FONT_FACE_T: FfiType = cairoBoxed("CairoFontFace", "full", "cairo_gobject_font_face_get_type");
/** Borrowed `cairo_font_face_t` boxed descriptor. */
export const FONT_FACE_T_NONE: FfiType = cairoBoxed("CairoFontFace", "borrowed", "cairo_gobject_font_face_get_type");
/** Owned `cairo_scaled_font_t` boxed descriptor. */
export const SCALED_FONT_T: FfiType = cairoBoxed("CairoScaledFont", "full", "cairo_gobject_scaled_font_get_type");
/** Borrowed `cairo_scaled_font_t` boxed descriptor. */
export const SCALED_FONT_T_NONE: FfiType = cairoBoxed(
    "CairoScaledFont",
    "borrowed",
    "cairo_gobject_scaled_font_get_type",
);
/** Owned `cairo_region_t` boxed descriptor. */
export const REGION_T: FfiType = cairoBoxed("CairoRegion", "full", "cairo_gobject_region_get_type");
/** Borrowed `cairo_region_t` boxed descriptor. */
export const REGION_T_NONE: FfiType = cairoBoxed("CairoRegion", "borrowed", "cairo_gobject_region_get_type");

/** `double` FFI type. */
export const DOUBLE_TYPE: FfiType = t.float64;
/** `int` FFI type. */
export const INT_TYPE: FfiType = t.int32;
/** `unsigned long` FFI type. */
export const ULONG_TYPE: FfiType = t.uint64;

/** Out-parameter `double*` FFI type. */
export const DOUBLE_REF: FfiType = t.ref(DOUBLE_TYPE);
/** Out-parameter `int*` FFI type. */
export const INT_REF: FfiType = t.ref(INT_TYPE);
/** Owned C string FFI type. */
export const STRING_FULL: FfiType = t.string("full");
/** Borrowed C string FFI type. */
export const STRING_BORROWED: FfiType = t.string("borrowed");

/** Borrowed `cairo_rectangle_int_t` boxed descriptor. */
export const RECT_INT_T: FfiType = t.boxed("cairo_rectangle_int_t", "borrowed", LIB);
/** Owned `cairo_path_t` boxed descriptor carrying its `cairo_path_destroy` finalizer. */
export const PATH_STRUCT_T: FfiType = t.boxed("cairo_path_t", "full", LIB, undefined, "cairo_path_destroy");
/** Borrowed `cairo_glyph_t` buffer boxed descriptor. */
export const GLYPH_BUF_T: FfiType = t.boxed("cairo_glyph_t", "borrowed", LIB);
/** Borrowed `cairo_rectangle_list_t` boxed descriptor. */
export const RECT_LIST_T: FfiType = t.boxed("cairo_rectangle_list_t", "borrowed", LIB);
/** Borrowed `cairo_matrix_t` boxed descriptor. */
export const MATRIX_T: FfiType = t.boxed("cairo_matrix_t", "borrowed", LIB);
/** Borrowed `cairo_text_cluster_t` buffer boxed descriptor. */
export const CLUSTER_BUF_T: FfiType = t.boxed("cairo_text_cluster_t", "borrowed", LIB);
/** Borrowed `cairo_text_extents_t` boxed descriptor. */
export const TEXT_EXTENTS_T: FfiType = t.boxed("cairo_text_extents_t", "borrowed", LIB);
/** Borrowed `cairo_font_extents_t` boxed descriptor. */
export const FONT_EXTENTS_T: FfiType = t.boxed("cairo_font_extents_t", "borrowed", LIB);

/** One glyph in a `cairo_glyph_t` buffer. */
export type CairoGlyph = { index: number; x: number; y: number };
/** One cluster in a `cairo_text_cluster_t` buffer. */
export type CairoTextCluster = { numBytes: number; numGlyphs: number };

/**
 * Packs glyphs into a freshly allocated `cairo_glyph_t[]` buffer.
 *
 * @param glyphs - The glyphs to pack.
 * @returns The allocated buffer handle.
 */
export const allocGlyphBuffer = (glyphs: CairoGlyph[]): NativeHandle => {
    const buf = alloc(glyphs.length * 24, "cairo_glyph_t[]");
    let offset = 0;
    for (const glyph of glyphs) {
        write(buf, ULONG_TYPE, offset, glyph.index);
        write(buf, DOUBLE_TYPE, offset + 8, glyph.x);
        write(buf, DOUBLE_TYPE, offset + 16, glyph.y);
        offset += 24;
    }
    return buf;
};

/**
 * Packs clusters into a freshly allocated `cairo_text_cluster_t[]` buffer.
 *
 * @param clusters - The clusters to pack.
 * @returns The allocated buffer handle.
 */
export const allocClusterBuffer = (clusters: CairoTextCluster[]): NativeHandle => {
    const buf = alloc(clusters.length * 8, "cairo_text_cluster_t[]");
    let offset = 0;
    for (const cluster of clusters) {
        write(buf, INT_TYPE, offset, cluster.numBytes);
        write(buf, INT_TYPE, offset + 4, cluster.numGlyphs);
        offset += 8;
    }
    return buf;
};

/** Text extents read from a `cairo_text_extents_t` struct. */
export type TextExtents = {
    xBearing: number;
    yBearing: number;
    width: number;
    height: number;
    xAdvance: number;
    yAdvance: number;
};

/** Font extents read from a `cairo_font_extents_t` struct. */
export type FontExtents = {
    ascent: number;
    descent: number;
    height: number;
    maxXAdvance: number;
    maxYAdvance: number;
};

/**
 * Reads a `cairo_text_extents_t` struct.
 *
 * @param handle - The struct handle.
 * @returns The extents fields.
 */
export const readTextExtents = (handle: NativeHandle): TextExtents => ({
    xBearing: read(handle, DOUBLE_TYPE, 0) as number,
    yBearing: read(handle, DOUBLE_TYPE, 8) as number,
    width: read(handle, DOUBLE_TYPE, 16) as number,
    height: read(handle, DOUBLE_TYPE, 24) as number,
    xAdvance: read(handle, DOUBLE_TYPE, 32) as number,
    yAdvance: read(handle, DOUBLE_TYPE, 40) as number,
});

/**
 * Reads a `cairo_font_extents_t` struct.
 *
 * @param handle - The struct handle.
 * @returns The extents fields.
 */
export const readFontExtents = (handle: NativeHandle): FontExtents => ({
    ascent: read(handle, DOUBLE_TYPE, 0) as number,
    descent: read(handle, DOUBLE_TYPE, 8) as number,
    height: read(handle, DOUBLE_TYPE, 16) as number,
    maxXAdvance: read(handle, DOUBLE_TYPE, 24) as number,
    maxYAdvance: read(handle, DOUBLE_TYPE, 32) as number,
});

/** One parsed element of a `cairo_path_t`. */
export type PathData =
    | { type: "moveTo"; x: number; y: number }
    | { type: "lineTo"; x: number; y: number }
    | { type: "curveTo"; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
    | { type: "closePath" };

/**
 * `cairo_path_data_type_t` ABI values, stable in cairo's public C API.
 */
const PATH_MOVE_TO = 0;
const PATH_LINE_TO = 1;
const PATH_CURVE_TO = 2;
const PATH_CLOSE_PATH = 3;

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
 *
 * @param pathHandle - The `cairo_path_t` handle.
 * @returns The parsed path elements.
 */
export const parsePath = (pathHandle: NativeHandle): PathData[] => {
    const numData = read(pathHandle, INT_TYPE, 16) as number;
    if (numData === 0) return [];

    const dataArray = read(pathHandle, t.struct("borrowed", numData * 16), 8) as NativeHandle;
    const result: PathData[] = [];
    let i = 0;
    while (i < numData) {
        const base = i * 16;
        const headerType = read(dataArray, INT_TYPE, base) as number;
        const length = read(dataArray, INT_TYPE, base + 4) as number;
        switch (headerType) {
            case PATH_MOVE_TO: {
                const ptBase = (i + 1) * 16;
                result.push({
                    type: "moveTo",
                    x: read(dataArray, DOUBLE_TYPE, ptBase) as number,
                    y: read(dataArray, DOUBLE_TYPE, ptBase + 8) as number,
                });
                break;
            }
            case PATH_LINE_TO: {
                const ptBase = (i + 1) * 16;
                result.push({
                    type: "lineTo",
                    x: read(dataArray, DOUBLE_TYPE, ptBase) as number,
                    y: read(dataArray, DOUBLE_TYPE, ptBase + 8) as number,
                });
                break;
            }
            case PATH_CURVE_TO: {
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
            case PATH_CLOSE_PATH: {
                result.push({ type: "closePath" });
                break;
            }
        }
        i += length;
    }
    return result;
};

const cairo_version = t.fn(LIB, "cairo_version", [], INT_TYPE);
const cairo_version_string = t.fn(LIB, "cairo_version_string", [], STRING_BORROWED);

/**
 * Returns the linked cairo version encoded as a single integer
 * (`major * 10000 + minor * 100 + micro`).
 *
 * Re-exported by the generated `@gtkx/gi/cairo` barrel.
 *
 * @public
 * @returns The encoded version number.
 */
export const cairoVersion = (): number => cairo_version() as number;

/**
 * Returns the linked cairo version as a human-readable string.
 *
 * Re-exported by the generated `@gtkx/gi/cairo` barrel.
 *
 * @public
 * @returns The version string, e.g. `"1.18.0"`.
 */
export const cairoVersionString = (): string => cairo_version_string() as string;
