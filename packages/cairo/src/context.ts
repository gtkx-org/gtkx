import {
    alloc,
    type ExternalObject,
    getHandle,
    type Handle,
    read,
    registerWrapperClass,
    setHandle,
    t,
    wrapHandle,
    write,
} from "@gtkx/runtime";
import type {
    Antialias,
    Content,
    FillRule,
    FontSlant,
    FontWeight,
    LineCap,
    LineJoin,
    Operator,
    Status,
    TextClusterFlags,
} from "./enums.js";
import type {
    CairoGlyph,
    CairoTextCluster,
    DashPattern,
    Distance,
    Extents,
    FontExtents,
    PathData,
    Point,
    RectangleData,
    TextExtents,
} from "./types.js";
import { FontFace } from "./font-face.js";
import { FontOptions } from "./font-options.js";
import {
    bindCairo,
    type BoundFunction,
    cairoGType,
    CONTEXT_FULL_T,
    CONTEXT_T,
    DOUBLE_BUFFER_T,
    FONT_EXTENTS_T,
    FONT_FACE_T,
    FONT_OPTIONS_T,
    GLYPH_T,
    MATRIX_T,
    PATH_T,
    PATTERN_FULL_T,
    PATTERN_T,
    RECTANGLE_LIST_T,
    SCALED_FONT_T,
    SURFACE_T,
    TEXT_CLUSTER_T,
    TEXT_EXTENTS_T,
} from "./lib.js";
import { allocMatrix, Matrix } from "./matrix.js";
import { parsePath } from "./path.js";
import { Pattern } from "./pattern.js";
import { ScaledFont } from "./scaled-font.js";
import { Surface } from "./surface.js";
import {
    allocClusterBuffer,
    allocFontExtents,
    allocGlyphBuffer,
    allocTextExtents,
    readFontExtents,
    readTextExtents,
} from "./text.js";

const CONTEXT_TYPE = cairoGType("cairo_gobject_context_get_type");
const RECTANGLE_SIZE = 32;
const RECTANGLE_LIST_COUNT_OFFSET = 16;
const RECTANGLE_LIST_DATA_OFFSET = 8;
const POINT_ARGS = [CONTEXT_T, t.float64, t.float64];
const EXTENTS_ARGS = [CONTEXT_T, t.ref(t.float64), t.ref(t.float64), t.ref(t.float64), t.ref(t.float64)];
const COORD_ARGS = [CONTEXT_T, t.ref(t.float64), t.ref(t.float64)];
const CURVE_ARGS = [CONTEXT_T, t.float64, t.float64, t.float64, t.float64, t.float64, t.float64];
const ARC_ARGS = [CONTEXT_T, t.float64, t.float64, t.float64, t.float64, t.float64];
const cairoCreate = bindCairo("cairo_create", [SURFACE_T], CONTEXT_FULL_T);
const cairoMoveTo = bindCairo("cairo_move_to", POINT_ARGS, t.void);
const cairoLineTo = bindCairo("cairo_line_to", POINT_ARGS, t.void);
const cairoRelMoveTo = bindCairo("cairo_rel_move_to", POINT_ARGS, t.void);
const cairoRelLineTo = bindCairo("cairo_rel_line_to", POINT_ARGS, t.void);
const cairoRelCurveTo = bindCairo("cairo_rel_curve_to", CURVE_ARGS, t.void);
const cairoCurveTo = bindCairo("cairo_curve_to", CURVE_ARGS, t.void);
const cairoArc = bindCairo("cairo_arc", ARC_ARGS, t.void);
const cairoArcNegative = bindCairo("cairo_arc_negative", ARC_ARGS, t.void);
const cairoRectangle = bindCairo("cairo_rectangle", [CONTEXT_T, t.float64, t.float64, t.float64, t.float64], t.void);
const cairoClosePath = bindCairo("cairo_close_path", [CONTEXT_T], t.void);
const cairoNewPath = bindCairo("cairo_new_path", [CONTEXT_T], t.void);
const cairoNewSubPath = bindCairo("cairo_new_sub_path", [CONTEXT_T], t.void);
const cairoStroke = bindCairo("cairo_stroke", [CONTEXT_T], t.void);
const cairoStrokePreserve = bindCairo("cairo_stroke_preserve", [CONTEXT_T], t.void);
const cairoFill = bindCairo("cairo_fill", [CONTEXT_T], t.void);
const cairoFillPreserve = bindCairo("cairo_fill_preserve", [CONTEXT_T], t.void);
const cairoPaint = bindCairo("cairo_paint", [CONTEXT_T], t.void);
const cairoPaintWithAlpha = bindCairo("cairo_paint_with_alpha", [CONTEXT_T, t.float64], t.void);
const cairoClip = bindCairo("cairo_clip", [CONTEXT_T], t.void);
const cairoClipPreserve = bindCairo("cairo_clip_preserve", [CONTEXT_T], t.void);
const cairoResetClip = bindCairo("cairo_reset_clip", [CONTEXT_T], t.void);
const cairoSetSourceRgb = bindCairo("cairo_set_source_rgb", [CONTEXT_T, t.float64, t.float64, t.float64], t.void);

