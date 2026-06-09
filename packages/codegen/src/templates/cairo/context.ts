import { getHandle, getNativeObject, t, wrapHandle } from "@gtkx/ffi";
import {
    alloc,
    allocClusterBuffer,
    allocGlyphBuffer,
    CAIRO_T,
    type CairoGlyph,
    type CairoTextCluster,
    CLUSTER_BUF_T,
    DOUBLE_REF,
    DOUBLE_TYPE,
    FONT_EXTENTS_T,
    FONT_FACE_T_NONE,
    FONT_OPTIONS_T,
    type FontExtents,
    GLYPH_BUF_T,
    INT_TYPE,
    LIB,
    MATRIX_T,
    type NativeHandle,
    PATH_STRUCT_T,
    PATTERN_T,
    PATTERN_T_NONE,
    type PathData,
    parsePath,
    RECT_LIST_T,
    read,
    readFontExtents,
    readTextExtents,
    SCALED_FONT_T_NONE,
    STRING_BORROWED,
    STRING_FULL,
    SURFACE_T_NONE,
    TEXT_EXTENTS_T,
    type TextExtents,
} from "@gtkx/ffi/cairo";
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
} from "@gtkx/gi/cairo/cairo.js";
import { Context, FontFace, Pattern, ScaledFont, Surface } from "@gtkx/gi/cairo/cairo.js";
import { FontOptions as FontOptionsConstructor } from "./font-options.js";
import { allocMatrix, type Matrix as CairoMatrix } from "./matrix.js";

const { fn } = t;

export type { FontExtents, TextExtents } from "@gtkx/ffi/cairo";

/**
 * Three absolute control points of a cubic Bézier segment, used by
 * {@link Context.curveTo}.
 */
export type BezierCurve = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3: number;
    y3: number;
};

/**
 * Three relative control points of a cubic Bézier segment, used by
 * {@link Context.relCurveTo}.
 */
export type RelativeBezierCurve = {
    dx1: number;
    dy1: number;
    dx2: number;
    dy2: number;
    dx3: number;
    dy3: number;
};

/**
 * Center, radius, and angular span shared by {@link Context.arc} and
 * {@link Context.arcNegative}.
 */
export type ArcParams = {
    xc: number;
    yc: number;
    radius: number;
    angle1: number;
    angle2: number;
};

declare module "@gtkx/gi/cairo/cairo.js" {
    interface Context {
        moveTo(x: number, y: number): void;
        lineTo(x: number, y: number): void;
        relMoveTo(dx: number, dy: number): void;
        relLineTo(dx: number, dy: number): void;
        relCurveTo(curve: RelativeBezierCurve): void;
        curveTo(curve: BezierCurve): void;
        arc(params: ArcParams): void;
        arcNegative(params: ArcParams): void;
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
        getDashCount(): number;
        getDash(): [number[], number];
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
        getCurrentPoint(): [number, number] | null;
        getSource(): Pattern;

        strokeExtents(): [number, number, number, number];
        fillExtents(): [number, number, number, number];
        clipExtents(): [number, number, number, number];
        pathExtents(): [number, number, number, number];
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
        userToDevice(x: number, y: number): [number, number];
        userToDeviceDistance(dx: number, dy: number): [number, number];
        deviceToUser(x: number, y: number): [number, number];
        deviceToUserDistance(dx: number, dy: number): [number, number];

        status(): Status;
        getReferenceCount(): number;
    }
}

