import { getHandle, t, wrapHandle } from "@gtkx/ffi";
import { alloc, type Handle, read, write } from "@gtkx/native";
import type {
    Antialias,
    Content,
    FillRule,
    FontOptions,
    FontSlant,
    FontWeight,
    LineCap,
    LineJoin,
    Operator,
    Status,
    TextClusterFlags,
} from "../cairo.js";
import { Context, FontFace, Pattern, ScaledFont, Surface } from "../cairo.js";
import { FontOptions as FontOptionsConstructor } from "./font-options.js";
import { allocMatrix, type Matrix as CairoMatrix } from "./matrix.js";

const { bind } = t;

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
export const allocGlyphBuffer = (glyphs: CairoGlyph[]): Handle => {
    const buf = alloc(glyphs.length * 24, "cairo_glyph_t[]");
    let offset = 0;
    for (const glyph of glyphs) {
        write(buf, t.uint64, offset, glyph.index);
        write(buf, t.float64, offset + 8, glyph.x);
        write(buf, t.float64, offset + 16, glyph.y);
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
export const allocClusterBuffer = (clusters: CairoTextCluster[]): Handle => {
    const buf = alloc(clusters.length * 8, "cairo_text_cluster_t[]");
    let offset = 0;
    for (const cluster of clusters) {
        write(buf, t.int32, offset, cluster.numBytes);
        write(buf, t.int32, offset + 4, cluster.numGlyphs);
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
export const readTextExtents = (handle: Handle): TextExtents => ({
    xBearing: read(handle, t.float64, 0) as number,
    yBearing: read(handle, t.float64, 8) as number,
    width: read(handle, t.float64, 16) as number,
    height: read(handle, t.float64, 24) as number,
    xAdvance: read(handle, t.float64, 32) as number,
    yAdvance: read(handle, t.float64, 40) as number,
});

/**
 * Reads a `cairo_font_extents_t` struct.
 *
 * @param handle - The struct handle.
 * @returns The extents fields.
 */
export const readFontExtents = (handle: Handle): FontExtents => ({
    ascent: read(handle, t.float64, 0) as number,
    descent: read(handle, t.float64, 8) as number,
    height: read(handle, t.float64, 16) as number,
    maxXAdvance: read(handle, t.float64, 24) as number,
    maxYAdvance: read(handle, t.float64, 32) as number,
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
 * on its boxed descriptor), so the GC releases it once `pathHandle` is no
 * longer reachable. The inner data-array read borrows cairo's own buffer
 * for the duration of the parse and is never freed independently.
 *
 * @param pathHandle - The `cairo_path_t` handle.
 * @returns The parsed path elements.
 */
export const parsePath = (pathHandle: Handle): PathData[] => {
    const numData = read(pathHandle, t.int32, 16) as number;
    if (numData === 0) return [];

    const dataArray = read(pathHandle, t.struct("borrowed", numData * 16), 8) as Handle;
    const result: PathData[] = [];
    let i = 0;
    while (i < numData) {
        const base = i * 16;
        const headerType = read(dataArray, t.int32, base) as number;
        const length = read(dataArray, t.int32, base + 4) as number;
        switch (headerType) {
            case PATH_MOVE_TO: {
                const ptBase = (i + 1) * 16;
                result.push({
                    type: "moveTo",
                    x: read(dataArray, t.float64, ptBase) as number,
                    y: read(dataArray, t.float64, ptBase + 8) as number,
                });
                break;
            }
            case PATH_LINE_TO: {
                const ptBase = (i + 1) * 16;
                result.push({
                    type: "lineTo",
                    x: read(dataArray, t.float64, ptBase) as number,
                    y: read(dataArray, t.float64, ptBase + 8) as number,
                });
                break;
            }
            case PATH_CURVE_TO: {
                const pt1 = (i + 1) * 16;
                const pt2 = (i + 2) * 16;
                const pt3 = (i + 3) * 16;
                result.push({
                    type: "curveTo",
                    x1: read(dataArray, t.float64, pt1) as number,
                    y1: read(dataArray, t.float64, pt1 + 8) as number,
                    x2: read(dataArray, t.float64, pt2) as number,
                    y2: read(dataArray, t.float64, pt2 + 8) as number,
                    x3: read(dataArray, t.float64, pt3) as number,
                    y3: read(dataArray, t.float64, pt3 + 8) as number,
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

const cairoVersion = t.bind("libcairo.so.2", "cairo_version", [], t.int32);
const cairoVersionString = t.bind("libcairo.so.2", "cairo_version_string", [], t.string("borrowed"));

/**
 * Returns the linked cairo version encoded as a single integer
 * (`major * 10000 + minor * 100 + micro`).
 *
 * Re-exported by the generated `@gtkx/gi/cairo` barrel.
 *
 * @public
 * @returns The encoded version number.
 */
export const version = (): number => cairoVersion() as number;

/**
 * Returns the linked cairo version as a human-readable string.
 *
 * Re-exported by the generated `@gtkx/gi/cairo` barrel.
 *
 * @public
 * @returns The version string, e.g. `"1.18.0"`.
 */
export const versionString = (): string => cairoVersionString() as string;

declare module "../cairo.js" {
    interface Context {
        moveTo(x: number, y: number): void;
        lineTo(x: number, y: number): void;
        relMoveTo(dx: number, dy: number): void;
        relLineTo(dx: number, dy: number): void;
        relCurveTo(dx1: number, dy1: number, dx2: number, dy2: number, dx3: number, dy3: number): void;
        curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
        arc(xc: number, yc: number, radius: number, angle1: number, angle2: number): void;
        arcNegative(xc: number, yc: number, radius: number, angle1: number, angle2: number): void;
        rectangle(x: number, y: number, width: number, height: number): void;
        closePath(): void;
        newPath(): void;
        newSubPath(): void;

        stroke(): void;
        strokePreserve(): void;
        fill(): void;
        fillPreserve(): void;
        paint(): void;
        paintWithAlpha(alpha: number): void;
        clip(): void;
        clipPreserve(): void;
        resetClip(): void;

        setSourceRgb(red: number, green: number, blue: number): void;
        setSourceRgba(red: number, green: number, blue: number, alpha: number): void;
        setSource(pattern: Pattern): void;

        setLineWidth(width: number): void;
        getLineWidth(): number;
        setLineCap(lineCap: LineCap): void;
        getLineCap(): LineCap;
        setLineJoin(lineJoin: LineJoin): void;
        getLineJoin(): LineJoin;
        setDash(dashes: number[], offset: number): void;
        getDashCount(): number;
        getDash(): { dashes: number[]; offset: number };
        setMiterLimit(limit: number): void;
        getMiterLimit(): number;
        setTolerance(tolerance: number): void;
        getTolerance(): number;

        setFillRule(fillRule: FillRule): void;
        getFillRule(): FillRule;

        save(): void;
        restore(): void;
        translate(tx: number, ty: number): void;
        scale(sx: number, sy: number): void;
        rotate(angle: number): void;

        setOperator(op: Operator): void;
        getOperator(): Operator;

        selectFontFace(family: string, slant: FontSlant, weight: FontWeight): void;
        setFontSize(size: number): void;
        showText(text: string): void;
        textPath(text: string): void;
        textExtents(text: string): TextExtents;
        fontExtents(): FontExtents;

        setFontOptions(options: FontOptions): void;
        getFontOptions(): FontOptions;
        setAntialias(antialias: Antialias): void;
        getAntialias(): Antialias;

        showPage(): void;
        copyPage(): void;
        getTarget(): Surface;
        setSourceSurface(surface: Surface, x: number, y: number): void;
        hasCurrentPoint(): boolean;
        getCurrentPoint(): { x: number; y: number } | null;
        getSource(): Pattern;

        strokeExtents(): { x1: number; y1: number; x2: number; y2: number };
        fillExtents(): { x1: number; y1: number; x2: number; y2: number };
        clipExtents(): { x1: number; y1: number; x2: number; y2: number };
        pathExtents(): { x1: number; y1: number; x2: number; y2: number };
        inStroke(x: number, y: number): boolean;
        inFill(x: number, y: number): boolean;
        inClip(x: number, y: number): boolean;
        copyClipRectangleList(): Array<{ x: number; y: number; width: number; height: number }>;

        mask(pattern: Pattern): void;
        maskSurface(surface: Surface, x: number, y: number): void;

        setMatrix(matrix: CairoMatrix): void;
        getMatrix(): CairoMatrix;
        transform(matrix: CairoMatrix): void;
        identityMatrix(): void;
        userToDevice(x: number, y: number): { x: number; y: number };
        userToDeviceDistance(dx: number, dy: number): { dx: number; dy: number };
        deviceToUser(x: number, y: number): { x: number; y: number };
        deviceToUserDistance(dx: number, dy: number): { dx: number; dy: number };

        status(): Status;
        getReferenceCount(): number;
    }
}

const cairoMoveTo = bind(
    "libcairo.so.2",
    "cairo_move_to",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.moveTo = function (x: number, y: number): void {
    cairoMoveTo(getHandle(this), x, y);
};

const cairoLineTo = bind(
    "libcairo.so.2",
    "cairo_line_to",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.lineTo = function (x: number, y: number): void {
    cairoLineTo(getHandle(this), x, y);
};

const cairoRelMoveTo = bind(
    "libcairo.so.2",
    "cairo_rel_move_to",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.relMoveTo = function (dx: number, dy: number): void {
    cairoRelMoveTo(getHandle(this), dx, dy);
};

const cairoRelLineTo = bind(
    "libcairo.so.2",
    "cairo_rel_line_to",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.relLineTo = function (dx: number, dy: number): void {
    cairoRelLineTo(getHandle(this), dx, dy);
};

const cairoRelCurveTo = bind(
    "libcairo.so.2",
    "cairo_rel_curve_to",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.relCurveTo = function (
    dx1: number,
    dy1: number,
    dx2: number,
    dy2: number,
    dx3: number,
    dy3: number,
): void {
    cairoRelCurveTo(getHandle(this), dx1, dy1, dx2, dy2, dx3, dy3);
};

const cairoCurveTo = bind(
    "libcairo.so.2",
    "cairo_curve_to",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.curveTo = function (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    cairoCurveTo(getHandle(this), x1, y1, x2, y2, x3, y3);
};

const cairoArc = bind(
    "libcairo.so.2",
    "cairo_arc",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.arc = function (xc: number, yc: number, radius: number, angle1: number, angle2: number): void {
    cairoArc(getHandle(this), xc, yc, radius, angle1, angle2);
};

const cairoArcNegative = bind(
    "libcairo.so.2",
    "cairo_arc_negative",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.arcNegative = function (
    xc: number,
    yc: number,
    radius: number,
    angle1: number,
    angle2: number,
): void {
    cairoArcNegative(getHandle(this), xc, yc, radius, angle1, angle2);
};

const cairoRectangle = bind(
    "libcairo.so.2",
    "cairo_rectangle",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.rectangle = function (x: number, y: number, width: number, height: number): void {
    cairoRectangle(getHandle(this), x, y, width, height);
};

const cairoClosePath = bind(
    "libcairo.so.2",
    "cairo_close_path",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.closePath = function (): void {
    cairoClosePath(getHandle(this));
};

const cairoNewPath = bind(
    "libcairo.so.2",
    "cairo_new_path",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.newPath = function (): void {
    cairoNewPath(getHandle(this));
};

const cairoNewSubPath = bind(
    "libcairo.so.2",
    "cairo_new_sub_path",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.newSubPath = function (): void {
    cairoNewSubPath(getHandle(this));
};

const cairoStroke = bind(
    "libcairo.so.2",
    "cairo_stroke",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.stroke = function (): void {
    cairoStroke(getHandle(this));
};

const cairoStrokePreserve = bind(
    "libcairo.so.2",
    "cairo_stroke_preserve",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.strokePreserve = function (): void {
    cairoStrokePreserve(getHandle(this));
};

const cairoFill = bind(
    "libcairo.so.2",
    "cairo_fill",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.fill = function (): void {
    cairoFill(getHandle(this));
};

const cairoFillPreserve = bind(
    "libcairo.so.2",
    "cairo_fill_preserve",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.fillPreserve = function (): void {
    cairoFillPreserve(getHandle(this));
};

const cairoPaint = bind(
    "libcairo.so.2",
    "cairo_paint",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.paint = function (): void {
    cairoPaint(getHandle(this));
};

const cairoPaintWithAlpha = bind(
    "libcairo.so.2",
    "cairo_paint_with_alpha",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.paintWithAlpha = function (alpha: number): void {
    cairoPaintWithAlpha(getHandle(this), alpha);
};

const cairoClip = bind(
    "libcairo.so.2",
    "cairo_clip",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.clip = function (): void {
    cairoClip(getHandle(this));
};

const cairoClipPreserve = bind(
    "libcairo.so.2",
    "cairo_clip_preserve",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.clipPreserve = function (): void {
    cairoClipPreserve(getHandle(this));
};

const cairoResetClip = bind(
    "libcairo.so.2",
    "cairo_reset_clip",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.resetClip = function (): void {
    cairoResetClip(getHandle(this));
};

const cairoSetSourceRgb = bind(
    "libcairo.so.2",
    "cairo_set_source_rgb",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.setSourceRgb = function (red: number, green: number, blue: number): void {
    cairoSetSourceRgb(getHandle(this), red, green, blue);
};

const cairoSetSourceRgba = bind(
    "libcairo.so.2",
    "cairo_set_source_rgba",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.setSourceRgba = function (red: number, green: number, blue: number, alpha: number): void {
    cairoSetSourceRgba(getHandle(this), red, green, blue, alpha);
};

const cairoSetSource = bind(
    "libcairo.so.2",
    "cairo_set_source",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
    ],
    t.void,
);
Context.prototype.setSource = function (pattern: Pattern): void {
    cairoSetSource(getHandle(this), getHandle(pattern));
};

const cairoSetLineWidth = bind(
    "libcairo.so.2",
    "cairo_set_line_width",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.setLineWidth = function (width: number): void {
    cairoSetLineWidth(getHandle(this), width);
};

const cairoGetLineWidth = bind(
    "libcairo.so.2",
    "cairo_get_line_width",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.float64,
);
Context.prototype.getLineWidth = function (): number {
    return cairoGetLineWidth(getHandle(this)) as number;
};

const cairoSetLineCap = bind(
    "libcairo.so.2",
    "cairo_set_line_cap",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.setLineCap = function (lineCap: LineCap): void {
    cairoSetLineCap(getHandle(this), lineCap);
};

const cairoGetLineCap = bind(
    "libcairo.so.2",
    "cairo_get_line_cap",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.int32,
);
Context.prototype.getLineCap = function (): LineCap {
    return cairoGetLineCap(getHandle(this)) as LineCap;
};

const cairoSetLineJoin = bind(
    "libcairo.so.2",
    "cairo_set_line_join",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.setLineJoin = function (lineJoin: LineJoin): void {
    cairoSetLineJoin(getHandle(this), lineJoin);
};

const cairoGetLineJoin = bind(
    "libcairo.so.2",
    "cairo_get_line_join",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.int32,
);
Context.prototype.getLineJoin = function (): LineJoin {
    return cairoGetLineJoin(getHandle(this)) as LineJoin;
};

const DOUBLE_BUFFER_T = t.boxed("double[]", "borrowed", "libcairo.so.2");

const cairoSetDash = bind(
    "libcairo.so.2",
    "cairo_set_dash",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: DOUBLE_BUFFER_T },
        { type: t.int32 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.setDash = function (dashes: number[], offset: number): void {
    const dashBuf = alloc(dashes.length * 8, "double[]");
    for (let i = 0; i < dashes.length; i++) {
        write(dashBuf, t.float64, i * 8, dashes[i]);
    }
    cairoSetDash(getHandle(this), dashBuf, dashes.length, offset);
};

const cairoGetDashCount = bind(
    "libcairo.so.2",
    "cairo_get_dash_count",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.int32,
);
Context.prototype.getDashCount = function (): number {
    return cairoGetDashCount(getHandle(this)) as number;
};

const cairoGetDash = bind(
    "libcairo.so.2",
    "cairo_get_dash",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: DOUBLE_BUFFER_T },
        { type: t.ref(t.float64) },
    ],
    t.void,
);
Context.prototype.getDash = function (): { dashes: number[]; offset: number } {
    const count = this.getDashCount();
    if (count === 0) {
        return { dashes: [], offset: 0 };
    }
    const dashBuf = alloc(count * 8, "double[]");
    const offsetRef = { value: 0 };
    cairoGetDash(getHandle(this), dashBuf, offsetRef);
    const dashes: number[] = [];
    for (let i = 0; i < count; i++) {
        dashes.push(read(dashBuf, t.float64, i * 8) as number);
    }
    return { dashes, offset: offsetRef.value };
};

const cairoSetMiterLimit = bind(
    "libcairo.so.2",
    "cairo_set_miter_limit",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.setMiterLimit = function (limit: number): void {
    cairoSetMiterLimit(getHandle(this), limit);
};

const cairoGetMiterLimit = bind(
    "libcairo.so.2",
    "cairo_get_miter_limit",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.float64,
);
Context.prototype.getMiterLimit = function (): number {
    return cairoGetMiterLimit(getHandle(this)) as number;
};

const cairoSetTolerance = bind(
    "libcairo.so.2",
    "cairo_set_tolerance",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.setTolerance = function (tolerance: number): void {
    cairoSetTolerance(getHandle(this), tolerance);
};

const cairoGetTolerance = bind(
    "libcairo.so.2",
    "cairo_get_tolerance",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.float64,
);
Context.prototype.getTolerance = function (): number {
    return cairoGetTolerance(getHandle(this)) as number;
};

const cairoSetFillRule = bind(
    "libcairo.so.2",
    "cairo_set_fill_rule",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.setFillRule = function (fillRule: FillRule): void {
    cairoSetFillRule(getHandle(this), fillRule);
};

const cairoGetFillRule = bind(
    "libcairo.so.2",
    "cairo_get_fill_rule",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.int32,
);
Context.prototype.getFillRule = function (): FillRule {
    return cairoGetFillRule(getHandle(this)) as FillRule;
};

const cairoSave = bind(
    "libcairo.so.2",
    "cairo_save",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.save = function (): void {
    cairoSave(getHandle(this));
};

const cairoRestore = bind(
    "libcairo.so.2",
    "cairo_restore",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.restore = function (): void {
    cairoRestore(getHandle(this));
};

const cairoTranslate = bind(
    "libcairo.so.2",
    "cairo_translate",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.translate = function (tx: number, ty: number): void {
    cairoTranslate(getHandle(this), tx, ty);
};

const cairoScale = bind(
    "libcairo.so.2",
    "cairo_scale",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.scale = function (sx: number, sy: number): void {
    cairoScale(getHandle(this), sx, sy);
};

const cairoRotate = bind(
    "libcairo.so.2",
    "cairo_rotate",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.rotate = function (angle: number): void {
    cairoRotate(getHandle(this), angle);
};

const cairoSetOperator = bind(
    "libcairo.so.2",
    "cairo_set_operator",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.setOperator = function (op: Operator): void {
    cairoSetOperator(getHandle(this), op);
};

const cairoGetOperator = bind(
    "libcairo.so.2",
    "cairo_get_operator",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.int32,
);
Context.prototype.getOperator = function (): Operator {
    return cairoGetOperator(getHandle(this)) as Operator;
};

const cairoSelectFontFace = bind(
    "libcairo.so.2",
    "cairo_select_font_face",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.string("full") },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.selectFontFace = function (family: string, slant: FontSlant, weight: FontWeight): void {
    cairoSelectFontFace(getHandle(this), family, slant, weight);
};

const cairoSetFontSize = bind(
    "libcairo.so.2",
    "cairo_set_font_size",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.setFontSize = function (size: number): void {
    cairoSetFontSize(getHandle(this), size);
};

const cairoShowText = bind(
    "libcairo.so.2",
    "cairo_show_text",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.string("full") },
    ],
    t.void,
);
Context.prototype.showText = function (text: string): void {
    cairoShowText(getHandle(this), text);
};

const cairoTextPath = bind(
    "libcairo.so.2",
    "cairo_text_path",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.string("full") },
    ],
    t.void,
);
Context.prototype.textPath = function (text: string): void {
    cairoTextPath(getHandle(this), text);
};

const cairoTextExtents = bind(
    "libcairo.so.2",
    "cairo_text_extents",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.string("full") },
        { type: t.boxed("cairo_text_extents_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Context.prototype.textExtents = function (text: string): TextExtents {
    const extents = alloc(48, "cairo_text_extents_t");
    cairoTextExtents(getHandle(this), text, extents);
    return readTextExtents(extents);
};

const cairoFontExtents = bind(
    "libcairo.so.2",
    "cairo_font_extents",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_font_extents_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Context.prototype.fontExtents = function (): FontExtents {
    const extents = alloc(40, "cairo_font_extents_t");
    cairoFontExtents(getHandle(this), extents);
    return readFontExtents(extents);
};

const cairoSetFontOptions = bind(
    "libcairo.so.2",
    "cairo_set_font_options",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
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
Context.prototype.setFontOptions = function (options: FontOptions): void {
    cairoSetFontOptions(getHandle(this), getHandle(options));
};

const cairoGetFontOptions = bind(
    "libcairo.so.2",
    "cairo_get_font_options",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
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
Context.prototype.getFontOptions = function (): FontOptions {
    const options = FontOptionsConstructor.create();
    cairoGetFontOptions(getHandle(this), getHandle(options));
    return options;
};

const cairoSetAntialias = bind(
    "libcairo.so.2",
    "cairo_set_antialias",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.setAntialias = function (antialias: Antialias): void {
    cairoSetAntialias(getHandle(this), antialias);
};

const cairoGetAntialias = bind(
    "libcairo.so.2",
    "cairo_get_antialias",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.int32,
);
Context.prototype.getAntialias = function (): Antialias {
    return cairoGetAntialias(getHandle(this)) as Antialias;
};

const cairoShowPage = bind(
    "libcairo.so.2",
    "cairo_show_page",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.showPage = function (): void {
    cairoShowPage(getHandle(this));
};

const cairoCopyPage = bind(
    "libcairo.so.2",
    "cairo_copy_page",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.copyPage = function (): void {
    cairoCopyPage(getHandle(this));
};

const cairoGetTarget = bind(
    "libcairo.so.2",
    "cairo_get_target",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
Context.prototype.getTarget = function (): Surface {
    return wrapHandle(cairoGetTarget(getHandle(this)) as Handle, Surface) as Surface;
};

const cairoSetSourceSurface = bind(
    "libcairo.so.2",
    "cairo_set_source_surface",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.setSourceSurface = function (surface: Surface, x: number, y: number): void {
    cairoSetSourceSurface(getHandle(this), getHandle(surface), x, y);
};

const cairoHasCurrentPoint = bind(
    "libcairo.so.2",
    "cairo_has_current_point",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boolean,
);
Context.prototype.hasCurrentPoint = function (): boolean {
    return cairoHasCurrentPoint(getHandle(this)) as boolean;
};

const cairoGetCurrentPoint = bind(
    "libcairo.so.2",
    "cairo_get_current_point",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.void,
);
Context.prototype.getCurrentPoint = function (): { x: number; y: number } | null {
    if (!this.hasCurrentPoint()) {
        return null;
    }
    const xRef = { value: 0 };
    const yRef = { value: 0 };
    cairoGetCurrentPoint(getHandle(this), xRef, yRef);
    return { x: xRef.value, y: yRef.value };
};

const cairoGetSource = bind(
    "libcairo.so.2",
    "cairo_get_source",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type"),
);
Context.prototype.getSource = function (): Pattern {
    return wrapHandle(cairoGetSource(getHandle(this)) as Handle, Pattern) as Pattern;
};

const EXTENTS_ARGS = [
    { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
    { type: t.ref(t.float64) },
    { type: t.ref(t.float64) },
    { type: t.ref(t.float64) },
    { type: t.ref(t.float64) },
] as const;
const cairoStrokeExtents = bind("libcairo.so.2", "cairo_stroke_extents", EXTENTS_ARGS, t.void);
const cairoFillExtents = bind("libcairo.so.2", "cairo_fill_extents", EXTENTS_ARGS, t.void);
const cairoClipExtents = bind("libcairo.so.2", "cairo_clip_extents", EXTENTS_ARGS, t.void);
const cairoPathExtents = bind("libcairo.so.2", "cairo_path_extents", EXTENTS_ARGS, t.void);

const getExtents = (
    ctx: Context,
    boundFn: (...args: unknown[]) => unknown,
): { x1: number; y1: number; x2: number; y2: number } => {
    const x1Ref = { value: 0 };
    const y1Ref = { value: 0 };
    const x2Ref = { value: 0 };
    const y2Ref = { value: 0 };
    boundFn(getHandle(ctx), x1Ref, y1Ref, x2Ref, y2Ref);
    return { x1: x1Ref.value, y1: y1Ref.value, x2: x2Ref.value, y2: y2Ref.value };
};

Context.prototype.strokeExtents = function (): { x1: number; y1: number; x2: number; y2: number } {
    return getExtents(this, cairoStrokeExtents);
};

Context.prototype.fillExtents = function (): { x1: number; y1: number; x2: number; y2: number } {
    return getExtents(this, cairoFillExtents);
};

Context.prototype.clipExtents = function (): { x1: number; y1: number; x2: number; y2: number } {
    return getExtents(this, cairoClipExtents);
};

Context.prototype.pathExtents = function (): { x1: number; y1: number; x2: number; y2: number } {
    return getExtents(this, cairoPathExtents);
};

const cairoInStroke = bind(
    "libcairo.so.2",
    "cairo_in_stroke",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.boolean,
);
Context.prototype.inStroke = function (x: number, y: number): boolean {
    return cairoInStroke(getHandle(this), x, y) as boolean;
};

const cairoInFill = bind(
    "libcairo.so.2",
    "cairo_in_fill",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.boolean,
);
Context.prototype.inFill = function (x: number, y: number): boolean {
    return cairoInFill(getHandle(this), x, y) as boolean;
};

const cairoInClip = bind(
    "libcairo.so.2",
    "cairo_in_clip",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.boolean,
);
Context.prototype.inClip = function (x: number, y: number): boolean {
    return cairoInClip(getHandle(this), x, y) as boolean;
};

const cairoCopyClipRectangleList = bind(
    "libcairo.so.2",
    "cairo_copy_clip_rectangle_list",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("cairo_rectangle_list_t", "borrowed", "libcairo.so.2"),
);
const cairoRectangleListDestroy = bind(
    "libcairo.so.2",
    "cairo_rectangle_list_destroy",
    [{ type: t.boxed("cairo_rectangle_list_t", "borrowed", "libcairo.so.2") }],
    t.void,
);

/**
 * Parses `cairo_rectangle_list_t` struct layout:
 *   offset  0: cairo_status_t status (int32)
 *   offset  8: cairo_rectangle_t *rectangles (pointer)
 *   offset 16: int num_rectangles (int32)
 *
 * Each `cairo_rectangle_t` is 32 bytes:
 *   offset 0: double x
 *   offset 8: double y
 *   offset 16: double width
 *   offset 24: double height
 */
Context.prototype.copyClipRectangleList = function (): Array<{
    x: number;
    y: number;
    width: number;
    height: number;
}> {
    const listHandle = cairoCopyClipRectangleList(getHandle(this)) as Handle;

    const numRectangles = read(listHandle, t.int32, 16) as number;
    if (numRectangles === 0) {
        cairoRectangleListDestroy(listHandle);
        return [];
    }
    const rectsArray = read(listHandle, t.struct("full", numRectangles * 32), 8) as Handle;
    const result: Array<{ x: number; y: number; width: number; height: number }> = [];

    for (let i = 0; i < numRectangles; i++) {
        const base = i * 32;
        result.push({
            x: read(rectsArray, t.float64, base) as number,
            y: read(rectsArray, t.float64, base + 8) as number,
            width: read(rectsArray, t.float64, base + 16) as number,
            height: read(rectsArray, t.float64, base + 24) as number,
        });
    }

    cairoRectangleListDestroy(listHandle);

    return result;
};

const cairoMask = bind(
    "libcairo.so.2",
    "cairo_mask",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
    ],
    t.void,
);
Context.prototype.mask = function (pattern: Pattern): void {
    cairoMask(getHandle(this), getHandle(pattern));
};

const cairoMaskSurface = bind(
    "libcairo.so.2",
    "cairo_mask_surface",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Context.prototype.maskSurface = function (surface: Surface, x: number, y: number): void {
    cairoMaskSurface(getHandle(this), getHandle(surface), x, y);
};

const cairoSetMatrix = bind(
    "libcairo.so.2",
    "cairo_set_matrix",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Context.prototype.setMatrix = function (matrix: CairoMatrix): void {
    cairoSetMatrix(getHandle(this), getHandle(matrix));
};

const cairoGetMatrix = bind(
    "libcairo.so.2",
    "cairo_get_matrix",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Context.prototype.getMatrix = function (): CairoMatrix {
    const { handle, obj } = allocMatrix();
    cairoGetMatrix(getHandle(this), handle);
    return obj;
};

const cairoTransform = bind(
    "libcairo.so.2",
    "cairo_transform",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Context.prototype.transform = function (matrix: CairoMatrix): void {
    cairoTransform(getHandle(this), getHandle(matrix));
};

const cairoIdentityMatrix = bind(
    "libcairo.so.2",
    "cairo_identity_matrix",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.identityMatrix = function (): void {
    cairoIdentityMatrix(getHandle(this));
};

const COORD_ARGS = [
    { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
    { type: t.ref(t.float64) },
    { type: t.ref(t.float64) },
] as const;
const cairoUserToDevice = bind("libcairo.so.2", "cairo_user_to_device", COORD_ARGS, t.void);
const cairoUserToDeviceDistance = bind("libcairo.so.2", "cairo_user_to_device_distance", COORD_ARGS, t.void);
const cairoDeviceToUser = bind("libcairo.so.2", "cairo_device_to_user", COORD_ARGS, t.void);
const cairoDeviceToUserDistance = bind("libcairo.so.2", "cairo_device_to_user_distance", COORD_ARGS, t.void);

const coordTransform = (
    ctx: Context,
    boundFn: (...args: unknown[]) => unknown,
    a: number,
    b: number,
): [number, number] => {
    const aRef = { value: a };
    const bRef = { value: b };
    boundFn(getHandle(ctx), aRef, bRef);
    return [aRef.value, bRef.value];
};

Context.prototype.userToDevice = function (x: number, y: number): { x: number; y: number } {
    const [px, py] = coordTransform(this, cairoUserToDevice, x, y);
    return { x: px, y: py };
};

Context.prototype.userToDeviceDistance = function (dx: number, dy: number): { dx: number; dy: number } {
    const [ddx, ddy] = coordTransform(this, cairoUserToDeviceDistance, dx, dy);
    return { dx: ddx, dy: ddy };
};

Context.prototype.deviceToUser = function (x: number, y: number): { x: number; y: number } {
    const [px, py] = coordTransform(this, cairoDeviceToUser, x, y);
    return { x: px, y: py };
};

Context.prototype.deviceToUserDistance = function (dx: number, dy: number): { dx: number; dy: number } {
    const [ddx, ddy] = coordTransform(this, cairoDeviceToUserDistance, dx, dy);
    return { dx: ddx, dy: ddy };
};

const cairoStatus = bind(
    "libcairo.so.2",
    "cairo_status",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.int32,
);
Context.prototype.status = function (): Status {
    return cairoStatus(getHandle(this)) as Status;
};

const cairoGetReferenceCount = bind(
    "libcairo.so.2",
    "cairo_get_reference_count",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.int32,
);
Context.prototype.getReferenceCount = function (): number {
    return cairoGetReferenceCount(getHandle(this)) as number;
};

declare module "../cairo.js" {
    interface Context {
        pushGroup(): void;
        pushGroupWithContent(content: Content): void;
        popGroup(): Pattern;
        popGroupToSource(): void;
        getGroupTarget(): Surface;

        setFontFace(fontFace: FontFace): void;
        getFontFace(): FontFace;
        setFontMatrix(matrix: CairoMatrix): void;
        getFontMatrix(): CairoMatrix;
        setScaledFont(scaledFont: ScaledFont): void;
        getScaledFont(): ScaledFont;

        showGlyphs(glyphs: Array<{ index: number; x: number; y: number }>): void;
        glyphPath(glyphs: Array<{ index: number; x: number; y: number }>): void;
        glyphExtents(glyphs: Array<{ index: number; x: number; y: number }>): TextExtents;

        copyPath(): PathData[];
        copyPathFlat(): PathData[];
        appendPath(data: PathData[]): void;
    }
}

const cairoPushGroup = bind(
    "libcairo.so.2",
    "cairo_push_group",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.pushGroup = function (): void {
    cairoPushGroup(getHandle(this));
};

const cairoPushGroupWithContent = bind(
    "libcairo.so.2",
    "cairo_push_group_with_content",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.pushGroupWithContent = function (content: Content): void {
    cairoPushGroupWithContent(getHandle(this), content);
};

const cairoPopGroup = bind(
    "libcairo.so.2",
    "cairo_pop_group",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("CairoPattern", "full", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type"),
);
Context.prototype.popGroup = function (): Pattern {
    return wrapHandle(cairoPopGroup(getHandle(this)) as Handle, Pattern) as Pattern;
};

const cairoPopGroupToSource = bind(
    "libcairo.so.2",
    "cairo_pop_group_to_source",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.void,
);
Context.prototype.popGroupToSource = function (): void {
    cairoPopGroupToSource(getHandle(this));
};

const cairoGetGroupTarget = bind(
    "libcairo.so.2",
    "cairo_get_group_target",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
Context.prototype.getGroupTarget = function (): Surface {
    return wrapHandle(cairoGetGroupTarget(getHandle(this)) as Handle, Surface) as Surface;
};

const cairoSetFontFace = bind(
    "libcairo.so.2",
    "cairo_set_font_face",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type") },
    ],
    t.void,
);
Context.prototype.setFontFace = function (fontFace: FontFace): void {
    cairoSetFontFace(getHandle(this), getHandle(fontFace));
};

const cairoGetFontFace = bind(
    "libcairo.so.2",
    "cairo_get_font_face",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("CairoFontFace", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_face_get_type"),
);
Context.prototype.getFontFace = function (): FontFace {
    return wrapHandle(cairoGetFontFace(getHandle(this)) as Handle, FontFace) as FontFace;
};

const cairoSetFontMatrix = bind(
    "libcairo.so.2",
    "cairo_set_font_matrix",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Context.prototype.setFontMatrix = function (matrix: CairoMatrix): void {
    cairoSetFontMatrix(getHandle(this), getHandle(matrix));
};

const cairoGetFontMatrix = bind(
    "libcairo.so.2",
    "cairo_get_font_matrix",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Context.prototype.getFontMatrix = function (): CairoMatrix {
    const { handle, obj } = allocMatrix();
    cairoGetFontMatrix(getHandle(this), handle);
    return obj;
};

const cairoSetScaledFont = bind(
    "libcairo.so.2",
    "cairo_set_scaled_font",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type") },
    ],
    t.void,
);
Context.prototype.setScaledFont = function (scaledFont: ScaledFont): void {
    cairoSetScaledFont(getHandle(this), getHandle(scaledFont));
};

const cairoGetScaledFont = bind(
    "libcairo.so.2",
    "cairo_get_scaled_font",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("CairoScaledFont", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_scaled_font_get_type"),
);
Context.prototype.getScaledFont = function (): ScaledFont {
    return wrapHandle(cairoGetScaledFont(getHandle(this)) as Handle, ScaledFont) as ScaledFont;
};

const cairoShowGlyphs = bind(
    "libcairo.so.2",
    "cairo_show_glyphs",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_glyph_t", "borrowed", "libcairo.so.2") },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.showGlyphs = function (glyphs: Array<{ index: number; x: number; y: number }>): void {
    cairoShowGlyphs(getHandle(this), allocGlyphBuffer(glyphs), glyphs.length);
};

const cairoGlyphPath = bind(
    "libcairo.so.2",
    "cairo_glyph_path",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_glyph_t", "borrowed", "libcairo.so.2") },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.glyphPath = function (glyphs: Array<{ index: number; x: number; y: number }>): void {
    cairoGlyphPath(getHandle(this), allocGlyphBuffer(glyphs), glyphs.length);
};

const cairoGlyphExtents = bind(
    "libcairo.so.2",
    "cairo_glyph_extents",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.boxed("cairo_glyph_t", "borrowed", "libcairo.so.2") },
        { type: t.int32 },
        { type: t.boxed("cairo_text_extents_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Context.prototype.glyphExtents = function (glyphs: Array<{ index: number; x: number; y: number }>): TextExtents {
    const buf = allocGlyphBuffer(glyphs);
    const extents = alloc(48, "cairo_text_extents_t");
    cairoGlyphExtents(getHandle(this), buf, glyphs.length, extents);
    return readTextExtents(extents);
};

const cairoCopyPath = bind(
    "libcairo.so.2",
    "cairo_copy_path",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("cairo_path_t", "full", "libcairo.so.2", undefined, "cairo_path_destroy"),
);
Context.prototype.copyPath = function (): PathData[] {
    return parsePath(cairoCopyPath(getHandle(this)) as Handle);
};

const cairoCopyPathFlat = bind(
    "libcairo.so.2",
    "cairo_copy_path_flat",
    [{ type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") }],
    t.boxed("cairo_path_t", "full", "libcairo.so.2", undefined, "cairo_path_destroy"),
);
Context.prototype.copyPathFlat = function (): PathData[] {
    return parsePath(cairoCopyPathFlat(getHandle(this)) as Handle);
};

Context.prototype.appendPath = function (data: PathData[]): void {
    for (const item of data) {
        switch (item.type) {
            case "moveTo":
                this.moveTo(item.x, item.y);
                break;
            case "lineTo":
                this.lineTo(item.x, item.y);
                break;
            case "curveTo":
                this.curveTo(item.x1, item.y1, item.x2, item.y2, item.x3, item.y3);
                break;
            case "closePath":
                this.closePath();
                break;
        }
    }
};

const cairoStatusToString = bind("libcairo.so.2", "cairo_status_to_string", [{ type: t.int32 }], t.string("borrowed"));
export const statusToString = (status: Status): string => {
    return cairoStatusToString(status) as string;
};

const cairoCreate = bind(
    "libcairo.so.2",
    "cairo_create",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type"),
);

class ContextImpl extends Context {
    static create(surface: Surface): ContextImpl {
        return wrapHandle(cairoCreate(getHandle(surface)) as Handle, ContextImpl);
    }
}

export { ContextImpl as Context };

declare module "../cairo.js" {
    interface Context {
        tagBegin(tagName: string, attributes: string): void;
        tagEnd(tagName: string): void;
        showTextGlyphs(
            text: string,
            glyphs: CairoGlyph[],
            clusters: CairoTextCluster[],
            clusterFlags: TextClusterFlags,
        ): void;
    }
}

const cairoTagBegin = bind(
    "libcairo.so.2",
    "cairo_tag_begin",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.string("full") },
        { type: t.string("full") },
    ],
    t.void,
);
Context.prototype.tagBegin = function (tagName: string, attributes: string): void {
    cairoTagBegin(getHandle(this), tagName, attributes);
};

const cairoTagEnd = bind(
    "libcairo.so.2",
    "cairo_tag_end",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.string("full") },
    ],
    t.void,
);
Context.prototype.tagEnd = function (tagName: string): void {
    cairoTagEnd(getHandle(this), tagName);
};

const cairoShowTextGlyphs = bind(
    "libcairo.so.2",
    "cairo_show_text_glyphs",
    [
        { type: t.boxed("CairoContext", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_context_get_type") },
        { type: t.string("full") },
        { type: t.int32 },
        { type: t.boxed("cairo_glyph_t", "borrowed", "libcairo.so.2") },
        { type: t.int32 },
        { type: t.boxed("cairo_text_cluster_t", "borrowed", "libcairo.so.2") },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);
Context.prototype.showTextGlyphs = function (
    text: string,
    glyphs: CairoGlyph[],
    clusters: CairoTextCluster[],
    clusterFlags: TextClusterFlags,
): void {
    const glyphBuf = allocGlyphBuffer(glyphs);
    const clusterBuf = allocClusterBuffer(clusters);
    const utf8 = new TextEncoder().encode(text);
    cairoShowTextGlyphs(
        getHandle(this),
        text,
        utf8.length,
        glyphBuf,
        glyphs.length,
        clusterBuf,
        clusters.length,
        clusterFlags,
    );
};