const cairoSetSourceRgba = bindCairo(
    "cairo_set_source_rgba",
    [CONTEXT_T, t.float64, t.float64, t.float64, t.float64],
    t.void,
);

const cairoSetSource = bindCairo("cairo_set_source", [CONTEXT_T, PATTERN_T], t.void);
const cairoSetLineWidth = bindCairo("cairo_set_line_width", [CONTEXT_T, t.float64], t.void);
const cairoGetLineWidth = bindCairo("cairo_get_line_width", [CONTEXT_T], t.float64);
const cairoSetLineCap = bindCairo("cairo_set_line_cap", [CONTEXT_T, t.int32], t.void);
const cairoGetLineCap = bindCairo("cairo_get_line_cap", [CONTEXT_T], t.int32);
const cairoSetLineJoin = bindCairo("cairo_set_line_join", [CONTEXT_T, t.int32], t.void);
const cairoGetLineJoin = bindCairo("cairo_get_line_join", [CONTEXT_T], t.int32);
const cairoSetDash = bindCairo("cairo_set_dash", [CONTEXT_T, DOUBLE_BUFFER_T, t.int32, t.float64], t.void);
const cairoGetDashCount = bindCairo("cairo_get_dash_count", [CONTEXT_T], t.int32);
const cairoGetDash = bindCairo("cairo_get_dash", [CONTEXT_T, DOUBLE_BUFFER_T, t.ref(t.float64)], t.void);
const cairoSetMiterLimit = bindCairo("cairo_set_miter_limit", [CONTEXT_T, t.float64], t.void);
const cairoGetMiterLimit = bindCairo("cairo_get_miter_limit", [CONTEXT_T], t.float64);
const cairoSetTolerance = bindCairo("cairo_set_tolerance", [CONTEXT_T, t.float64], t.void);
const cairoGetTolerance = bindCairo("cairo_get_tolerance", [CONTEXT_T], t.float64);
const cairoSetFillRule = bindCairo("cairo_set_fill_rule", [CONTEXT_T, t.int32], t.void);
const cairoGetFillRule = bindCairo("cairo_get_fill_rule", [CONTEXT_T], t.int32);
const cairoSave = bindCairo("cairo_save", [CONTEXT_T], t.void);
const cairoRestore = bindCairo("cairo_restore", [CONTEXT_T], t.void);
const cairoTranslate = bindCairo("cairo_translate", POINT_ARGS, t.void);
const cairoScale = bindCairo("cairo_scale", POINT_ARGS, t.void);
const cairoRotate = bindCairo("cairo_rotate", [CONTEXT_T, t.float64], t.void);
const cairoSetOperator = bindCairo("cairo_set_operator", [CONTEXT_T, t.int32], t.void);
const cairoGetOperator = bindCairo("cairo_get_operator", [CONTEXT_T], t.int32);

const cairoSelectFontFace = bindCairo(
    "cairo_select_font_face",
    [CONTEXT_T, t.string("full"), t.int32, t.int32],
    t.void,
);

const cairoSetFontSize = bindCairo("cairo_set_font_size", [CONTEXT_T, t.float64], t.void);
const cairoShowText = bindCairo("cairo_show_text", [CONTEXT_T, t.string("full")], t.void);
const cairoTextPath = bindCairo("cairo_text_path", [CONTEXT_T, t.string("full")], t.void);
const cairoTextExtents = bindCairo("cairo_text_extents", [CONTEXT_T, t.string("full"), TEXT_EXTENTS_T], t.void);
const cairoFontExtents = bindCairo("cairo_font_extents", [CONTEXT_T, FONT_EXTENTS_T], t.void);
const cairoSetFontOptions = bindCairo("cairo_set_font_options", [CONTEXT_T, FONT_OPTIONS_T], t.void);
const cairoGetFontOptions = bindCairo("cairo_get_font_options", [CONTEXT_T, FONT_OPTIONS_T], t.void);
const cairoSetAntialias = bindCairo("cairo_set_antialias", [CONTEXT_T, t.int32], t.void);
const cairoGetAntialias = bindCairo("cairo_get_antialias", [CONTEXT_T], t.int32);
const cairoShowPage = bindCairo("cairo_show_page", [CONTEXT_T], t.void);
const cairoCopyPage = bindCairo("cairo_copy_page", [CONTEXT_T], t.void);
const cairoGetTarget = bindCairo("cairo_get_target", [CONTEXT_T], SURFACE_T);

const cairoSetSourceSurface = bindCairo(
    "cairo_set_source_surface",
    [CONTEXT_T, SURFACE_T, t.float64, t.float64],
    t.void,
);

