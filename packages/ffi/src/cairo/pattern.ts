import { createRef, type NativeHandle } from "@gtkx/native";
import type { Extend, Filter, PatternType, Status } from "../generated/cairo/enums.js";
import type { Matrix } from "../generated/cairo/matrix.js";
import { Pattern } from "../generated/cairo/pattern.js";
import { Surface } from "../generated/cairo/surface.js";
import { call } from "../native.js";
import { getNativeObject } from "../registry.js";
import {
    DOUBLE_TYPE,
    INT_TYPE,
    LIB,
    MATRIX_T,
    PATH_STRUCT_T,
    PATTERN_T,
    PATTERN_T_NONE,
    type PathData,
    parsePath,
    SURFACE_T_NONE,
} from "./common.js";
import { allocMatrix } from "./matrix.js";

declare module "../generated/cairo/pattern.js" {
    interface Pattern {
        setFilter(filter: Filter): void;
        getFilter(): Filter;
        addColorStopRgb(offset: number, red: number, green: number, blue: number): void;
        addColorStopRgba(offset: number, red: number, green: number, blue: number, alpha: number): void;
        setExtend(extend: Extend): void;
        getExtend(): Extend;
        setMatrix(matrix: Matrix): void;
        getMatrix(): Matrix;
        getType(): PatternType;
    }
}

export class LinearPattern extends Pattern {
    static override readonly glibTypeName: string = "CairoPattern";

    constructor(x0: number, y0: number, x1: number, y1: number) {
        super();
        this.handle = call(
            LIB,
            "cairo_pattern_create_linear",
            [
                { type: DOUBLE_TYPE, value: x0 },
                { type: DOUBLE_TYPE, value: y0 },
                { type: DOUBLE_TYPE, value: x1 },
                { type: DOUBLE_TYPE, value: y1 },
            ],
            PATTERN_T,
        ) as NativeHandle;
    }
}

export class RadialPattern extends Pattern {
    static override readonly glibTypeName: string = "CairoPattern";

    constructor(cx0: number, cy0: number, radius0: number, cx1: number, cy1: number, radius1: number) {
        super();
        this.handle = call(
            LIB,
            "cairo_pattern_create_radial",
            [
                { type: DOUBLE_TYPE, value: cx0 },
                { type: DOUBLE_TYPE, value: cy0 },
                { type: DOUBLE_TYPE, value: radius0 },
                { type: DOUBLE_TYPE, value: cx1 },
                { type: DOUBLE_TYPE, value: cy1 },
                { type: DOUBLE_TYPE, value: radius1 },
            ],
            PATTERN_T,
        ) as NativeHandle;
    }
}

export class SurfacePattern extends Pattern {
    static override readonly glibTypeName: string = "CairoPattern";

    constructor(surface: Surface) {
        super();
        this.handle = call(
            LIB,
            "cairo_pattern_create_for_surface",
            [{ type: SURFACE_T_NONE, value: surface.handle }],
            PATTERN_T,
        ) as NativeHandle;
    }
}

export class SolidPattern extends Pattern {
    static override readonly glibTypeName: string = "CairoPattern";

    constructor(r: number, g: number, b: number, a?: number) {
        super();
        if (a === undefined) {
            this.handle = call(
                LIB,
                "cairo_pattern_create_rgb",
                [
                    { type: DOUBLE_TYPE, value: r },
                    { type: DOUBLE_TYPE, value: g },
                    { type: DOUBLE_TYPE, value: b },
                ],
                PATTERN_T,
            ) as NativeHandle;
        } else {
            this.handle = call(
                LIB,
                "cairo_pattern_create_rgba",
                [
                    { type: DOUBLE_TYPE, value: r },
                    { type: DOUBLE_TYPE, value: g },
                    { type: DOUBLE_TYPE, value: b },
                    { type: DOUBLE_TYPE, value: a },
                ],
                PATTERN_T,
            ) as NativeHandle;
        }
    }
}

