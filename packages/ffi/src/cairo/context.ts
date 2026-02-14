import { createRef, type NativeHandle } from "@gtkx/native";
import { Context } from "../generated/cairo/context.js";
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
} from "../generated/cairo/enums.js";
import { FontFace } from "../generated/cairo/font-face.js";
import type { FontOptions } from "../generated/cairo/font-options.js";
import type { Matrix } from "../generated/cairo/matrix.js";
import { Pattern } from "../generated/cairo/pattern.js";
import { ScaledFont } from "../generated/cairo/scaled-font.js";
import { Surface } from "../generated/cairo/surface.js";
import { alloc, call, read, readPointer } from "../native.js";
import { getNativeObject } from "../registry.js";
import {
    allocClusterBuffer,
    allocGlyphBuffer,
    CAIRO_T,
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
    PATH_STRUCT_T,
    PATTERN_T,
    PATTERN_T_NONE,
    type PathData,
    parsePath,
    RECT_LIST_T,
    readFontExtents,
    readTextExtents,
    SCALED_FONT_T_NONE,
    SURFACE_T_NONE,
    type TextExtents,
} from "./common.js";
import { FontOptions as FontOptionsConstructor } from "./font-options.js";
import { allocMatrix } from "./matrix.js";

declare module "../generated/cairo/context.js" {
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

        setMatrix(matrix: Matrix): void;
        getMatrix(): Matrix;
        transform(matrix: Matrix): void;
        identityMatrix(): void;
        userToDevice(x: number, y: number): { x: number; y: number };
        userToDeviceDistance(dx: number, dy: number): { dx: number; dy: number };
        deviceToUser(x: number, y: number): { x: number; y: number };
        deviceToUserDistance(dx: number, dy: number): { dx: number; dy: number };

        status(): Status;
    }
}

Context.prototype.moveTo = function (x: number, y: number): void {
    call(
        LIB,
        "cairo_move_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
};

Context.prototype.lineTo = function (x: number, y: number): void {
    call(
        LIB,
        "cairo_line_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
};

Context.prototype.relMoveTo = function (dx: number, dy: number): void {
    call(
        LIB,
        "cairo_rel_move_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: dx },
            { type: DOUBLE_TYPE, value: dy },
        ],
        { type: "undefined" },
    );
};

Context.prototype.relLineTo = function (dx: number, dy: number): void {
    call(
        LIB,
        "cairo_rel_line_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: dx },
            { type: DOUBLE_TYPE, value: dy },
        ],
        { type: "undefined" },
    );
};

Context.prototype.relCurveTo = function (
    dx1: number,
    dy1: number,
    dx2: number,
    dy2: number,
    dx3: number,
    dy3: number,
): void {
    call(
        LIB,
        "cairo_rel_curve_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: dx1 },
            { type: DOUBLE_TYPE, value: dy1 },
            { type: DOUBLE_TYPE, value: dx2 },
            { type: DOUBLE_TYPE, value: dy2 },
            { type: DOUBLE_TYPE, value: dx3 },
            { type: DOUBLE_TYPE, value: dy3 },
        ],
        { type: "undefined" },
    );
};

Context.prototype.curveTo = function (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    call(
        LIB,
        "cairo_curve_to",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x1 },
            { type: DOUBLE_TYPE, value: y1 },
            { type: DOUBLE_TYPE, value: x2 },
            { type: DOUBLE_TYPE, value: y2 },
            { type: DOUBLE_TYPE, value: x3 },
            { type: DOUBLE_TYPE, value: y3 },
        ],
        { type: "undefined" },
    );
};

Context.prototype.arc = function (xc: number, yc: number, radius: number, angle1: number, angle2: number): void {
    call(
        LIB,
        "cairo_arc",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: xc },
            { type: DOUBLE_TYPE, value: yc },
            { type: DOUBLE_TYPE, value: radius },
            { type: DOUBLE_TYPE, value: angle1 },
            { type: DOUBLE_TYPE, value: angle2 },
        ],
        { type: "undefined" },
    );
};