const cairoHasCurrentPoint = bindCairo("cairo_has_current_point", [CONTEXT_T], t.boolean);
const cairoGetCurrentPoint = bindCairo("cairo_get_current_point", COORD_ARGS, t.void);
const cairoGetSource = bindCairo("cairo_get_source", [CONTEXT_T], PATTERN_T);
const cairoStrokeExtents = bindCairo("cairo_stroke_extents", EXTENTS_ARGS, t.void);
const cairoFillExtents = bindCairo("cairo_fill_extents", EXTENTS_ARGS, t.void);
const cairoClipExtents = bindCairo("cairo_clip_extents", EXTENTS_ARGS, t.void);
const cairoPathExtents = bindCairo("cairo_path_extents", EXTENTS_ARGS, t.void);
const cairoInStroke = bindCairo("cairo_in_stroke", POINT_ARGS, t.boolean);
const cairoInFill = bindCairo("cairo_in_fill", POINT_ARGS, t.boolean);
const cairoInClip = bindCairo("cairo_in_clip", POINT_ARGS, t.boolean);
const cairoCopyClipRectangleList = bindCairo("cairo_copy_clip_rectangle_list", [CONTEXT_T], RECTANGLE_LIST_T);
const cairoRectangleListDestroy = bindCairo("cairo_rectangle_list_destroy", [RECTANGLE_LIST_T], t.void);
const cairoMask = bindCairo("cairo_mask", [CONTEXT_T, PATTERN_T], t.void);
const cairoMaskSurface = bindCairo("cairo_mask_surface", [CONTEXT_T, SURFACE_T, t.float64, t.float64], t.void);
const cairoSetMatrix = bindCairo("cairo_set_matrix", [CONTEXT_T, MATRIX_T], t.void);
const cairoGetMatrix = bindCairo("cairo_get_matrix", [CONTEXT_T, MATRIX_T], t.void);
const cairoTransform = bindCairo("cairo_transform", [CONTEXT_T, MATRIX_T], t.void);
const cairoIdentityMatrix = bindCairo("cairo_identity_matrix", [CONTEXT_T], t.void);
const cairoUserToDevice = bindCairo("cairo_user_to_device", COORD_ARGS, t.void);
const cairoUserToDeviceDistance = bindCairo("cairo_user_to_device_distance", COORD_ARGS, t.void);
const cairoDeviceToUser = bindCairo("cairo_device_to_user", COORD_ARGS, t.void);
const cairoDeviceToUserDistance = bindCairo("cairo_device_to_user_distance", COORD_ARGS, t.void);
const cairoStatus = bindCairo("cairo_status", [CONTEXT_T], t.int32);
const cairoGetReferenceCount = bindCairo("cairo_get_reference_count", [CONTEXT_T], t.int32);
const cairoPushGroup = bindCairo("cairo_push_group", [CONTEXT_T], t.void);
const cairoPushGroupWithContent = bindCairo("cairo_push_group_with_content", [CONTEXT_T, t.int32], t.void);
const cairoPopGroup = bindCairo("cairo_pop_group", [CONTEXT_T], PATTERN_FULL_T);
const cairoPopGroupToSource = bindCairo("cairo_pop_group_to_source", [CONTEXT_T], t.void);
const cairoGetGroupTarget = bindCairo("cairo_get_group_target", [CONTEXT_T], SURFACE_T);
const cairoSetFontFace = bindCairo("cairo_set_font_face", [CONTEXT_T, FONT_FACE_T], t.void);
const cairoGetFontFace = bindCairo("cairo_get_font_face", [CONTEXT_T], FONT_FACE_T);
const cairoSetFontMatrix = bindCairo("cairo_set_font_matrix", [CONTEXT_T, MATRIX_T], t.void);
const cairoGetFontMatrix = bindCairo("cairo_get_font_matrix", [CONTEXT_T, MATRIX_T], t.void);
const cairoSetScaledFont = bindCairo("cairo_set_scaled_font", [CONTEXT_T, SCALED_FONT_T], t.void);
const cairoGetScaledFont = bindCairo("cairo_get_scaled_font", [CONTEXT_T], SCALED_FONT_T);
const cairoShowGlyphs = bindCairo("cairo_show_glyphs", [CONTEXT_T, GLYPH_T, t.int32], t.void);
const cairoGlyphPath = bindCairo("cairo_glyph_path", [CONTEXT_T, GLYPH_T, t.int32], t.void);
const cairoGlyphExtents = bindCairo("cairo_glyph_extents", [CONTEXT_T, GLYPH_T, t.int32, TEXT_EXTENTS_T], t.void);
const cairoCopyPath = bindCairo("cairo_copy_path", [CONTEXT_T], PATH_T);
const cairoCopyPathFlat = bindCairo("cairo_copy_path_flat", [CONTEXT_T], PATH_T);
const cairoTagBegin = bindCairo("cairo_tag_begin", [CONTEXT_T, t.string("full"), t.string("full")], t.void);
const cairoTagEnd = bindCairo("cairo_tag_end", [CONTEXT_T, t.string("full")], t.void);