const cairo_move_to = fn(
    LIB,
    "cairo_move_to",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.moveTo = function (x: number, y: number): void {
    cairo_move_to(getHandle(this), x, y);
};

const cairo_line_to = fn(
    LIB,
    "cairo_line_to",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.lineTo = function (x: number, y: number): void {
    cairo_line_to(getHandle(this), x, y);
};

const cairo_rel_move_to = fn(
    LIB,
    "cairo_rel_move_to",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.relMoveTo = function (dx: number, dy: number): void {
    cairo_rel_move_to(getHandle(this), dx, dy);
};

const cairo_rel_line_to = fn(
    LIB,
    "cairo_rel_line_to",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.relLineTo = function (dx: number, dy: number): void {
    cairo_rel_line_to(getHandle(this), dx, dy);
};

const cairo_rel_curve_to = fn(
    LIB,
    "cairo_rel_curve_to",
    [
        { type: CAIRO_T },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    t.void,
);
Context.prototype.relCurveTo = function ({ dx1, dy1, dx2, dy2, dx3, dy3 }: RelativeBezierCurve): void {
    cairo_rel_curve_to(getHandle(this), dx1, dy1, dx2, dy2, dx3, dy3);
};

const cairo_curve_to = fn(
    LIB,
    "cairo_curve_to",
    [
        { type: CAIRO_T },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    t.void,
);
Context.prototype.curveTo = function ({ x1, y1, x2, y2, x3, y3 }: BezierCurve): void {
    cairo_curve_to(getHandle(this), x1, y1, x2, y2, x3, y3);
};

const cairo_arc = fn(
    LIB,
    "cairo_arc",
    [
        { type: CAIRO_T },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    t.void,
);
Context.prototype.arc = function ({ xc, yc, radius, angle1, angle2 }: ArcParams): void {
    cairo_arc(getHandle(this), xc, yc, radius, angle1, angle2);
};

const cairo_arc_negative = fn(
    LIB,
    "cairo_arc_negative",
    [
        { type: CAIRO_T },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    t.void,
);
Context.prototype.arcNegative = function ({ xc, yc, radius, angle1, angle2 }: ArcParams): void {
    cairo_arc_negative(getHandle(this), xc, yc, radius, angle1, angle2);
};

const cairo_rectangle = fn(
    LIB,
    "cairo_rectangle",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.rectangle = function (x: number, y: number, width: number, height: number): void {
    cairo_rectangle(getHandle(this), x, y, width, height);
};

const cairo_close_path = fn(LIB, "cairo_close_path", [{ type: CAIRO_T }], t.void);
Context.prototype.closePath = function (): void {
    cairo_close_path(getHandle(this));
};

const cairo_new_path = fn(LIB, "cairo_new_path", [{ type: CAIRO_T }], t.void);
Context.prototype.newPath = function (): void {
    cairo_new_path(getHandle(this));
};

const cairo_new_sub_path = fn(LIB, "cairo_new_sub_path", [{ type: CAIRO_T }], t.void);
Context.prototype.newSubPath = function (): void {
    cairo_new_sub_path(getHandle(this));
};

const cairo_stroke = fn(LIB, "cairo_stroke", [{ type: CAIRO_T }], t.void);
Context.prototype.stroke = function (): void {
    cairo_stroke(getHandle(this));
};

const cairo_stroke_preserve = fn(LIB, "cairo_stroke_preserve", [{ type: CAIRO_T }], t.void);
Context.prototype.strokePreserve = function (): void {
    cairo_stroke_preserve(getHandle(this));
};

const cairo_fill = fn(LIB, "cairo_fill", [{ type: CAIRO_T }], t.void);
Context.prototype.fill = function (): void {
    cairo_fill(getHandle(this));
};

const cairo_fill_preserve = fn(LIB, "cairo_fill_preserve", [{ type: CAIRO_T }], t.void);
Context.prototype.fillPreserve = function (): void {
    cairo_fill_preserve(getHandle(this));
};

const cairo_paint = fn(LIB, "cairo_paint", [{ type: CAIRO_T }], t.void);
Context.prototype.paint = function (): void {
    cairo_paint(getHandle(this));
};

const cairo_paint_with_alpha = fn(LIB, "cairo_paint_with_alpha", [{ type: CAIRO_T }, { type: DOUBLE_TYPE }], t.void);
Context.prototype.paintWithAlpha = function (alpha: number): void {
    cairo_paint_with_alpha(getHandle(this), alpha);
};

const cairo_clip = fn(LIB, "cairo_clip", [{ type: CAIRO_T }], t.void);
Context.prototype.clip = function (): void {
    cairo_clip(getHandle(this));
};

const cairo_clip_preserve = fn(LIB, "cairo_clip_preserve", [{ type: CAIRO_T }], t.void);
Context.prototype.clipPreserve = function (): void {
    cairo_clip_preserve(getHandle(this));
};

const cairo_reset_clip = fn(LIB, "cairo_reset_clip", [{ type: CAIRO_T }], t.void);
Context.prototype.resetClip = function (): void {
    cairo_reset_clip(getHandle(this));
};

const cairo_set_source_rgb = fn(
    LIB,
    "cairo_set_source_rgb",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.setSourceRgb = function (red: number, green: number, blue: number): void {
    cairo_set_source_rgb(getHandle(this), red, green, blue);
};

const cairo_set_source_rgba = fn(
    LIB,
    "cairo_set_source_rgba",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.setSourceRgba = function (red: number, green: number, blue: number, alpha: number): void {
    cairo_set_source_rgba(getHandle(this), red, green, blue, alpha);
};

const cairo_set_source = fn(LIB, "cairo_set_source", [{ type: CAIRO_T }, { type: PATTERN_T_NONE }], t.void);
Context.prototype.setSource = function (pattern: Pattern): void {
    cairo_set_source(getHandle(this), getHandle(pattern));
};

const cairo_set_line_width = fn(LIB, "cairo_set_line_width", [{ type: CAIRO_T }, { type: DOUBLE_TYPE }], t.void);
Context.prototype.setLineWidth = function (width: number): void {
    cairo_set_line_width(getHandle(this), width);
};

const cairo_get_line_width = fn(LIB, "cairo_get_line_width", [{ type: CAIRO_T }], DOUBLE_TYPE);
Context.prototype.getLineWidth = function (): number {
    return cairo_get_line_width(getHandle(this)) as number;
};

const cairo_set_line_cap = fn(LIB, "cairo_set_line_cap", [{ type: CAIRO_T }, { type: INT_TYPE }], t.void);
Context.prototype.setLineCap = function (lineCap: LineCap): void {
    cairo_set_line_cap(getHandle(this), lineCap);
};

const cairo_get_line_cap = fn(LIB, "cairo_get_line_cap", [{ type: CAIRO_T }], INT_TYPE);
Context.prototype.getLineCap = function (): LineCap {
    return cairo_get_line_cap(getHandle(this)) as LineCap;
};

const cairo_set_line_join = fn(LIB, "cairo_set_line_join", [{ type: CAIRO_T }, { type: INT_TYPE }], t.void);
Context.prototype.setLineJoin = function (lineJoin: LineJoin): void {
    cairo_set_line_join(getHandle(this), lineJoin);
};

const cairo_get_line_join = fn(LIB, "cairo_get_line_join", [{ type: CAIRO_T }], INT_TYPE);
Context.prototype.getLineJoin = function (): LineJoin {
    return cairo_get_line_join(getHandle(this)) as LineJoin;
};

const cairo_get_dash_count = fn(LIB, "cairo_get_dash_count", [{ type: CAIRO_T }], INT_TYPE);
Context.prototype.getDashCount = function (): number {
    return cairo_get_dash_count(getHandle(this)) as number;
};

const DOUBLE_BUFFER_T = t.boxed("double[]", "borrowed", LIB);
const cairo_get_dash = fn(
    LIB,
    "cairo_get_dash",
    [{ type: CAIRO_T }, { type: DOUBLE_BUFFER_T }, { type: DOUBLE_REF }],
    t.void,
);
Context.prototype.getDash = function (): [number[], number] {
    const count = this.getDashCount();
    if (count === 0) {
        return [[], 0];
    }
    const dashBuf = alloc(count * 8, "double[]");
    const offsetRef = { value: 0 };
    cairo_get_dash(getHandle(this), dashBuf, offsetRef);
    const dashes: number[] = [];
    for (let i = 0; i < count; i++) {
        dashes.push(read(dashBuf, DOUBLE_TYPE, i * 8) as number);
    }
    return [dashes, offsetRef.value];
};

const cairo_set_miter_limit = fn(LIB, "cairo_set_miter_limit", [{ type: CAIRO_T }, { type: DOUBLE_TYPE }], t.void);
Context.prototype.setMiterLimit = function (limit: number): void {
    cairo_set_miter_limit(getHandle(this), limit);
};

const cairo_get_miter_limit = fn(LIB, "cairo_get_miter_limit", [{ type: CAIRO_T }], DOUBLE_TYPE);
Context.prototype.getMiterLimit = function (): number {
    return cairo_get_miter_limit(getHandle(this)) as number;
};

const cairo_set_tolerance = fn(LIB, "cairo_set_tolerance", [{ type: CAIRO_T }, { type: DOUBLE_TYPE }], t.void);
Context.prototype.setTolerance = function (tolerance: number): void {
    cairo_set_tolerance(getHandle(this), tolerance);
};

const cairo_get_tolerance = fn(LIB, "cairo_get_tolerance", [{ type: CAIRO_T }], DOUBLE_TYPE);
Context.prototype.getTolerance = function (): number {
    return cairo_get_tolerance(getHandle(this)) as number;
};

const cairo_set_fill_rule = fn(LIB, "cairo_set_fill_rule", [{ type: CAIRO_T }, { type: INT_TYPE }], t.void);
Context.prototype.setFillRule = function (fillRule: FillRule): void {
    cairo_set_fill_rule(getHandle(this), fillRule);
};

const cairo_get_fill_rule = fn(LIB, "cairo_get_fill_rule", [{ type: CAIRO_T }], INT_TYPE);
Context.prototype.getFillRule = function (): FillRule {
    return cairo_get_fill_rule(getHandle(this)) as FillRule;
};

const cairo_save = fn(LIB, "cairo_save", [{ type: CAIRO_T }], t.void);
Context.prototype.save = function (): void {
    cairo_save(getHandle(this));
};

const cairo_restore = fn(LIB, "cairo_restore", [{ type: CAIRO_T }], t.void);
Context.prototype.restore = function (): void {
    cairo_restore(getHandle(this));
};

const cairo_translate = fn(
    LIB,
    "cairo_translate",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.translate = function (tx: number, ty: number): void {
    cairo_translate(getHandle(this), tx, ty);
};

const cairo_scale = fn(LIB, "cairo_scale", [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }], t.void);
Context.prototype.scale = function (sx: number, sy: number): void {
    cairo_scale(getHandle(this), sx, sy);
};

const cairo_rotate = fn(LIB, "cairo_rotate", [{ type: CAIRO_T }, { type: DOUBLE_TYPE }], t.void);
Context.prototype.rotate = function (angle: number): void {
    cairo_rotate(getHandle(this), angle);
};

const cairo_set_operator = fn(LIB, "cairo_set_operator", [{ type: CAIRO_T }, { type: INT_TYPE }], t.void);
Context.prototype.setOperator = function (op: Operator): void {
    cairo_set_operator(getHandle(this), op);
};

const cairo_get_operator = fn(LIB, "cairo_get_operator", [{ type: CAIRO_T }], INT_TYPE);
Context.prototype.getOperator = function (): Operator {
    return cairo_get_operator(getHandle(this)) as Operator;
};

const cairo_select_font_face = fn(
    LIB,
    "cairo_select_font_face",
    [{ type: CAIRO_T }, { type: STRING_FULL }, { type: INT_TYPE }, { type: INT_TYPE }],
    t.void,
);
Context.prototype.selectFontFace = function (family: string, slant: FontSlant, weight: FontWeight): void {
    cairo_select_font_face(getHandle(this), family, slant, weight);
};

const cairo_set_font_size = fn(LIB, "cairo_set_font_size", [{ type: CAIRO_T }, { type: DOUBLE_TYPE }], t.void);
Context.prototype.setFontSize = function (size: number): void {
    cairo_set_font_size(getHandle(this), size);
};

const cairo_show_text = fn(LIB, "cairo_show_text", [{ type: CAIRO_T }, { type: STRING_FULL }], t.void);
Context.prototype.showText = function (text: string): void {
    cairo_show_text(getHandle(this), text);
};

const cairo_text_path = fn(LIB, "cairo_text_path", [{ type: CAIRO_T }, { type: STRING_FULL }], t.void);
Context.prototype.textPath = function (text: string): void {
    cairo_text_path(getHandle(this), text);
};

const cairo_text_extents = fn(
    LIB,
    "cairo_text_extents",
    [{ type: CAIRO_T }, { type: STRING_FULL }, { type: TEXT_EXTENTS_T }],
    t.void,
);
Context.prototype.textExtents = function (text: string): TextExtents {
    const extents = alloc(48, "cairo_text_extents_t");
    cairo_text_extents(getHandle(this), text, extents);
    return readTextExtents(extents);
};

const cairo_font_extents = fn(LIB, "cairo_font_extents", [{ type: CAIRO_T }, { type: FONT_EXTENTS_T }], t.void);
Context.prototype.fontExtents = function (): FontExtents {
    const extents = alloc(40, "cairo_font_extents_t");
    cairo_font_extents(getHandle(this), extents);
    return readFontExtents(extents);
};

const cairo_set_font_options = fn(LIB, "cairo_set_font_options", [{ type: CAIRO_T }, { type: FONT_OPTIONS_T }], t.void);
Context.prototype.setFontOptions = function (options: FontOptions): void {
    cairo_set_font_options(getHandle(this), getHandle(options));
};

const cairo_get_font_options = fn(LIB, "cairo_get_font_options", [{ type: CAIRO_T }, { type: FONT_OPTIONS_T }], t.void);
Context.prototype.getFontOptions = function (): FontOptions {
    const options = FontOptionsConstructor.create();
    cairo_get_font_options(getHandle(this), getHandle(options));
    return options;
};

const cairo_set_antialias = fn(LIB, "cairo_set_antialias", [{ type: CAIRO_T }, { type: INT_TYPE }], t.void);
Context.prototype.setAntialias = function (antialias: Antialias): void {
    cairo_set_antialias(getHandle(this), antialias);
};

const cairo_get_antialias = fn(LIB, "cairo_get_antialias", [{ type: CAIRO_T }], INT_TYPE);
Context.prototype.getAntialias = function (): Antialias {
    return cairo_get_antialias(getHandle(this)) as Antialias;
};

const cairo_show_page = fn(LIB, "cairo_show_page", [{ type: CAIRO_T }], t.void);
Context.prototype.showPage = function (): void {
    cairo_show_page(getHandle(this));
};

const cairo_copy_page = fn(LIB, "cairo_copy_page", [{ type: CAIRO_T }], t.void);
Context.prototype.copyPage = function (): void {
    cairo_copy_page(getHandle(this));
};

const cairo_get_target = fn(LIB, "cairo_get_target", [{ type: CAIRO_T }], SURFACE_T_NONE);
Context.prototype.getTarget = function (): Surface {
    return getNativeObject(cairo_get_target(getHandle(this)) as NativeHandle, Surface) as Surface;
};

const cairo_set_source_surface = fn(
    LIB,
    "cairo_set_source_surface",
    [{ type: CAIRO_T }, { type: SURFACE_T_NONE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.setSourceSurface = function (surface: Surface, x: number, y: number): void {
    cairo_set_source_surface(getHandle(this), getHandle(surface), x, y);
};

const cairo_has_current_point = fn(LIB, "cairo_has_current_point", [{ type: CAIRO_T }], t.boolean);
Context.prototype.hasCurrentPoint = function (): boolean {
    return cairo_has_current_point(getHandle(this)) as boolean;
};

const cairo_get_current_point = fn(
    LIB,
    "cairo_get_current_point",
    [{ type: CAIRO_T }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    t.void,
);
Context.prototype.getCurrentPoint = function (): [number, number] | null {
    if (!this.hasCurrentPoint()) {
        return null;
    }
    const xRef = { value: 0 };
    const yRef = { value: 0 };
    cairo_get_current_point(getHandle(this), xRef, yRef);
    return [xRef.value, yRef.value];
};

const cairo_get_source = fn(LIB, "cairo_get_source", [{ type: CAIRO_T }], PATTERN_T_NONE);
Context.prototype.getSource = function (): Pattern {
    return getNativeObject(cairo_get_source(getHandle(this)) as NativeHandle, Pattern) as Pattern;
};

const EXTENTS_ARGS = [
    { type: CAIRO_T },
    { type: DOUBLE_REF },
    { type: DOUBLE_REF },
    { type: DOUBLE_REF },
    { type: DOUBLE_REF },
] as const;
const cairo_stroke_extents = fn(LIB, "cairo_stroke_extents", EXTENTS_ARGS, t.void);
const cairo_fill_extents = fn(LIB, "cairo_fill_extents", EXTENTS_ARGS, t.void);
const cairo_clip_extents = fn(LIB, "cairo_clip_extents", EXTENTS_ARGS, t.void);
const cairo_path_extents = fn(LIB, "cairo_path_extents", EXTENTS_ARGS, t.void);

const getExtents = (ctx: Context, boundFn: (...args: unknown[]) => unknown): [number, number, number, number] => {
    const x1Ref = { value: 0 };
    const y1Ref = { value: 0 };
    const x2Ref = { value: 0 };
    const y2Ref = { value: 0 };
    boundFn(getHandle(ctx), x1Ref, y1Ref, x2Ref, y2Ref);
    return [x1Ref.value, y1Ref.value, x2Ref.value, y2Ref.value];
};

Context.prototype.strokeExtents = function (): [number, number, number, number] {
    return getExtents(this, cairo_stroke_extents);
};

Context.prototype.fillExtents = function (): [number, number, number, number] {
    return getExtents(this, cairo_fill_extents);
};

Context.prototype.clipExtents = function (): [number, number, number, number] {
    return getExtents(this, cairo_clip_extents);
};

Context.prototype.pathExtents = function (): [number, number, number, number] {
    return getExtents(this, cairo_path_extents);
};

const cairo_in_stroke = fn(
    LIB,
    "cairo_in_stroke",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.boolean,
);
Context.prototype.inStroke = function (x: number, y: number): boolean {
    return cairo_in_stroke(getHandle(this), x, y) as boolean;
};

const cairo_in_fill = fn(
    LIB,
    "cairo_in_fill",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.boolean,
);
Context.prototype.inFill = function (x: number, y: number): boolean {
    return cairo_in_fill(getHandle(this), x, y) as boolean;
};

const cairo_in_clip = fn(
    LIB,
    "cairo_in_clip",
    [{ type: CAIRO_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.boolean,
);
Context.prototype.inClip = function (x: number, y: number): boolean {
    return cairo_in_clip(getHandle(this), x, y) as boolean;
};

const cairo_copy_clip_rectangle_list = fn(LIB, "cairo_copy_clip_rectangle_list", [{ type: CAIRO_T }], RECT_LIST_T);
const cairo_rectangle_list_destroy = fn(LIB, "cairo_rectangle_list_destroy", [{ type: RECT_LIST_T }], t.void);

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
    const listHandle = cairo_copy_clip_rectangle_list(getHandle(this)) as NativeHandle;

    const numRectangles = read(listHandle, INT_TYPE, 16) as number;
    if (numRectangles === 0) {
        cairo_rectangle_list_destroy(listHandle);
        return [];
    }
    const rectsArray = read(listHandle, t.struct("full", numRectangles * 32), 8) as NativeHandle;
    const result: Array<{ x: number; y: number; width: number; height: number }> = [];

    for (let i = 0; i < numRectangles; i++) {
        const base = i * 32;
        result.push({
            x: read(rectsArray, DOUBLE_TYPE, base) as number,
            y: read(rectsArray, DOUBLE_TYPE, base + 8) as number,
            width: read(rectsArray, DOUBLE_TYPE, base + 16) as number,
            height: read(rectsArray, DOUBLE_TYPE, base + 24) as number,
        });
    }

    cairo_rectangle_list_destroy(listHandle);

    return result;
};

const cairo_mask = fn(LIB, "cairo_mask", [{ type: CAIRO_T }, { type: PATTERN_T_NONE }], t.void);
Context.prototype.mask = function (pattern: Pattern): void {
    cairo_mask(getHandle(this), getHandle(pattern));
};

const cairo_mask_surface = fn(
    LIB,
    "cairo_mask_surface",
    [{ type: CAIRO_T }, { type: SURFACE_T_NONE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Context.prototype.maskSurface = function (surface: Surface, x: number, y: number): void {
    cairo_mask_surface(getHandle(this), getHandle(surface), x, y);
};

const cairo_set_matrix = fn(LIB, "cairo_set_matrix", [{ type: CAIRO_T }, { type: MATRIX_T }], t.void);
Context.prototype.setMatrix = function (matrix: CairoMatrix): void {
    cairo_set_matrix(getHandle(this), getHandle(matrix));
};

const cairo_get_matrix = fn(LIB, "cairo_get_matrix", [{ type: CAIRO_T }, { type: MATRIX_T }], t.void);
Context.prototype.getMatrix = function (): CairoMatrix {
    const { handle, obj } = allocMatrix();
    cairo_get_matrix(getHandle(this), handle);
    return obj;
};

const cairo_transform = fn(LIB, "cairo_transform", [{ type: CAIRO_T }, { type: MATRIX_T }], t.void);
Context.prototype.transform = function (matrix: CairoMatrix): void {
    cairo_transform(getHandle(this), getHandle(matrix));
};

const cairo_identity_matrix = fn(LIB, "cairo_identity_matrix", [{ type: CAIRO_T }], t.void);
Context.prototype.identityMatrix = function (): void {
    cairo_identity_matrix(getHandle(this));
};

const COORD_ARGS = [{ type: CAIRO_T }, { type: DOUBLE_REF }, { type: DOUBLE_REF }] as const;
const cairo_user_to_device = fn(LIB, "cairo_user_to_device", COORD_ARGS, t.void);
const cairo_user_to_device_distance = fn(LIB, "cairo_user_to_device_distance", COORD_ARGS, t.void);
const cairo_device_to_user = fn(LIB, "cairo_device_to_user", COORD_ARGS, t.void);
const cairo_device_to_user_distance = fn(LIB, "cairo_device_to_user_distance", COORD_ARGS, t.void);

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

Context.prototype.userToDevice = function (x: number, y: number): [number, number] {
    return coordTransform(this, cairo_user_to_device, x, y);
};

Context.prototype.userToDeviceDistance = function (dx: number, dy: number): [number, number] {
    return coordTransform(this, cairo_user_to_device_distance, dx, dy);
};

Context.prototype.deviceToUser = function (x: number, y: number): [number, number] {
    return coordTransform(this, cairo_device_to_user, x, y);
};

Context.prototype.deviceToUserDistance = function (dx: number, dy: number): [number, number] {
    return coordTransform(this, cairo_device_to_user_distance, dx, dy);
};

const cairo_status = fn(LIB, "cairo_status", [{ type: CAIRO_T }], INT_TYPE);
Context.prototype.status = function (): Status {
    return cairo_status(getHandle(this)) as Status;
};

const cairo_get_reference_count = fn(LIB, "cairo_get_reference_count", [{ type: CAIRO_T }], INT_TYPE);
Context.prototype.getReferenceCount = function (): number {
    return cairo_get_reference_count(getHandle(this)) as number;
};

declare module "@gtkx/gi/cairo/cairo.js" {
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

const cairo_push_group = fn(LIB, "cairo_push_group", [{ type: CAIRO_T }], t.void);
Context.prototype.pushGroup = function (): void {
    cairo_push_group(getHandle(this));
};

const cairo_push_group_with_content = fn(
    LIB,
    "cairo_push_group_with_content",
    [{ type: CAIRO_T }, { type: INT_TYPE }],
    t.void,
);
Context.prototype.pushGroupWithContent = function (content: Content): void {
    cairo_push_group_with_content(getHandle(this), content);
};

const cairo_pop_group = fn(LIB, "cairo_pop_group", [{ type: CAIRO_T }], PATTERN_T);
Context.prototype.popGroup = function (): Pattern {
    return getNativeObject(cairo_pop_group(getHandle(this)) as NativeHandle, Pattern) as Pattern;
};

const cairo_pop_group_to_source = fn(LIB, "cairo_pop_group_to_source", [{ type: CAIRO_T }], t.void);
Context.prototype.popGroupToSource = function (): void {
    cairo_pop_group_to_source(getHandle(this));
};

const cairo_get_group_target = fn(LIB, "cairo_get_group_target", [{ type: CAIRO_T }], SURFACE_T_NONE);
Context.prototype.getGroupTarget = function (): Surface {
    return getNativeObject(cairo_get_group_target(getHandle(this)) as NativeHandle, Surface) as Surface;
};

const cairo_set_font_face = fn(LIB, "cairo_set_font_face", [{ type: CAIRO_T }, { type: FONT_FACE_T_NONE }], t.void);
Context.prototype.setFontFace = function (fontFace: FontFace): void {
    cairo_set_font_face(getHandle(this), getHandle(fontFace));
};

const cairo_get_font_face = fn(LIB, "cairo_get_font_face", [{ type: CAIRO_T }], FONT_FACE_T_NONE);
Context.prototype.getFontFace = function (): FontFace {
    return getNativeObject(cairo_get_font_face(getHandle(this)) as NativeHandle, FontFace) as FontFace;
};

const cairo_set_font_matrix = fn(LIB, "cairo_set_font_matrix", [{ type: CAIRO_T }, { type: MATRIX_T }], t.void);
Context.prototype.setFontMatrix = function (matrix: CairoMatrix): void {
    cairo_set_font_matrix(getHandle(this), getHandle(matrix));
};

const cairo_get_font_matrix = fn(LIB, "cairo_get_font_matrix", [{ type: CAIRO_T }, { type: MATRIX_T }], t.void);
Context.prototype.getFontMatrix = function (): CairoMatrix {
    const { handle, obj } = allocMatrix();
    cairo_get_font_matrix(getHandle(this), handle);
    return obj;
};

const cairo_set_scaled_font = fn(
    LIB,
    "cairo_set_scaled_font",
    [{ type: CAIRO_T }, { type: SCALED_FONT_T_NONE }],
    t.void,
);
Context.prototype.setScaledFont = function (scaledFont: ScaledFont): void {
    cairo_set_scaled_font(getHandle(this), getHandle(scaledFont));
};

const cairo_get_scaled_font = fn(LIB, "cairo_get_scaled_font", [{ type: CAIRO_T }], SCALED_FONT_T_NONE);
Context.prototype.getScaledFont = function (): ScaledFont {
    return getNativeObject(cairo_get_scaled_font(getHandle(this)) as NativeHandle, ScaledFont) as ScaledFont;
};

const cairo_show_glyphs = fn(
    LIB,
    "cairo_show_glyphs",
    [{ type: CAIRO_T }, { type: GLYPH_BUF_T }, { type: INT_TYPE }],
    t.void,
);
Context.prototype.showGlyphs = function (glyphs: Array<{ index: number; x: number; y: number }>): void {
    cairo_show_glyphs(getHandle(this), allocGlyphBuffer(glyphs), glyphs.length);
};

const cairo_glyph_path = fn(
    LIB,
    "cairo_glyph_path",
    [{ type: CAIRO_T }, { type: GLYPH_BUF_T }, { type: INT_TYPE }],
    t.void,
);
Context.prototype.glyphPath = function (glyphs: Array<{ index: number; x: number; y: number }>): void {
    cairo_glyph_path(getHandle(this), allocGlyphBuffer(glyphs), glyphs.length);
};

const cairo_glyph_extents = fn(
    LIB,
    "cairo_glyph_extents",
    [{ type: CAIRO_T }, { type: GLYPH_BUF_T }, { type: INT_TYPE }, { type: TEXT_EXTENTS_T }],
    t.void,
);
Context.prototype.glyphExtents = function (glyphs: Array<{ index: number; x: number; y: number }>): TextExtents {
    const buf = allocGlyphBuffer(glyphs);
    const extents = alloc(48, "cairo_text_extents_t");
    cairo_glyph_extents(getHandle(this), buf, glyphs.length, extents);
    return readTextExtents(extents);
};

const cairo_copy_path = fn(LIB, "cairo_copy_path", [{ type: CAIRO_T }], PATH_STRUCT_T);
Context.prototype.copyPath = function (): PathData[] {
    return parsePath(cairo_copy_path(getHandle(this)) as NativeHandle);
};

const cairo_copy_path_flat = fn(LIB, "cairo_copy_path_flat", [{ type: CAIRO_T }], PATH_STRUCT_T);
Context.prototype.copyPathFlat = function (): PathData[] {
    return parsePath(cairo_copy_path_flat(getHandle(this)) as NativeHandle);
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
                this.curveTo({ x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2, x3: item.x3, y3: item.y3 });
                break;
            case "closePath":
                this.closePath();
                break;
        }
    }
};

const cairo_status_to_string = fn(LIB, "cairo_status_to_string", [{ type: INT_TYPE }], STRING_BORROWED);
export const statusToString = (status: Status): string => {
    return cairo_status_to_string(status) as string;
};

const cairo_create = fn(LIB, "cairo_create", [{ type: SURFACE_T_NONE }], CAIRO_T);

class ContextImpl extends Context {
    static create(surface: Surface): ContextImpl {
        return wrapHandle(ContextImpl, cairo_create(getHandle(surface)) as NativeHandle);
    }
}

export { ContextImpl as Context };

declare module "@gtkx/gi/cairo/cairo.js" {
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

const cairo_tag_begin = fn(
    LIB,
    "cairo_tag_begin",
    [{ type: CAIRO_T }, { type: STRING_FULL }, { type: STRING_FULL }],
    t.void,
);
Context.prototype.tagBegin = function (tagName: string, attributes: string): void {
    cairo_tag_begin(getHandle(this), tagName, attributes);
};

const cairo_tag_end = fn(LIB, "cairo_tag_end", [{ type: CAIRO_T }, { type: STRING_FULL }], t.void);
Context.prototype.tagEnd = function (tagName: string): void {
    cairo_tag_end(getHandle(this), tagName);
};

const cairo_show_text_glyphs = fn(
    LIB,
    "cairo_show_text_glyphs",
    [
        { type: CAIRO_T },
        { type: STRING_FULL },
        { type: INT_TYPE },
        { type: GLYPH_BUF_T },
        { type: INT_TYPE },
        { type: CLUSTER_BUF_T },
        { type: INT_TYPE },
        { type: INT_TYPE },
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
    cairo_show_text_glyphs(
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
