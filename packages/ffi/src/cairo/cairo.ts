import { alloc, call, read } from "@gtkx/native";
import type {
    Antialias,
    FillRule,
    FontSlant,
    FontWeight,
    HintMetrics,
    HintStyle,
    LineCap,
    LineJoin,
    Operator,
    SubpixelOrder,
} from "../generated/cairo/enums.js";
import { FontOptions } from "../generated/cairo/font-options.js";
import { getNativeObject } from "../native/object.js";

export { FontOptions };

const LIB = "libcairo.so.2";

const FONT_OPTIONS_T = { type: "boxed", innerType: "cairo_font_options_t", lib: LIB, borrowed: true } as const;
const CAIRO_T = { type: "boxed", innerType: "cairo_t", lib: LIB, borrowed: true } as const;
const PATTERN_T = { type: "boxed", innerType: "cairo_pattern_t", lib: LIB, borrowed: false } as const;
const PATTERN_T_BORROWED = { type: "boxed", innerType: "cairo_pattern_t", lib: LIB, borrowed: true } as const;

export function moveTo(cr: unknown, x: number, y: number): void {
    call(
        LIB,
        "cairo_move_to",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: x },
            { type: { type: "float", size: 64 }, value: y },
        ],
        { type: "undefined" },
    );
}

export function lineTo(cr: unknown, x: number, y: number): void {
    call(
        LIB,
        "cairo_line_to",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: x },
            { type: { type: "float", size: 64 }, value: y },
        ],
        { type: "undefined" },
    );
}

export function curveTo(cr: unknown, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    call(
        LIB,
        "cairo_curve_to",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: x1 },
            { type: { type: "float", size: 64 }, value: y1 },
            { type: { type: "float", size: 64 }, value: x2 },
            { type: { type: "float", size: 64 }, value: y2 },
            { type: { type: "float", size: 64 }, value: x3 },
            { type: { type: "float", size: 64 }, value: y3 },
        ],
        { type: "undefined" },
    );
}

export function arc(cr: unknown, xc: number, yc: number, radius: number, angle1: number, angle2: number): void {
    call(
        LIB,
        "cairo_arc",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: xc },
            { type: { type: "float", size: 64 }, value: yc },
            { type: { type: "float", size: 64 }, value: radius },
            { type: { type: "float", size: 64 }, value: angle1 },
            { type: { type: "float", size: 64 }, value: angle2 },
        ],
        { type: "undefined" },
    );
}

export function arcNegative(cr: unknown, xc: number, yc: number, radius: number, angle1: number, angle2: number): void {
    call(
        LIB,
        "cairo_arc_negative",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: xc },
            { type: { type: "float", size: 64 }, value: yc },
            { type: { type: "float", size: 64 }, value: radius },
            { type: { type: "float", size: 64 }, value: angle1 },
            { type: { type: "float", size: 64 }, value: angle2 },
        ],
        { type: "undefined" },
    );
}

export function rectangle(cr: unknown, x: number, y: number, width: number, height: number): void {
    call(
        LIB,
        "cairo_rectangle",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: x },
            { type: { type: "float", size: 64 }, value: y },
            { type: { type: "float", size: 64 }, value: width },
            { type: { type: "float", size: 64 }, value: height },
        ],
        { type: "undefined" },
    );
}