const cairoShowTextGlyphs = bindCairo(
    "cairo_show_text_glyphs",
    [CONTEXT_T, t.string("full"), t.int32, GLYPH_T, t.int32, TEXT_CLUSTER_T, t.int32, t.int32],
    t.void,
);

const readExtents = (handle: ExternalObject<Handle>, boundFn: BoundFunction): Extents => {
    const x1Ref = { value: 0 };
    const y1Ref = { value: 0 };
    const x2Ref = { value: 0 };
    const y2Ref = { value: 0 };
    boundFn(handle, x1Ref, y1Ref, x2Ref, y2Ref);

    return { x1: x1Ref.value, y1: y1Ref.value, x2: x2Ref.value, y2: y2Ref.value };
};

const transformCoords = (
    handle: ExternalObject<Handle>,
    boundFn: BoundFunction,
    a: number,
    b: number,
): [number, number] => {
    const aRef = { value: a };
    const bRef = { value: b };
    boundFn(handle, aRef, bRef);

    return [aRef.value, bRef.value];
};

const allocDashBuffer = (dashes: number[]): ExternalObject<Handle> => {
    const buffer = alloc(dashes.length * 8);

    for (const [index, dash] of dashes.entries()) {
        write(buffer, t.float64, index * 8, dash);
    }

    return buffer;
};

const readDashes = (buffer: ExternalObject<Handle>, count: number): number[] =>
    Array.from({ length: count }, (_, index) => read(buffer, t.float64, index * 8) as number);

const readRectangle = (rects: ExternalObject<Handle>, base: number): RectangleData => ({
    x: read(rects, t.float64, base) as number,
    y: read(rects, t.float64, base + 8) as number,
    width: read(rects, t.float64, base + 16) as number,
    height: read(rects, t.float64, base + 24) as number,
});

const readRectangleList = (listHandle: ExternalObject<Handle>): RectangleData[] => {
    const count = read(listHandle, t.int32, RECTANGLE_LIST_COUNT_OFFSET) as number;

    if (count === 0) {
        return [];
    }

    const rects = read(
        listHandle,
        t.struct("borrowed", { size: count * RECTANGLE_SIZE }),
        RECTANGLE_LIST_DATA_OFFSET,
    ) as ExternalObject<Handle>;

    return Array.from({ length: count }, (_, index) => readRectangle(rects, index * RECTANGLE_SIZE));
};

const appendSegment = (ctx: Context, segment: PathData): void => {
    switch (segment.type) {
        case "moveTo": {
            ctx.moveTo(segment.x, segment.y);

            return;
        }
        case "lineTo": {
            ctx.lineTo(segment.x, segment.y);

            return;
        }
        case "curveTo": {
            ctx.curveTo(segment.x1, segment.y1, segment.x2, segment.y2, segment.x3, segment.y3);

            return;
        }
        case "closePath": {
            ctx.closePath();
        }
    }
};

/**
 * A cairo drawing context (`cairo_t`): the object every drawing operation goes through, holding the current
 * path, source, transformation, clip and font state for one target surface. GTK hands one to draw callbacks
 * and snapshots, and `new Context(surface)` creates one for offscreen drawing.
 */
class Context {
    static {
        registerWrapperClass(this, CONTEXT_TYPE);
    }

    /** Creates a context drawing onto `target`, the same as `new Context(target)`. */
    static create(target: Surface): Context {
        return new Context(target);
    }

    /** GType of `CairoContext`, the boxed type this class is registered under. */
    declare __type__: bigint;

    /** Creates a context drawing onto `target`. */
    constructor(target: Surface) {
        setHandle(this, cairoCreate(getHandle(target)) as ExternalObject<Handle>);
    }

    /** Begins a new sub-path at `(x, y)`, which becomes the current point. */
    moveTo(x: number, y: number): void {
        cairoMoveTo(getHandle(this), x, y);
    }

    /** Adds a straight line from the current point to `(x, y)`. */
    lineTo(x: number, y: number): void {
        cairoLineTo(getHandle(this), x, y);
    }

    /** Begins a new sub-path offset from the current point by `(dx, dy)`. */
    relMoveTo(dx: number, dy: number): void {
        cairoRelMoveTo(getHandle(this), dx, dy);
    }

    /** Adds a straight line from the current point to the point offset by `(dx, dy)`. */
    relLineTo(dx: number, dy: number): void {
        cairoRelLineTo(getHandle(this), dx, dy);
    }