Pattern.prototype.addColorStopRgb = function (offset: number, red: number, green: number, blue: number): void {
    call(
        LIB,
        "cairo_pattern_add_color_stop_rgb",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: offset },
            { type: DOUBLE_TYPE, value: red },
            { type: DOUBLE_TYPE, value: green },
            { type: DOUBLE_TYPE, value: blue },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.addColorStopRgba = function (
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
            { type: PATTERN_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: offset },
            { type: DOUBLE_TYPE, value: red },
            { type: DOUBLE_TYPE, value: green },
            { type: DOUBLE_TYPE, value: blue },
            { type: DOUBLE_TYPE, value: alpha },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.setFilter = function (filter: Filter): void {
    call(
        LIB,
        "cairo_pattern_set_filter",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: filter },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.getFilter = function (): Filter {
    return call(LIB, "cairo_pattern_get_filter", [{ type: PATTERN_T_NONE, value: this.handle }], INT_TYPE) as Filter;
};

Pattern.prototype.setExtend = function (extend: Extend): void {
    call(
        LIB,
        "cairo_pattern_set_extend",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: extend },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.getExtend = function (): Extend {
    return call(LIB, "cairo_pattern_get_extend", [{ type: PATTERN_T_NONE, value: this.handle }], INT_TYPE) as Extend;
};

Pattern.prototype.setMatrix = function (matrix: Matrix): void {
    call(
        LIB,
        "cairo_pattern_set_matrix",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: MATRIX_T, value: matrix.handle },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.getMatrix = function (): Matrix {
    const { handle, obj } = allocMatrix();
    call(
        LIB,
        "cairo_pattern_get_matrix",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: MATRIX_T, value: handle },
        ],
        { type: "undefined" },
    );
    return obj;
};

Pattern.prototype.getType = function (): PatternType {
    return call(LIB, "cairo_pattern_get_type", [{ type: PATTERN_T_NONE, value: this.handle }], INT_TYPE) as PatternType;
};

declare module "../generated/cairo/pattern.js" {
    interface Pattern {
        meshBeginPatch(): void;
        meshEndPatch(): void;
        meshMoveTo(x: number, y: number): void;
        meshLineTo(x: number, y: number): void;
        meshCurveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
        meshSetControlPoint(pointNum: number, x: number, y: number): void;
        meshSetCornerColorRgb(cornerNum: number, r: number, g: number, b: number): void;
        meshSetCornerColorRgba(cornerNum: number, r: number, g: number, b: number, a: number): void;
        meshGetPatchCount(): number;
        meshGetControlPoint(patchNum: number, pointNum: number): { x: number; y: number };
        meshGetCornerColorRgba(patchNum: number, cornerNum: number): { r: number; g: number; b: number; a: number };

        getColorStopCount(): number;
        getColorStopRgba(index: number): { offset: number; r: number; g: number; b: number; a: number };
        getRgba(): { r: number; g: number; b: number; a: number };
        getSurface(): Surface;
        getLinearPoints(): { x0: number; y0: number; x1: number; y1: number };
        getRadialCircles(): { x0: number; y0: number; r0: number; x1: number; y1: number; r1: number };
        status(): Status;
    }
}

export class MeshPattern extends Pattern {
    static override readonly glibTypeName: string = "CairoPattern";

    constructor() {
        super();
        this.handle = call(LIB, "cairo_pattern_create_mesh", [], PATTERN_T) as NativeHandle;
    }
}

Pattern.prototype.meshBeginPatch = function (): void {
    call(LIB, "cairo_mesh_pattern_begin_patch", [{ type: PATTERN_T_NONE, value: this.handle }], {
        type: "undefined",
    });
};

Pattern.prototype.meshEndPatch = function (): void {
    call(LIB, "cairo_mesh_pattern_end_patch", [{ type: PATTERN_T_NONE, value: this.handle }], {
        type: "undefined",
    });
};

Pattern.prototype.meshMoveTo = function (x: number, y: number): void {
    call(
        LIB,
        "cairo_mesh_pattern_move_to",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.meshLineTo = function (x: number, y: number): void {
    call(
        LIB,
        "cairo_mesh_pattern_line_to",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.meshCurveTo = function (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
): void {
    call(
        LIB,
        "cairo_mesh_pattern_curve_to",
        [
            { type: PATTERN_T_NONE, value: this.handle },
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

Pattern.prototype.meshSetControlPoint = function (pointNum: number, x: number, y: number): void {
    call(
        LIB,
        "cairo_mesh_pattern_set_control_point",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: pointNum },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.meshSetCornerColorRgb = function (cornerNum: number, r: number, g: number, b: number): void {
    call(
        LIB,
        "cairo_mesh_pattern_set_corner_color_rgb",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: cornerNum },
            { type: DOUBLE_TYPE, value: r },
            { type: DOUBLE_TYPE, value: g },
            { type: DOUBLE_TYPE, value: b },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.meshSetCornerColorRgba = function (
    cornerNum: number,
    r: number,
    g: number,
    b: number,
    a: number,
): void {
    call(
        LIB,
        "cairo_mesh_pattern_set_corner_color_rgba",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: cornerNum },
            { type: DOUBLE_TYPE, value: r },
            { type: DOUBLE_TYPE, value: g },
            { type: DOUBLE_TYPE, value: b },
            { type: DOUBLE_TYPE, value: a },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.meshGetPatchCount = function (): number {
    const countRef = createRef(0);
    call(
        LIB,
        "cairo_mesh_pattern_get_patch_count",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: INT_TYPE }, value: countRef },
        ],
        INT_TYPE,
    );
    return countRef.value;
};

Pattern.prototype.meshGetControlPoint = function (patchNum: number, pointNum: number): { x: number; y: number } {
    const xRef = createRef(0.0);
    const yRef = createRef(0.0);
    call(
        LIB,
        "cairo_mesh_pattern_get_control_point",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: patchNum },
            { type: INT_TYPE, value: pointNum },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: xRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: yRef },
        ],
        INT_TYPE,
    );
    return { x: xRef.value, y: yRef.value };
};

Pattern.prototype.meshGetCornerColorRgba = function (
    patchNum: number,
    cornerNum: number,
): { r: number; g: number; b: number; a: number } {
    const rRef = createRef(0.0);
    const gRef = createRef(0.0);
    const bRef = createRef(0.0);
    const aRef = createRef(0.0);
    call(
        LIB,
        "cairo_mesh_pattern_get_corner_color_rgba",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: patchNum },
            { type: INT_TYPE, value: cornerNum },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: rRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: gRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: bRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: aRef },
        ],
        INT_TYPE,
    );
    return { r: rRef.value, g: gRef.value, b: bRef.value, a: aRef.value };
};

Pattern.prototype.getColorStopCount = function (): number {
    const countRef = createRef(0);
    call(
        LIB,
        "cairo_pattern_get_color_stop_count",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: INT_TYPE }, value: countRef },
        ],
        INT_TYPE,
    );
    return countRef.value;
};

Pattern.prototype.getColorStopRgba = function (index: number): {
    offset: number;
    r: number;
    g: number;
    b: number;
    a: number;
} {
    const offsetRef = createRef(0.0);
    const rRef = createRef(0.0);
    const gRef = createRef(0.0);
    const bRef = createRef(0.0);
    const aRef = createRef(0.0);
    call(
        LIB,
        "cairo_pattern_get_color_stop_rgba",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: index },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: offsetRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: rRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: gRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: bRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: aRef },
        ],
        INT_TYPE,
    );
    return { offset: offsetRef.value, r: rRef.value, g: gRef.value, b: bRef.value, a: aRef.value };
};