export function closePath(cr: unknown): void {
    call(LIB, "cairo_close_path", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function newPath(cr: unknown): void {
    call(LIB, "cairo_new_path", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function newSubPath(cr: unknown): void {
    call(LIB, "cairo_new_sub_path", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function stroke(cr: unknown): void {
    call(LIB, "cairo_stroke", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function strokePreserve(cr: unknown): void {
    call(LIB, "cairo_stroke_preserve", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function fill(cr: unknown): void {
    call(LIB, "cairo_fill", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function fillPreserve(cr: unknown): void {
    call(LIB, "cairo_fill_preserve", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function paint(cr: unknown): void {
    call(LIB, "cairo_paint", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function paintWithAlpha(cr: unknown, alpha: number): void {
    call(
        LIB,
        "cairo_paint_with_alpha",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: alpha },
        ],
        { type: "undefined" },
    );
}

export function setSourceRgb(cr: unknown, red: number, green: number, blue: number): void {
    call(
        LIB,
        "cairo_set_source_rgb",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: red },
            { type: { type: "float", size: 64 }, value: green },
            { type: { type: "float", size: 64 }, value: blue },
        ],
        { type: "undefined" },
    );
}

export function setSourceRgba(cr: unknown, red: number, green: number, blue: number, alpha: number): void {
    call(
        LIB,
        "cairo_set_source_rgba",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: red },
            { type: { type: "float", size: 64 }, value: green },
            { type: { type: "float", size: 64 }, value: blue },
            { type: { type: "float", size: 64 }, value: alpha },
        ],
        { type: "undefined" },
    );
}

export function setLineWidth(cr: unknown, width: number): void {
    call(
        LIB,
        "cairo_set_line_width",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: width },
        ],
        { type: "undefined" },
    );
}

export function setLineCap(cr: unknown, lineCap: LineCap): void {
    call(
        LIB,
        "cairo_set_line_cap",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "int", size: 32, unsigned: false }, value: lineCap },
        ],
        { type: "undefined" },
    );
}

export function setLineJoin(cr: unknown, lineJoin: LineJoin): void {
    call(
        LIB,
        "cairo_set_line_join",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "int", size: 32, unsigned: false }, value: lineJoin },
        ],
        { type: "undefined" },
    );
}

export function setFillRule(cr: unknown, fillRule: FillRule): void {
    call(
        LIB,
        "cairo_set_fill_rule",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "int", size: 32, unsigned: false }, value: fillRule },
        ],
        { type: "undefined" },
    );
}

export function getFillRule(cr: unknown): FillRule {
    return call(LIB, "cairo_get_fill_rule", [{ type: CAIRO_T, value: cr }], {
        type: "int",
        size: 32,
        unsigned: false,
    }) as FillRule;
}

export function setDash(cr: unknown, dashes: number[], offset: number): void {
    call(
        LIB,
        "cairo_set_dash",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "array", itemType: { type: "float", size: 64 } }, value: dashes },
            { type: { type: "int", size: 32, unsigned: false }, value: dashes.length },
            { type: { type: "float", size: 64 }, value: offset },
        ],
        { type: "undefined" },
    );
}

export function save(cr: unknown): void {
    call(LIB, "cairo_save", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function restore(cr: unknown): void {
    call(LIB, "cairo_restore", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function translate(cr: unknown, tx: number, ty: number): void {
    call(
        LIB,
        "cairo_translate",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: tx },
            { type: { type: "float", size: 64 }, value: ty },
        ],
        { type: "undefined" },
    );
}

export function scale(cr: unknown, sx: number, sy: number): void {
    call(
        LIB,
        "cairo_scale",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: sx },
            { type: { type: "float", size: 64 }, value: sy },
        ],
        { type: "undefined" },
    );
}

export function rotate(cr: unknown, angle: number): void {
    call(
        LIB,
        "cairo_rotate",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: angle },
        ],
        { type: "undefined" },
    );
}