Context.prototype.arcNegative = function (
    xc: number,
    yc: number,
    radius: number,
    angle1: number,
    angle2: number,
): void {
    call(
        LIB,
        "cairo_arc_negative",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: xc },
            { type: DOUBLE_TYPE, value: yc },
            { type: DOUBLE_TYPE, value: radius },
            { type: DOUBLE_TYPE, value: angle1 },
            { type: DOUBLE_TYPE, value: angle2 },
        ],
        { type: "undefined" },
    );
};

Context.prototype.rectangle = function (x: number, y: number, width: number, height: number): void {
    call(
        LIB,
        "cairo_rectangle",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
            { type: DOUBLE_TYPE, value: width },
            { type: DOUBLE_TYPE, value: height },
        ],
        { type: "undefined" },
    );
};

Context.prototype.closePath = function (): void {
    call(LIB, "cairo_close_path", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.newPath = function (): void {
    call(LIB, "cairo_new_path", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.newSubPath = function (): void {
    call(LIB, "cairo_new_sub_path", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.stroke = function (): void {
    call(LIB, "cairo_stroke", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.strokePreserve = function (): void {
    call(LIB, "cairo_stroke_preserve", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.fill = function (): void {
    call(LIB, "cairo_fill", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.fillPreserve = function (): void {
    call(LIB, "cairo_fill_preserve", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.paint = function (): void {
    call(LIB, "cairo_paint", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.paintWithAlpha = function (alpha: number): void {
    call(
        LIB,
        "cairo_paint_with_alpha",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: alpha },
        ],
        { type: "undefined" },
    );
};

Context.prototype.clip = function (): void {
    call(LIB, "cairo_clip", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.clipPreserve = function (): void {
    call(LIB, "cairo_clip_preserve", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.resetClip = function (): void {
    call(LIB, "cairo_reset_clip", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.setSourceRgb = function (red: number, green: number, blue: number): void {
    call(
        LIB,
        "cairo_set_source_rgb",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: red },
            { type: DOUBLE_TYPE, value: green },
            { type: DOUBLE_TYPE, value: blue },
        ],
        { type: "undefined" },
    );
};

Context.prototype.setSourceRgba = function (red: number, green: number, blue: number, alpha: number): void {
    call(
        LIB,
        "cairo_set_source_rgba",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: red },
            { type: DOUBLE_TYPE, value: green },
            { type: DOUBLE_TYPE, value: blue },
            { type: DOUBLE_TYPE, value: alpha },
        ],
        { type: "undefined" },
    );
};

Context.prototype.setSource = function (pattern: Pattern): void {
    call(
        LIB,
        "cairo_set_source",
        [
            { type: CAIRO_T, value: this.handle },
            { type: PATTERN_T_NONE, value: pattern.handle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.setLineWidth = function (width: number): void {
    call(
        LIB,
        "cairo_set_line_width",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: width },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getLineWidth = function (): number {
    return call(LIB, "cairo_get_line_width", [{ type: CAIRO_T, value: this.handle }], DOUBLE_TYPE) as number;
};

Context.prototype.setLineCap = function (lineCap: LineCap): void {
    call(
        LIB,
        "cairo_set_line_cap",
        [
            { type: CAIRO_T, value: this.handle },
            { type: INT_TYPE, value: lineCap },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getLineCap = function (): LineCap {
    return call(LIB, "cairo_get_line_cap", [{ type: CAIRO_T, value: this.handle }], INT_TYPE) as LineCap;
};

Context.prototype.setLineJoin = function (lineJoin: LineJoin): void {
    call(
        LIB,
        "cairo_set_line_join",
        [
            { type: CAIRO_T, value: this.handle },
            { type: INT_TYPE, value: lineJoin },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getLineJoin = function (): LineJoin {
    return call(LIB, "cairo_get_line_join", [{ type: CAIRO_T, value: this.handle }], INT_TYPE) as LineJoin;
};

Context.prototype.setDash = function (dashes: number[], offset: number): void {
    call(
        LIB,
        "cairo_set_dash",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "array", itemType: DOUBLE_TYPE, kind: "array", ownership: "borrowed" }, value: dashes },
            { type: INT_TYPE, value: dashes.length },
            { type: DOUBLE_TYPE, value: offset },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getDashCount = function (): number {
    return call(LIB, "cairo_get_dash_count", [{ type: CAIRO_T, value: this.handle }], INT_TYPE) as number;
};

Context.prototype.getDash = function (): { dashes: number[]; offset: number } {
    const count = this.getDashCount();
    if (count === 0) {
        return { dashes: [], offset: 0 };
    }
    const dashBuf = alloc(count * 8, "double[]", LIB);
    const offsetRef = createRef(0.0);
    call(
        LIB,
        "cairo_get_dash",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "boxed", innerType: "double[]", library: LIB, ownership: "borrowed" }, value: dashBuf },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: offsetRef },
        ],
        { type: "undefined" },
    );
    const dashes: number[] = [];
    for (let i = 0; i < count; i++) {
        dashes.push(read(dashBuf, DOUBLE_TYPE, i * 8) as number);
    }
    return { dashes, offset: offsetRef.value };
};

Context.prototype.setMiterLimit = function (limit: number): void {
    call(
        LIB,
        "cairo_set_miter_limit",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: limit },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getMiterLimit = function (): number {
    return call(LIB, "cairo_get_miter_limit", [{ type: CAIRO_T, value: this.handle }], DOUBLE_TYPE) as number;
};

Context.prototype.setTolerance = function (tolerance: number): void {
    call(
        LIB,
        "cairo_set_tolerance",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: tolerance },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getTolerance = function (): number {
    return call(LIB, "cairo_get_tolerance", [{ type: CAIRO_T, value: this.handle }], DOUBLE_TYPE) as number;
};

Context.prototype.setFillRule = function (fillRule: FillRule): void {
    call(
        LIB,
        "cairo_set_fill_rule",
        [
            { type: CAIRO_T, value: this.handle },
            { type: INT_TYPE, value: fillRule },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getFillRule = function (): FillRule {
    return call(LIB, "cairo_get_fill_rule", [{ type: CAIRO_T, value: this.handle }], INT_TYPE) as FillRule;
};

Context.prototype.save = function (): void {
    call(LIB, "cairo_save", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.restore = function (): void {
    call(LIB, "cairo_restore", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.translate = function (tx: number, ty: number): void {
    call(
        LIB,
        "cairo_translate",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: tx },
            { type: DOUBLE_TYPE, value: ty },
        ],
        { type: "undefined" },
    );
};

Context.prototype.scale = function (sx: number, sy: number): void {
    call(
        LIB,
        "cairo_scale",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: sx },
            { type: DOUBLE_TYPE, value: sy },
        ],
        { type: "undefined" },
    );
};

Context.prototype.rotate = function (angle: number): void {
    call(
        LIB,
        "cairo_rotate",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: angle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.setOperator = function (op: Operator): void {
    call(
        LIB,
        "cairo_set_operator",
        [
            { type: CAIRO_T, value: this.handle },
            { type: INT_TYPE, value: op },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getOperator = function (): Operator {
    return call(LIB, "cairo_get_operator", [{ type: CAIRO_T, value: this.handle }], INT_TYPE) as Operator;
};

Context.prototype.selectFontFace = function (family: string, slant: FontSlant, weight: FontWeight): void {
    call(
        LIB,
        "cairo_select_font_face",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: family },
            { type: INT_TYPE, value: slant },
            { type: INT_TYPE, value: weight },
        ],
        { type: "undefined" },
    );
};

Context.prototype.setFontSize = function (size: number): void {
    call(
        LIB,
        "cairo_set_font_size",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: size },
        ],
        { type: "undefined" },
    );
};

Context.prototype.showText = function (text: string): void {
    call(
        LIB,
        "cairo_show_text",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: text },
        ],
        { type: "undefined" },
    );
};

Context.prototype.textPath = function (text: string): void {
    call(
        LIB,
        "cairo_text_path",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: text },
        ],
        { type: "undefined" },
    );
};

export type { TextExtents, FontExtents };

Context.prototype.textExtents = function (text: string): TextExtents {
    const extents = alloc(48, "cairo_text_extents_t", LIB);
    call(
        LIB,
        "cairo_text_extents",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: text },
            {
                type: { type: "boxed", innerType: "cairo_text_extents_t", library: LIB, ownership: "borrowed" },
                value: extents,
            },
        ],
        { type: "undefined" },
    );
    return readTextExtents(extents);
};

Context.prototype.fontExtents = function (): FontExtents {
    const extents = alloc(40, "cairo_font_extents_t", LIB);
    call(
        LIB,
        "cairo_font_extents",
        [
            { type: CAIRO_T, value: this.handle },
            {
                type: { type: "boxed", innerType: "cairo_font_extents_t", library: LIB, ownership: "borrowed" },
                value: extents,
            },
        ],
        { type: "undefined" },
    );
    return readFontExtents(extents);
};

Context.prototype.setFontOptions = function (options: FontOptions): void {
    call(
        LIB,
        "cairo_set_font_options",
        [
            { type: CAIRO_T, value: this.handle },
            { type: FONT_OPTIONS_T, value: options.handle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getFontOptions = function (): FontOptions {
    const options = new FontOptionsConstructor();
    call(
        LIB,
        "cairo_get_font_options",
        [
            { type: CAIRO_T, value: this.handle },
            { type: FONT_OPTIONS_T, value: options.handle },
        ],
        { type: "undefined" },
    );
    return options;
};

Context.prototype.setAntialias = function (antialias: Antialias): void {
    call(
        LIB,
        "cairo_set_antialias",
        [
            { type: CAIRO_T, value: this.handle },
            { type: INT_TYPE, value: antialias },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getAntialias = function (): Antialias {
    return call(LIB, "cairo_get_antialias", [{ type: CAIRO_T, value: this.handle }], INT_TYPE) as Antialias;
};

Context.prototype.showPage = function (): void {
    call(LIB, "cairo_show_page", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.copyPage = function (): void {
    call(LIB, "cairo_copy_page", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.getTarget = function (): Surface {
    const ptr = call(LIB, "cairo_get_target", [{ type: CAIRO_T, value: this.handle }], SURFACE_T_NONE) as NativeHandle;
    return getNativeObject(ptr, Surface) as Surface;
};

Context.prototype.setSourceSurface = function (surface: Surface, x: number, y: number): void {
    call(
        LIB,
        "cairo_set_source_surface",
        [
            { type: CAIRO_T, value: this.handle },
            { type: SURFACE_T_NONE, value: surface.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
};

Context.prototype.hasCurrentPoint = function (): boolean {
    return call(LIB, "cairo_has_current_point", [{ type: CAIRO_T, value: this.handle }], {
        type: "boolean",
    }) as boolean;
};

Context.prototype.getCurrentPoint = function (): { x: number; y: number } | null {
    const hasPoint = this.hasCurrentPoint();

    if (!hasPoint) {
        return null;
    }

    const xRef = createRef(0.0);
    const yRef = createRef(0.0);

    call(
        LIB,
        "cairo_get_current_point",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: xRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: yRef },
        ],
        { type: "undefined" },
    );

    return {
        x: xRef.value,
        y: yRef.value,
    };
};

Context.prototype.getSource = function (): Pattern {
    const ptr = call(LIB, "cairo_get_source", [{ type: CAIRO_T, value: this.handle }], PATTERN_T_NONE) as NativeHandle;
    return getNativeObject(ptr, Pattern) as Pattern;
};

const getExtents = (ctx: Context, fn: string): { x1: number; y1: number; x2: number; y2: number } => {
    const x1Ref = createRef(0.0);
    const y1Ref = createRef(0.0);
    const x2Ref = createRef(0.0);
    const y2Ref = createRef(0.0);
    call(
        LIB,
        fn,
        [
            { type: CAIRO_T, value: ctx.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: x1Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: y1Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: x2Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: y2Ref },
        ],
        { type: "undefined" },
    );
    return { x1: x1Ref.value, y1: y1Ref.value, x2: x2Ref.value, y2: y2Ref.value };
};

Context.prototype.strokeExtents = function (): { x1: number; y1: number; x2: number; y2: number } {
    return getExtents(this, "cairo_stroke_extents");
};

Context.prototype.fillExtents = function (): { x1: number; y1: number; x2: number; y2: number } {
    return getExtents(this, "cairo_fill_extents");
};

Context.prototype.clipExtents = function (): { x1: number; y1: number; x2: number; y2: number } {
    return getExtents(this, "cairo_clip_extents");
};

Context.prototype.pathExtents = function (): { x1: number; y1: number; x2: number; y2: number } {
    return getExtents(this, "cairo_path_extents");
};

Context.prototype.inStroke = function (x: number, y: number): boolean {
    return call(
        LIB,
        "cairo_in_stroke",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "boolean" },
    ) as boolean;
};

Context.prototype.inFill = function (x: number, y: number): boolean {
    return call(
        LIB,
        "cairo_in_fill",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "boolean" },
    ) as boolean;
};

Context.prototype.inClip = function (x: number, y: number): boolean {
    return call(
        LIB,
        "cairo_in_clip",
        [
            { type: CAIRO_T, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "boolean" },
    ) as boolean;
};

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
    const listHandle = call(
        LIB,
        "cairo_copy_clip_rectangle_list",
        [{ type: CAIRO_T, value: this.handle }],
        RECT_LIST_T,
    );

    const numRectangles = read(listHandle, INT_TYPE, 16) as number;
    const result: Array<{ x: number; y: number; width: number; height: number }> = [];

    for (let i = 0; i < numRectangles; i++) {
        const rect = readPointer(listHandle, 8, i * 32);
        result.push({
            x: read(rect, DOUBLE_TYPE, 0) as number,
            y: read(rect, DOUBLE_TYPE, 8) as number,
            width: read(rect, DOUBLE_TYPE, 16) as number,
            height: read(rect, DOUBLE_TYPE, 24) as number,
        });
    }

    call(LIB, "cairo_rectangle_list_destroy", [{ type: RECT_LIST_T, value: listHandle }], { type: "undefined" });

    return result;
};

Context.prototype.mask = function (pattern: Pattern): void {
    call(
        LIB,
        "cairo_mask",
        [
            { type: CAIRO_T, value: this.handle },
            { type: PATTERN_T_NONE, value: pattern.handle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.maskSurface = function (surface: Surface, x: number, y: number): void {
    call(
        LIB,
        "cairo_mask_surface",
        [
            { type: CAIRO_T, value: this.handle },
            { type: SURFACE_T_NONE, value: surface.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
};

Context.prototype.setMatrix = function (matrix: Matrix): void {
    call(
        LIB,
        "cairo_set_matrix",
        [
            { type: CAIRO_T, value: this.handle },
            { type: MATRIX_T, value: matrix.handle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getMatrix = function (): Matrix {
    const { handle, obj } = allocMatrix();
    call(
        LIB,
        "cairo_get_matrix",
        [
            { type: CAIRO_T, value: this.handle },
            { type: MATRIX_T, value: handle },
        ],
        { type: "undefined" },
    );
    return obj;
};

Context.prototype.transform = function (matrix: Matrix): void {
    call(
        LIB,
        "cairo_transform",
        [
            { type: CAIRO_T, value: this.handle },
            { type: MATRIX_T, value: matrix.handle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.identityMatrix = function (): void {
    call(LIB, "cairo_identity_matrix", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

const coordTransform = (ctx: Context, fn: string, a: number, b: number): { a: number; b: number } => {
    const aRef = createRef(a);
    const bRef = createRef(b);
    call(
        LIB,
        fn,
        [
            { type: CAIRO_T, value: ctx.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: aRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: bRef },
        ],
        { type: "undefined" },
    );
    return { a: aRef.value, b: bRef.value };
};

Context.prototype.userToDevice = function (x: number, y: number): { x: number; y: number } {
    const r = coordTransform(this, "cairo_user_to_device", x, y);
    return { x: r.a, y: r.b };
};

Context.prototype.userToDeviceDistance = function (dx: number, dy: number): { dx: number; dy: number } {
    const r = coordTransform(this, "cairo_user_to_device_distance", dx, dy);
    return { dx: r.a, dy: r.b };
};

Context.prototype.deviceToUser = function (x: number, y: number): { x: number; y: number } {
    const r = coordTransform(this, "cairo_device_to_user", x, y);
    return { x: r.a, y: r.b };
};

Context.prototype.deviceToUserDistance = function (dx: number, dy: number): { dx: number; dy: number } {
    const r = coordTransform(this, "cairo_device_to_user_distance", dx, dy);
    return { dx: r.a, dy: r.b };
};

Context.prototype.status = function (): Status {
    return call(LIB, "cairo_status", [{ type: CAIRO_T, value: this.handle }], INT_TYPE) as Status;
};

declare module "../generated/cairo/context.js" {
    interface Context {
        pushGroup(): void;
        pushGroupWithContent(content: Content): void;
        popGroup(): Pattern;
        popGroupToSource(): void;
        getGroupTarget(): Surface;

        setFontFace(fontFace: FontFace): void;
        getFontFace(): FontFace;
        setFontMatrix(matrix: Matrix): void;
        getFontMatrix(): Matrix;
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

Context.prototype.pushGroup = function (): void {
    call(LIB, "cairo_push_group", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.pushGroupWithContent = function (content: Content): void {
    call(
        LIB,
        "cairo_push_group_with_content",
        [
            { type: CAIRO_T, value: this.handle },
            { type: INT_TYPE, value: content },
        ],
        { type: "undefined" },
    );
};

Context.prototype.popGroup = function (): Pattern {
    const ptr = call(LIB, "cairo_pop_group", [{ type: CAIRO_T, value: this.handle }], PATTERN_T) as NativeHandle;
    return getNativeObject(ptr, Pattern) as Pattern;
};

Context.prototype.popGroupToSource = function (): void {
    call(LIB, "cairo_pop_group_to_source", [{ type: CAIRO_T, value: this.handle }], { type: "undefined" });
};

Context.prototype.getGroupTarget = function (): Surface {
    const ptr = call(
        LIB,
        "cairo_get_group_target",
        [{ type: CAIRO_T, value: this.handle }],
        SURFACE_T_NONE,
    ) as NativeHandle;
    return getNativeObject(ptr, Surface) as Surface;
};

Context.prototype.setFontFace = function (fontFace: FontFace): void {
    call(
        LIB,
        "cairo_set_font_face",
        [
            { type: CAIRO_T, value: this.handle },
            { type: FONT_FACE_T_NONE, value: fontFace.handle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getFontFace = function (): FontFace {
    const ptr = call(
        LIB,
        "cairo_get_font_face",
        [{ type: CAIRO_T, value: this.handle }],
        FONT_FACE_T_NONE,
    ) as NativeHandle;
    return getNativeObject(ptr, FontFace) as FontFace;
};

Context.prototype.setFontMatrix = function (matrix: Matrix): void {
    call(
        LIB,
        "cairo_set_font_matrix",
        [
            { type: CAIRO_T, value: this.handle },
            { type: MATRIX_T, value: matrix.handle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getFontMatrix = function (): Matrix {
    const { handle, obj } = allocMatrix();
    call(
        LIB,
        "cairo_get_font_matrix",
        [
            { type: CAIRO_T, value: this.handle },
            { type: MATRIX_T, value: handle },
        ],
        { type: "undefined" },
    );
    return obj;
};

Context.prototype.setScaledFont = function (scaledFont: ScaledFont): void {
    call(
        LIB,
        "cairo_set_scaled_font",
        [
            { type: CAIRO_T, value: this.handle },
            { type: SCALED_FONT_T_NONE, value: scaledFont.handle },
        ],
        { type: "undefined" },
    );
};

Context.prototype.getScaledFont = function (): ScaledFont {
    const ptr = call(
        LIB,
        "cairo_get_scaled_font",
        [{ type: CAIRO_T, value: this.handle }],
        SCALED_FONT_T_NONE,
    ) as NativeHandle;
    return getNativeObject(ptr, ScaledFont) as ScaledFont;
};

Context.prototype.showGlyphs = function (glyphs: Array<{ index: number; x: number; y: number }>): void {
    const buf = allocGlyphBuffer(glyphs);
    call(
        LIB,
        "cairo_show_glyphs",
        [
            { type: CAIRO_T, value: this.handle },
            { type: GLYPH_BUF_T, value: buf },
            { type: INT_TYPE, value: glyphs.length },
        ],
        { type: "undefined" },
    );
};

Context.prototype.glyphPath = function (glyphs: Array<{ index: number; x: number; y: number }>): void {
    const buf = allocGlyphBuffer(glyphs);
    call(
        LIB,
        "cairo_glyph_path",
        [
            { type: CAIRO_T, value: this.handle },
            { type: GLYPH_BUF_T, value: buf },
            { type: INT_TYPE, value: glyphs.length },
        ],
        { type: "undefined" },
    );
};

Context.prototype.glyphExtents = function (glyphs: Array<{ index: number; x: number; y: number }>): TextExtents {
    const buf = allocGlyphBuffer(glyphs);
    const extents = alloc(48, "cairo_text_extents_t", LIB);
    call(
        LIB,
        "cairo_glyph_extents",
        [
            { type: CAIRO_T, value: this.handle },
            { type: GLYPH_BUF_T, value: buf },
            { type: INT_TYPE, value: glyphs.length },
            {
                type: { type: "boxed", innerType: "cairo_text_extents_t", library: LIB, ownership: "borrowed" },
                value: extents,
            },
        ],
        { type: "undefined" },
    );
    return readTextExtents(extents);
};

Context.prototype.copyPath = function (): PathData[] {
    const pathHandle = call(LIB, "cairo_copy_path", [{ type: CAIRO_T, value: this.handle }], PATH_STRUCT_T);
    return parsePath(pathHandle);
};

Context.prototype.copyPathFlat = function (): PathData[] {
    const pathHandle = call(LIB, "cairo_copy_path_flat", [{ type: CAIRO_T, value: this.handle }], PATH_STRUCT_T);
    return parsePath(pathHandle);
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

export const statusToString = (status: Status): string => {
    return call(LIB, "cairo_status_to_string", [{ type: INT_TYPE, value: status }], {
        type: "string",
        ownership: "borrowed",
    }) as string;
};

class ContextImpl extends Context {
    static override readonly glibTypeName: string = "CairoContext";

    constructor(surface: Surface) {
        super();
        this.handle = call(
            LIB,
            "cairo_create",
            [{ type: SURFACE_T_NONE, value: surface.handle }],
            CAIRO_T,
        ) as NativeHandle;
    }
}

export { ContextImpl as Context };

declare module "../generated/cairo/context.js" {
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

Context.prototype.tagBegin = function (tagName: string, attributes: string): void {
    call(
        LIB,
        "cairo_tag_begin",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: tagName },
            { type: { type: "string", ownership: "full" }, value: attributes },
        ],
        { type: "undefined" },
    );
};

Context.prototype.tagEnd = function (tagName: string): void {
    call(
        LIB,
        "cairo_tag_end",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: tagName },
        ],
        { type: "undefined" },
    );
};

Context.prototype.showTextGlyphs = function (
    text: string,
    glyphs: CairoGlyph[],
    clusters: CairoTextCluster[],
    clusterFlags: TextClusterFlags,
): void {
    const glyphBuf = allocGlyphBuffer(glyphs);
    const clusterBuf = allocClusterBuffer(clusters);
    const encoder = new TextEncoder();
    const utf8 = encoder.encode(text);
    call(
        LIB,
        "cairo_show_text_glyphs",
        [
            { type: CAIRO_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: text },
            { type: INT_TYPE, value: utf8.length },
            { type: GLYPH_BUF_T, value: glyphBuf },
            { type: INT_TYPE, value: glyphs.length },
            { type: CLUSTER_BUF_T, value: clusterBuf },
            { type: INT_TYPE, value: clusters.length },
            { type: INT_TYPE, value: clusterFlags },
        ],
        { type: "undefined" },
    );
};