Pattern.prototype.getRgba = function (): { r: number; g: number; b: number; a: number } {
    const rRef = createRef(0.0);
    const gRef = createRef(0.0);
    const bRef = createRef(0.0);
    const aRef = createRef(0.0);
    call(
        LIB,
        "cairo_pattern_get_rgba",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: rRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: gRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: bRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: aRef },
        ],
        INT_TYPE,
    );
    return { r: rRef.value, g: gRef.value, b: bRef.value, a: aRef.value };
};

Pattern.prototype.getSurface = function (): Surface {
    const surfRef = createRef<NativeHandle | null>(null);
    call(
        LIB,
        "cairo_pattern_get_surface",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: SURFACE_T_NONE }, value: surfRef },
        ],
        INT_TYPE,
    );
    return getNativeObject(surfRef.value as NativeHandle, Surface) as Surface;
};

Pattern.prototype.getLinearPoints = function (): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
} {
    const x0Ref = createRef(0.0);
    const y0Ref = createRef(0.0);
    const x1Ref = createRef(0.0);
    const y1Ref = createRef(0.0);
    call(
        LIB,
        "cairo_pattern_get_linear_points",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: x0Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: y0Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: x1Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: y1Ref },
        ],
        INT_TYPE,
    );
    return { x0: x0Ref.value, y0: y0Ref.value, x1: x1Ref.value, y1: y1Ref.value };
};

Pattern.prototype.getRadialCircles = function (): {
    x0: number;
    y0: number;
    r0: number;
    x1: number;
    y1: number;
    r1: number;
} {
    const x0Ref = createRef(0.0);
    const y0Ref = createRef(0.0);
    const r0Ref = createRef(0.0);
    const x1Ref = createRef(0.0);
    const y1Ref = createRef(0.0);
    const r1Ref = createRef(0.0);
    call(
        LIB,
        "cairo_pattern_get_radial_circles",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: x0Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: y0Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: r0Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: x1Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: y1Ref },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: r1Ref },
        ],
        INT_TYPE,
    );
    return {
        x0: x0Ref.value,
        y0: y0Ref.value,
        r0: r0Ref.value,
        x1: x1Ref.value,
        y1: y1Ref.value,
        r1: r1Ref.value,
    };
};

Pattern.prototype.status = function (): Status {
    return call(LIB, "cairo_pattern_status", [{ type: PATTERN_T_NONE, value: this.handle }], INT_TYPE) as Status;
};

export enum Dither {
    NONE = 0,
    DEFAULT = 1,
    FAST = 2,
    GOOD = 3,
    BEST = 4,
}

declare module "../generated/cairo/pattern.js" {
    interface Pattern {
        meshGetPath(patchNum: number): PathData[];
        setDither(dither: Dither): void;
        getDither(): Dither;
    }
}

Pattern.prototype.meshGetPath = function (patchNum: number): PathData[] {
    const pathHandle = call(
        LIB,
        "cairo_mesh_pattern_get_path",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: patchNum },
        ],
        PATH_STRUCT_T,
    );
    return parsePath(pathHandle);
};

Pattern.prototype.setDither = function (dither: Dither): void {
    call(
        LIB,
        "cairo_pattern_set_dither",
        [
            { type: PATTERN_T_NONE, value: this.handle },
            { type: INT_TYPE, value: dither },
        ],
        { type: "undefined" },
    );
};

Pattern.prototype.getDither = function (): Dither {
    return call(LIB, "cairo_pattern_get_dither", [{ type: PATTERN_T_NONE, value: this.handle }], INT_TYPE) as Dither;
};