export function clip(cr: unknown): void {
    call(LIB, "cairo_clip", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function clipPreserve(cr: unknown): void {
    call(LIB, "cairo_clip_preserve", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function resetClip(cr: unknown): void {
    call(LIB, "cairo_reset_clip", [{ type: CAIRO_T, value: cr }], { type: "undefined" });
}

export function setOperator(cr: unknown, op: Operator): void {
    call(
        LIB,
        "cairo_set_operator",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "int", size: 32, unsigned: false }, value: op },
        ],
        { type: "undefined" },
    );
}

export function patternCreateLinear(x0: number, y0: number, x1: number, y1: number): unknown {
    return call(
        LIB,
        "cairo_pattern_create_linear",
        [
            { type: { type: "float", size: 64 }, value: x0 },
            { type: { type: "float", size: 64 }, value: y0 },
            { type: { type: "float", size: 64 }, value: x1 },
            { type: { type: "float", size: 64 }, value: y1 },
        ],
        PATTERN_T,
    );
}

export function patternCreateRadial(
    cx0: number,
    cy0: number,
    radius0: number,
    cx1: number,
    cy1: number,
    radius1: number,
): unknown {
    return call(
        LIB,
        "cairo_pattern_create_radial",
        [
            { type: { type: "float", size: 64 }, value: cx0 },
            { type: { type: "float", size: 64 }, value: cy0 },
            { type: { type: "float", size: 64 }, value: radius0 },
            { type: { type: "float", size: 64 }, value: cx1 },
            { type: { type: "float", size: 64 }, value: cy1 },
            { type: { type: "float", size: 64 }, value: radius1 },
        ],
        PATTERN_T,
    );
}

export function patternAddColorStopRgb(
    pattern: unknown,
    offset: number,
    red: number,
    green: number,
    blue: number,
): void {
    call(
        LIB,
        "cairo_pattern_add_color_stop_rgb",
        [
            { type: PATTERN_T_BORROWED, value: pattern },
            { type: { type: "float", size: 64 }, value: offset },
            { type: { type: "float", size: 64 }, value: red },
            { type: { type: "float", size: 64 }, value: green },
            { type: { type: "float", size: 64 }, value: blue },
        ],
        { type: "undefined" },
    );
}

export function patternAddColorStopRgba(
    pattern: unknown,
    offset: number,
    red: number,
    green: number,
    blue: number,
    alpha: number,
): void {
    call(
        LIB,
        "cairo_pattern_add_color_stop_rgba",
        [
            { type: PATTERN_T_BORROWED, value: pattern },
            { type: { type: "float", size: 64 }, value: offset },
            { type: { type: "float", size: 64 }, value: red },
            { type: { type: "float", size: 64 }, value: green },
            { type: { type: "float", size: 64 }, value: blue },
            { type: { type: "float", size: 64 }, value: alpha },
        ],
        { type: "undefined" },
    );
}

export function patternDestroy(pattern: unknown): void {
    call(LIB, "cairo_pattern_destroy", [{ type: PATTERN_T_BORROWED, value: pattern }], { type: "undefined" });
}

export function setSource(cr: unknown, pattern: unknown): void {
    call(
        LIB,
        "cairo_set_source",
        [
            { type: CAIRO_T, value: cr },
            { type: PATTERN_T_BORROWED, value: pattern },
        ],
        { type: "undefined" },
    );
}

export function selectFontFace(cr: unknown, family: string, slant: FontSlant, weight: FontWeight): void {
    call(
        LIB,
        "cairo_select_font_face",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "string" }, value: family },
            { type: { type: "int", size: 32, unsigned: false }, value: slant },
            { type: { type: "int", size: 32, unsigned: false }, value: weight },
        ],
        { type: "undefined" },
    );
}

export function setFontSize(cr: unknown, size: number): void {
    call(
        LIB,
        "cairo_set_font_size",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "float", size: 64 }, value: size },
        ],
        { type: "undefined" },
    );
}

export function showText(cr: unknown, text: string): void {
    call(
        LIB,
        "cairo_show_text",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "string" }, value: text },
        ],
        { type: "undefined" },
    );
}

export function textPath(cr: unknown, text: string): void {
    call(
        LIB,
        "cairo_text_path",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "string" }, value: text },
        ],
        { type: "undefined" },
    );
}

export interface TextExtents {
    xBearing: number;
    yBearing: number;
    width: number;
    height: number;
    xAdvance: number;
    yAdvance: number;
}

const DOUBLE_TYPE = { type: "float", size: 64 } as const;

export function textExtents(cr: unknown, text: string): TextExtents {
    const extents = alloc(48, "cairo_text_extents_t", LIB);
    call(
        LIB,
        "cairo_text_extents",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "string" }, value: text },
            { type: { type: "boxed", innerType: "cairo_text_extents_t", lib: LIB, borrowed: true }, value: extents },
        ],
        { type: "undefined" },
    );
    return {
        xBearing: read(extents, DOUBLE_TYPE, 0) as number,
        yBearing: read(extents, DOUBLE_TYPE, 8) as number,
        width: read(extents, DOUBLE_TYPE, 16) as number,
        height: read(extents, DOUBLE_TYPE, 24) as number,
        xAdvance: read(extents, DOUBLE_TYPE, 32) as number,
        yAdvance: read(extents, DOUBLE_TYPE, 40) as number,
    };
}