    /** Adds a cubic Bézier curve whose control points and end point are offsets from the current point. */
    relCurveTo(dx1: number, dy1: number, dx2: number, dy2: number, dx3: number, dy3: number): void {
        cairoRelCurveTo(getHandle(this), dx1, dy1, dx2, dy2, dx3, dy3);
    }

    /** Adds a cubic Bézier curve from the current point through two control points to `(x3, y3)`. */
    curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        cairoCurveTo(getHandle(this), x1, y1, x2, y2, x3, y3);
    }

    /** Adds a circular arc centred on `(xc, yc)`, drawn clockwise from `angle1` to `angle2`. */
    arc(xc: number, yc: number, radius: number, angle1: number, angle2: number): void {
        cairoArc(getHandle(this), xc, yc, radius, angle1, angle2);
    }

    /** Adds a circular arc centred on `(xc, yc)`, drawn counter-clockwise from `angle1` to `angle2`. */
    arcNegative(xc: number, yc: number, radius: number, angle1: number, angle2: number): void {
        cairoArcNegative(getHandle(this), xc, yc, radius, angle1, angle2);
    }

    /** Adds a closed rectangular sub-path. */
    rectangle(x: number, y: number, width: number, height: number): void {
        cairoRectangle(getHandle(this), x, y, width, height);
    }

    /** Closes the current sub-path with a line back to its start. */
    closePath(): void {
        cairoClosePath(getHandle(this));
    }

    /** Clears the current path. */
    newPath(): void {
        cairoNewPath(getHandle(this));
    }

    /** Begins a new sub-path without a current point, so the next `arc` needs no leading `moveTo`. */
    newSubPath(): void {
        cairoNewSubPath(getHandle(this));
    }

    /** Strokes the current path with the current line settings and clears it. */
    stroke(): void {
        cairoStroke(getHandle(this));
    }

    /** Strokes the current path and keeps it. */
    strokePreserve(): void {
        cairoStrokePreserve(getHandle(this));
    }

    /** Fills the current path with the current fill rule and clears it. */
    fill(): void {
        cairoFill(getHandle(this));
    }

    /** Fills the current path and keeps it. */
    fillPreserve(): void {
        cairoFillPreserve(getHandle(this));
    }

    /** Paints the current source everywhere inside the clip. */
    paint(): void {
        cairoPaint(getHandle(this));
    }

    /** Paints the current source everywhere inside the clip, faded by `alpha`. */
    paintWithAlpha(alpha: number): void {
        cairoPaintWithAlpha(getHandle(this), alpha);
    }

    /** Intersects the clip with the current path and clears the path. */
    clip(): void {
        cairoClip(getHandle(this));
    }

    /** Intersects the clip with the current path and keeps the path. */
    clipPreserve(): void {
        cairoClipPreserve(getHandle(this));
    }

    /** Removes the clip, so drawing reaches the whole surface again. */
    resetClip(): void {
        cairoResetClip(getHandle(this));
    }

    /** Sets the source to an opaque color with components in the 0 to 1 range. */
    setSourceRgb(red: number, green: number, blue: number): void {
        cairoSetSourceRgb(getHandle(this), red, green, blue);
    }

    /** Sets the source to a translucent color with components in the 0 to 1 range. */
    setSourceRgba(red: number, green: number, blue: number, alpha: number): void {
        cairoSetSourceRgba(getHandle(this), red, green, blue, alpha);
    }

    /** Sets the source pattern drawing operations paint with. */
    setSource(pattern: Pattern): void {
        cairoSetSource(getHandle(this), getHandle(pattern));
    }

    /** Sets the width of stroked lines in user space. */
    setLineWidth(width: number): void {
        cairoSetLineWidth(getHandle(this), width);
    }

    /** Returns the width of stroked lines. */
    getLineWidth(): number {
        return cairoGetLineWidth(getHandle(this)) as number;
    }

    /** Sets how the ends of stroked lines are drawn. */
    setLineCap(lineCap: LineCap): void {
        cairoSetLineCap(getHandle(this), lineCap);
    }

    /** Returns how the ends of stroked lines are drawn. */
    getLineCap(): LineCap {
        return cairoGetLineCap(getHandle(this)) as LineCap;
    }

    /** Sets how the corners of stroked lines are joined. */
    setLineJoin(lineJoin: LineJoin): void {
        cairoSetLineJoin(getHandle(this), lineJoin);
    }

    /** Returns how the corners of stroked lines are joined. */
    getLineJoin(): LineJoin {
        return cairoGetLineJoin(getHandle(this)) as LineJoin;
    }

    /** Sets the dash pattern of strokes as alternating on and off lengths; an empty list draws solid lines. */
    setDash(dashes: number[], offset: number): void {
        cairoSetDash(getHandle(this), allocDashBuffer(dashes), dashes.length, offset);
    }

    /** Returns how many lengths the dash pattern has, zero for a solid line. */
    getDashCount(): number {
        return cairoGetDashCount(getHandle(this)) as number;
    }

    /** Returns the dash pattern and its offset. */
    getDash(): DashPattern {
        const count = this.getDashCount();

        if (count === 0) {
            return { dashes: [], offset: 0 };
        }

        const buffer = alloc(count * 8);
        const offsetRef = { value: 0 };
        cairoGetDash(getHandle(this), buffer, offsetRef);

        return { dashes: readDashes(buffer, count), offset: offsetRef.value };
    }

    /** Sets the miter limit above which a mitered join is drawn beveled. */
    setMiterLimit(limit: number): void {
        cairoSetMiterLimit(getHandle(this), limit);
    }

    /** Returns the miter limit. */
    getMiterLimit(): number {
        return cairoGetMiterLimit(getHandle(this)) as number;
    }

    /** Sets the tolerance used when curves are flattened into line segments. */
    setTolerance(tolerance: number): void {
        cairoSetTolerance(getHandle(this), tolerance);
    }

    /** Returns the tolerance used when curves are flattened. */
    getTolerance(): number {
        return cairoGetTolerance(getHandle(this)) as number;
    }

    /** Sets the rule deciding which areas a self-intersecting path fills. */
    setFillRule(fillRule: FillRule): void {
        cairoSetFillRule(getHandle(this), fillRule);
    }

    /** Returns the fill rule. */
    getFillRule(): FillRule {
        return cairoGetFillRule(getHandle(this)) as FillRule;
    }

    /** Pushes the current drawing state (source, transformation, clip, line and font settings) onto a stack. */
    save(): void {
        cairoSave(getHandle(this));
    }

    /** Restores the drawing state saved by the matching `save`. */
    restore(): void {
        cairoRestore(getHandle(this));
    }

    /** Moves the user-space origin by `(tx, ty)`. */
    translate(tx: number, ty: number): void {
        cairoTranslate(getHandle(this), tx, ty);
    }

    /** Scales user space by `sx` and `sy`. */
    scale(sx: number, sy: number): void {
        cairoScale(getHandle(this), sx, sy);
    }

    /** Rotates user space by `angle` radians. */
    rotate(angle: number): void {
        cairoRotate(getHandle(this), angle);
    }

    /** Sets the compositing operator used by drawing operations. */
    setOperator(op: Operator): void {
        cairoSetOperator(getHandle(this), op);
    }

    /** Returns the compositing operator. */
    getOperator(): Operator {
        return cairoGetOperator(getHandle(this)) as Operator;
    }

    /** Selects a toy font face by family name, slant and weight. */
    selectFontFace(family: string, slant: FontSlant, weight: FontWeight): void {
        cairoSelectFontFace(getHandle(this), family, slant, weight);
    }

    /** Sets the font size in user space, replacing the font matrix with a uniform scale. */
    setFontSize(size: number): void {
        cairoSetFontSize(getHandle(this), size);
    }

    /** Draws `text` with the current font at the current point. */
    showText(text: string): void {
        cairoShowText(getHandle(this), text);
    }

    /** Adds the outlines of `text` to the current path. */
    textPath(text: string): void {
        cairoTextPath(getHandle(this), text);
    }

    /** Measures `text` with the current font. */
    textExtents(text: string): TextExtents {
        const extents = allocTextExtents();
        cairoTextExtents(getHandle(this), text, extents);

        return readTextExtents(extents);
    }

    /** Returns the metrics of the current font. */
    fontExtents(): FontExtents {
        const extents = allocFontExtents();
        cairoFontExtents(getHandle(this), extents);

        return readFontExtents(extents);
    }

    /** Sets the font rendering options merged over the surface's defaults. */
    setFontOptions(options: FontOptions): void {
        cairoSetFontOptions(getHandle(this), getHandle(options));
    }

    /** Returns a copy of the font rendering options set on the context. */
    getFontOptions(): FontOptions {
        const options = FontOptions.create();
        cairoGetFontOptions(getHandle(this), getHandle(options));

        return options;
    }

    /** Sets the antialiasing mode of the rasterizer. */
    setAntialias(antialias: Antialias): void {
        cairoSetAntialias(getHandle(this), antialias);
    }

    /** Returns the antialiasing mode. */
    getAntialias(): Antialias {
        return cairoGetAntialias(getHandle(this)) as Antialias;
    }

    /** Emits the current page and clears it, on surfaces that support pages. */
    showPage(): void {
        cairoShowPage(getHandle(this));
    }

    /** Emits the current page without clearing it, on surfaces that support pages. */
    copyPage(): void {
        cairoCopyPage(getHandle(this));
    }

    /** Returns the surface the context was created for, wrapped as its concrete class. */
    getTarget(): Surface {
        return wrapHandle(cairoGetTarget(getHandle(this)) as ExternalObject<Handle>, Surface);
    }

    /** Sets the source to `surface` placed with its origin at `(x, y)` in user space. */
    setSourceSurface(surface: Surface, x: number, y: number): void {
        cairoSetSourceSurface(getHandle(this), getHandle(surface), x, y);
    }

    /** Returns whether the path has a current point. */
    hasCurrentPoint(): boolean {
        return cairoHasCurrentPoint(getHandle(this)) as boolean;
    }

    /** Returns the current point of the path, or null when there is none. */
    getCurrentPoint(): Point | null {
        if (!this.hasCurrentPoint()) {
            return null;
        }

        const xRef = { value: 0 };
        const yRef = { value: 0 };
        cairoGetCurrentPoint(getHandle(this), xRef, yRef);

        return { x: xRef.value, y: yRef.value };
    }

    /** Returns the current source pattern, wrapped as its concrete class. */
    getSource(): Pattern {
        return wrapHandle(cairoGetSource(getHandle(this)) as ExternalObject<Handle>, Pattern);
    }

    /** Returns the bounding box a `stroke` of the current path would cover. */
    strokeExtents(): Extents {
        return readExtents(getHandle(this), cairoStrokeExtents);
    }

    /** Returns the bounding box a `fill` of the current path would cover. */
    fillExtents(): Extents {
        return readExtents(getHandle(this), cairoFillExtents);
    }

    /** Returns the bounding box of the current clip. */
    clipExtents(): Extents {
        return readExtents(getHandle(this), cairoClipExtents);
    }

    /** Returns the bounding box of the current path. */
    pathExtents(): Extents {
        return readExtents(getHandle(this), cairoPathExtents);
    }

    /** Returns whether `(x, y)` lies inside the area a `stroke` of the current path would cover. */
    inStroke(x: number, y: number): boolean {
        return cairoInStroke(getHandle(this), x, y) as boolean;
    }

    /** Returns whether `(x, y)` lies inside the area a `fill` of the current path would cover. */
    inFill(x: number, y: number): boolean {
        return cairoInFill(getHandle(this), x, y) as boolean;
    }

    /** Returns whether `(x, y)` lies inside the current clip. */
    inClip(x: number, y: number): boolean {
        return cairoInClip(getHandle(this), x, y) as boolean;
    }

    /** Returns the current clip as a list of rectangles in user space. */
    copyClipRectangleList(): RectangleData[] {
        const listHandle = cairoCopyClipRectangleList(getHandle(this)) as ExternalObject<Handle>;
        const rects = readRectangleList(listHandle);
        cairoRectangleListDestroy(listHandle);

        return rects;
    }

    /** Paints the current source using the alpha channel of `pattern` as a mask. */
    mask(pattern: Pattern): void {
        cairoMask(getHandle(this), getHandle(pattern));
    }

    /** Paints the current source using the alpha channel of `surface`, placed at `(x, y)`, as a mask. */
    maskSurface(surface: Surface, x: number, y: number): void {
        cairoMaskSurface(getHandle(this), getHandle(surface), x, y);
    }

    /** Replaces the transformation from user space to device space. */
    setMatrix(matrix: Matrix): void {
        cairoSetMatrix(getHandle(this), getHandle(matrix));
    }

    /** Returns the transformation from user space to device space. */
    getMatrix(): Matrix {
        const { handle, matrix } = allocMatrix();
        cairoGetMatrix(getHandle(this), handle);

        return matrix;
    }

    /** Applies `matrix` before the existing transformation. */
    transform(matrix: Matrix): void {
        cairoTransform(getHandle(this), getHandle(matrix));
    }

    /** Resets the transformation to the identity. */
    identityMatrix(): void {
        cairoIdentityMatrix(getHandle(this));
    }

    /** Maps a point from user space to device space. */
    userToDevice(x: number, y: number): Point {
        const [px, py] = transformCoords(getHandle(this), cairoUserToDevice, x, y);

        return { x: px, y: py };
    }

    /** Maps a distance from user space to device space, ignoring translation. */
    userToDeviceDistance(dx: number, dy: number): Distance {
        const [ddx, ddy] = transformCoords(getHandle(this), cairoUserToDeviceDistance, dx, dy);

        return { dx: ddx, dy: ddy };
    }

    /** Maps a point from device space to user space. */
    deviceToUser(x: number, y: number): Point {
        const [px, py] = transformCoords(getHandle(this), cairoDeviceToUser, x, y);

        return { x: px, y: py };
    }

    /** Maps a distance from device space to user space, ignoring translation. */
    deviceToUserDistance(dx: number, dy: number): Distance {
        const [ddx, ddy] = transformCoords(getHandle(this), cairoDeviceToUserDistance, dx, dy);

        return { dx: ddx, dy: ddy };
    }

    /** Returns the error status of the context, `Status.SUCCESS` while every operation so far succeeded. */
    status(): Status {
        return cairoStatus(getHandle(this)) as Status;
    }

    /** Returns the reference count of the underlying `cairo_t`. */
    getReferenceCount(): number {
        return cairoGetReferenceCount(getHandle(this)) as number;
    }

    /** Redirects drawing to an intermediate surface until `popGroup` or `popGroupToSource`. */
    pushGroup(): void {
        cairoPushGroup(getHandle(this));
    }

    /** Redirects drawing to an intermediate surface of the given content. */
    pushGroupWithContent(content: Content): void {
        cairoPushGroupWithContent(getHandle(this), content);
    }

    /** Ends the current group and returns what was drawn into it as a pattern. */
    popGroup(): Pattern {
        return wrapHandle(cairoPopGroup(getHandle(this)) as ExternalObject<Handle>, Pattern);
    }

    /** Ends the current group and installs what was drawn into it as the source. */
    popGroupToSource(): void {
        cairoPopGroupToSource(getHandle(this));
    }

    /** Returns the surface drawing currently goes to: the group surface inside a group, else the target. */
    getGroupTarget(): Surface {
        return wrapHandle(cairoGetGroupTarget(getHandle(this)) as ExternalObject<Handle>, Surface);
    }

    /** Sets the font face used by text operations. */
    setFontFace(fontFace: FontFace): void {
        cairoSetFontFace(getHandle(this), getHandle(fontFace));
    }

    /** Returns the current font face, wrapped as its concrete class. */
    getFontFace(): FontFace {
        return wrapHandle(cairoGetFontFace(getHandle(this)) as ExternalObject<Handle>, FontFace);
    }

    /** Sets the matrix mapping font space to user space, which sizes and shapes the glyphs. */
    setFontMatrix(matrix: Matrix): void {
        cairoSetFontMatrix(getHandle(this), getHandle(matrix));
    }

    /** Returns the matrix mapping font space to user space. */
    getFontMatrix(): Matrix {
        const { handle, matrix } = allocMatrix();
        cairoGetFontMatrix(getHandle(this), handle);

        return matrix;
    }

    /** Replaces the font face, font matrix and font options with those of `scaledFont`. */
    setScaledFont(scaledFont: ScaledFont): void {
        cairoSetScaledFont(getHandle(this), getHandle(scaledFont));
    }

    /** Returns the scaled font text operations currently use. */
    getScaledFont(): ScaledFont {
        return wrapHandle(cairoGetScaledFont(getHandle(this)) as ExternalObject<Handle>, ScaledFont);
    }

    /** Draws positioned glyphs with the current font. */
    showGlyphs(glyphs: CairoGlyph[]): void {
        cairoShowGlyphs(getHandle(this), allocGlyphBuffer(glyphs), glyphs.length);
    }

    /** Adds the outlines of positioned glyphs to the current path. */
    glyphPath(glyphs: CairoGlyph[]): void {
        cairoGlyphPath(getHandle(this), allocGlyphBuffer(glyphs), glyphs.length);
    }

    /** Measures positioned glyphs with the current font. */
    glyphExtents(glyphs: CairoGlyph[]): TextExtents {
        const extents = allocTextExtents();
        cairoGlyphExtents(getHandle(this), allocGlyphBuffer(glyphs), glyphs.length, extents);

        return readTextExtents(extents);
    }

    /** Returns a copy of the current path as segments. */
    copyPath(): PathData[] {
        return parsePath(cairoCopyPath(getHandle(this)) as ExternalObject<Handle>);
    }

    /** Returns a copy of the current path with curves flattened into line segments. */
    copyPathFlat(): PathData[] {
        return parsePath(cairoCopyPathFlat(getHandle(this)) as ExternalObject<Handle>);
    }

    /** Appends segments, as returned by `copyPath`, to the current path. */
    appendPath(data: PathData[]): void {
        for (const segment of data) {
            appendSegment(this, segment);
        }
    }

    /** Opens a tagged structure, such as a link or a destination, on surfaces that record tags. */
    tagBegin(tagName: string, attributes: string): void {
        cairoTagBegin(getHandle(this), tagName, attributes);
    }

    /** Closes the tagged structure opened by the matching `tagBegin`. */
    tagEnd(tagName: string): void {
        cairoTagEnd(getHandle(this), tagName);
    }

    /** Draws glyphs together with the text and clusters they came from, so the backend can keep the text. */
    showTextGlyphs(
        text: string,
        glyphs: CairoGlyph[],
        clusters: CairoTextCluster[],
        clusterFlags: TextClusterFlags,
    ): void {
        const glyphBuffer = allocGlyphBuffer(glyphs);
        const clusterBuffer = allocClusterBuffer(clusters);

        cairoShowTextGlyphs(
            getHandle(this),
            text,
            -1,
            glyphBuffer,
            glyphs.length,
            clusterBuffer,
            clusters.length,
            clusterFlags,
        );
    }
}

export { Context };
