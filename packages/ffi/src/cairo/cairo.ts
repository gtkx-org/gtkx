

import { call } from "@gtkx/native";
import type { LineCap, LineJoin, Operator } from "../generated/cairo/enums.js";

const LIB = "libcairo.so.2";
const CAIRO_T = { type: "boxed", innerType: "cairo_t", lib: LIB, borrowed: true } as const;

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