export function fontOptionsCreate(): FontOptions {
    const ptr = call(LIB, "cairo_font_options_create", [], {
        type: "boxed",
        innerType: "cairo_font_options_t",
        lib: LIB,
        borrowed: false,
    });
    return getNativeObject(ptr, FontOptions)!;
}

export function fontOptionsDestroy(options: unknown): void {
    call(LIB, "cairo_font_options_destroy", [{ type: FONT_OPTIONS_T, value: options }], { type: "undefined" });
}

export function fontOptionsSetAntialias(options: unknown, antialias: Antialias): void {
    call(
        LIB,
        "cairo_font_options_set_antialias",
        [
            { type: FONT_OPTIONS_T, value: options },
            { type: { type: "int", size: 32, unsigned: false }, value: antialias },
        ],
        { type: "undefined" },
    );
}

export function fontOptionsGetAntialias(options: unknown): Antialias {
    return call(LIB, "cairo_font_options_get_antialias", [{ type: FONT_OPTIONS_T, value: options }], {
        type: "int",
        size: 32,
        unsigned: false,
    }) as Antialias;
}

export function fontOptionsSetHintStyle(options: unknown, hintStyle: HintStyle): void {
    call(
        LIB,
        "cairo_font_options_set_hint_style",
        [
            { type: FONT_OPTIONS_T, value: options },
            { type: { type: "int", size: 32, unsigned: false }, value: hintStyle },
        ],
        { type: "undefined" },
    );
}

export function fontOptionsGetHintStyle(options: unknown): HintStyle {
    return call(LIB, "cairo_font_options_get_hint_style", [{ type: FONT_OPTIONS_T, value: options }], {
        type: "int",
        size: 32,
        unsigned: false,
    }) as HintStyle;
}

export function fontOptionsSetHintMetrics(options: unknown, hintMetrics: HintMetrics): void {
    call(
        LIB,
        "cairo_font_options_set_hint_metrics",
        [
            { type: FONT_OPTIONS_T, value: options },
            { type: { type: "int", size: 32, unsigned: false }, value: hintMetrics },
        ],
        { type: "undefined" },
    );
}

export function fontOptionsGetHintMetrics(options: unknown): HintMetrics {
    return call(LIB, "cairo_font_options_get_hint_metrics", [{ type: FONT_OPTIONS_T, value: options }], {
        type: "int",
        size: 32,
        unsigned: false,
    }) as HintMetrics;
}

export function fontOptionsSetSubpixelOrder(options: unknown, subpixelOrder: SubpixelOrder): void {
    call(
        LIB,
        "cairo_font_options_set_subpixel_order",
        [
            { type: FONT_OPTIONS_T, value: options },
            { type: { type: "int", size: 32, unsigned: false }, value: subpixelOrder },
        ],
        { type: "undefined" },
    );
}

export function fontOptionsGetSubpixelOrder(options: unknown): SubpixelOrder {
    return call(LIB, "cairo_font_options_get_subpixel_order", [{ type: FONT_OPTIONS_T, value: options }], {
        type: "int",
        size: 32,
        unsigned: false,
    }) as SubpixelOrder;
}

export function setFontOptions(cr: unknown, options: unknown): void {
    call(
        LIB,
        "cairo_set_font_options",
        [
            { type: CAIRO_T, value: cr },
            { type: FONT_OPTIONS_T, value: options },
        ],
        { type: "undefined" },
    );
}

export function getFontOptions(cr: unknown): FontOptions {
    const options = fontOptionsCreate();
    call(
        LIB,
        "cairo_get_font_options",
        [
            { type: CAIRO_T, value: cr },
            { type: FONT_OPTIONS_T, value: options },
        ],
        { type: "undefined" },
    );
    return options;
}

export function setAntialias(cr: unknown, antialias: Antialias): void {
    call(
        LIB,
        "cairo_set_antialias",
        [
            { type: CAIRO_T, value: cr },
            { type: { type: "int", size: 32, unsigned: false }, value: antialias },
        ],
        { type: "undefined" },
    );
}

export function getAntialias(cr: unknown): Antialias {
    return call(LIB, "cairo_get_antialias", [{ type: CAIRO_T, value: cr }], {
        type: "int",
        size: 32,
        unsigned: false,
    }) as Antialias;
}
