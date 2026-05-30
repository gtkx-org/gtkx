import { createRef, type NativeHandle, type Ref } from "@gtkx/native";
import {
    type Extend,
    type Filter,
    Pattern,
    type PatternType,
    type Status,
    type Surface,
} from "../generated/cairo/cairo.js";
import { getHandle } from "../handles.js";
import { t } from "../native.js";
import { wrapHandle } from "../registry.js";
import {
    DOUBLE_REF,
    DOUBLE_TYPE,
    INT_REF,
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
import { allocMatrix, type Matrix as CairoMatrix } from "./matrix.js";

const { fn } = t;

/**
 * RGBA color tuple shared by Pattern color APIs.
 */
export type RgbaColor = {
    red: number;
    green: number;
    blue: number;
    alpha: number;
};

/**
 * Allocates four `double` out-cells, runs `fill` to populate them through a
 * cairo `*_get_*_rgba` call, and reads them back as an {@link RgbaColor}.
 *
 * @param fill - Invokes the cairo getter with the four colour out-cells
 */
const readRgba = (
    fill: (red: Ref<number>, green: Ref<number>, blue: Ref<number>, alpha: Ref<number>) => void,
): RgbaColor => {
    const redRef = createRef(0);
    const greenRef = createRef(0);
    const blueRef = createRef(0);
    const alphaRef = createRef(0);
    fill(redRef, greenRef, blueRef, alphaRef);
    return { red: redRef.value, green: greenRef.value, blue: blueRef.value, alpha: alphaRef.value };
};

/**
 * Three control points of a cubic Bézier segment for {@link MeshPattern.curveTo}.
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
 * Offset/RGBA tuple for {@link Pattern.addColorStopRgba}.
 */
export type ColorStopRgba = {
    offset: number;
} & RgbaColor;

/**
 * Centres and radii of the two circles defining a radial gradient. See
 * {@link Pattern.createRadial}.
 */
export type RadialCircles = {
    cx0: number;
    cy0: number;
    radius0: number;
    cx1: number;
    cy1: number;
    radius1: number;
};

declare module "../generated/cairo/cairo.js" {
    interface Pattern {
        addColorStopRgb(offset: number, red: number, green: number, blue: number): void;
        addColorStopRgba(stop: ColorStopRgba): void;
        getColorStopCount(): number;
        getColorStopRgba(index: number): { offset: number; red: number; green: number; blue: number; alpha: number };
        getRgba(): { red: number; green: number; blue: number; alpha: number };
        status(): Status;
        setExtend(extend: Extend): void;
        getExtend(): Extend;
        setFilter(filter: Filter): void;
        getFilter(): Filter;
        setMatrix(matrix: CairoMatrix): void;
        getMatrix(): CairoMatrix;
        getType(): PatternType;
        getReferenceCount(): number;
    }

    namespace Pattern {
        function createRgb(red: number, green: number, blue: number): Pattern;
        function createRgba(red: number, green: number, blue: number, alpha: number): Pattern;
        function createLinear(x0: number, y0: number, x1: number, y1: number): LinearPattern;
        function createRadial(circles: RadialCircles): RadialPattern;
        function createMesh(): MeshPattern;
        function createForSurface(surface: Surface): Pattern;
    }
}

const cairo_pattern_add_color_stop_rgb = fn(
    LIB,
    "cairo_pattern_add_color_stop_rgb",
    [
        { type: PATTERN_T_NONE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    t.void,
);
Pattern.prototype.addColorStopRgb = function (offset: number, red: number, green: number, blue: number): void {
    cairo_pattern_add_color_stop_rgb(getHandle(this), offset, red, green, blue);
};

const cairo_pattern_add_color_stop_rgba = fn(
    LIB,
    "cairo_pattern_add_color_stop_rgba",
    [
        { type: PATTERN_T_NONE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    t.void,
);
Pattern.prototype.addColorStopRgba = function ({ offset, red, green, blue, alpha }: ColorStopRgba): void {
    cairo_pattern_add_color_stop_rgba(getHandle(this), offset, red, green, blue, alpha);
};

const cairo_pattern_get_color_stop_count = fn(
    LIB,
    "cairo_pattern_get_color_stop_count",
    [{ type: PATTERN_T_NONE }, { type: INT_REF }],
    INT_TYPE,
);
Pattern.prototype.getColorStopCount = function (): number {
    const countRef = createRef(0);
    cairo_pattern_get_color_stop_count(getHandle(this), countRef);
    return countRef.value;
};

const cairo_pattern_get_color_stop_rgba = fn(
    LIB,
    "cairo_pattern_get_color_stop_rgba",
    [
        { type: PATTERN_T_NONE },
        { type: INT_TYPE },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
    ],
    INT_TYPE,
);
Pattern.prototype.getColorStopRgba = function (index: number): {
    offset: number;
    red: number;
    green: number;
    blue: number;
    alpha: number;
} {
    const offsetRef = createRef(0);
    const redRef = createRef(0);
    const greenRef = createRef(0);
    const blueRef = createRef(0);
    const alphaRef = createRef(0);
    cairo_pattern_get_color_stop_rgba(getHandle(this), index, offsetRef, redRef, greenRef, blueRef, alphaRef);
    return {
        offset: offsetRef.value,
        red: redRef.value,
        green: greenRef.value,
        blue: blueRef.value,
        alpha: alphaRef.value,
    };
};

const cairo_pattern_get_rgba = fn(
    LIB,
    "cairo_pattern_get_rgba",
    [{ type: PATTERN_T_NONE }, { type: DOUBLE_REF }, { type: DOUBLE_REF }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    INT_TYPE,
);
Pattern.prototype.getRgba = function (): RgbaColor {
    return readRgba((red, green, blue, alpha) => cairo_pattern_get_rgba(getHandle(this), red, green, blue, alpha));
};

const cairo_pattern_status = fn(LIB, "cairo_pattern_status", [{ type: PATTERN_T_NONE }], INT_TYPE);
Pattern.prototype.status = function (): Status {
    return cairo_pattern_status(getHandle(this)) as Status;
};

const cairo_pattern_set_extend = fn(
    LIB,
    "cairo_pattern_set_extend",
    [{ type: PATTERN_T_NONE }, { type: INT_TYPE }],
    t.void,
);
Pattern.prototype.setExtend = function (extend: Extend): void {
    cairo_pattern_set_extend(getHandle(this), extend);
};

const cairo_pattern_get_extend = fn(LIB, "cairo_pattern_get_extend", [{ type: PATTERN_T_NONE }], INT_TYPE);
Pattern.prototype.getExtend = function (): Extend {
    return cairo_pattern_get_extend(getHandle(this)) as Extend;
};

const cairo_pattern_set_filter = fn(
    LIB,
    "cairo_pattern_set_filter",
    [{ type: PATTERN_T_NONE }, { type: INT_TYPE }],
    t.void,
);
Pattern.prototype.setFilter = function (filter: Filter): void {
    cairo_pattern_set_filter(getHandle(this), filter);
};

const cairo_pattern_get_filter = fn(LIB, "cairo_pattern_get_filter", [{ type: PATTERN_T_NONE }], INT_TYPE);
Pattern.prototype.getFilter = function (): Filter {
    return cairo_pattern_get_filter(getHandle(this)) as Filter;
};

const cairo_pattern_set_matrix = fn(
    LIB,
    "cairo_pattern_set_matrix",
    [{ type: PATTERN_T_NONE }, { type: MATRIX_T }],
    t.void,
);
Pattern.prototype.setMatrix = function (matrix: CairoMatrix): void {
    cairo_pattern_set_matrix(getHandle(this), getHandle(matrix));
};

const cairo_pattern_get_matrix = fn(
    LIB,
    "cairo_pattern_get_matrix",
    [{ type: PATTERN_T_NONE }, { type: MATRIX_T }],
    t.void,
);
Pattern.prototype.getMatrix = function (): CairoMatrix {
    const { handle, obj } = allocMatrix();
    cairo_pattern_get_matrix(getHandle(this), handle);
    return obj;
};

const cairo_pattern_get_type = fn(LIB, "cairo_pattern_get_type", [{ type: PATTERN_T_NONE }], INT_TYPE);
Pattern.prototype.getType = function (): PatternType {
    return cairo_pattern_get_type(getHandle(this)) as PatternType;
};

const cairo_pattern_get_reference_count = fn(
    LIB,
    "cairo_pattern_get_reference_count",
    [{ type: PATTERN_T_NONE }],
    INT_TYPE,
);
Pattern.prototype.getReferenceCount = function (): number {
    return cairo_pattern_get_reference_count(getHandle(this)) as number;
};

const cairo_pattern_get_linear_points = fn(
    LIB,
    "cairo_pattern_get_linear_points",
    [{ type: PATTERN_T_NONE }, { type: DOUBLE_REF }, { type: DOUBLE_REF }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    INT_TYPE,
);
const cairo_pattern_get_radial_circles = fn(
    LIB,
    "cairo_pattern_get_radial_circles",
    [
        { type: PATTERN_T_NONE },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
    ],
    INT_TYPE,
);
const cairo_mesh_pattern_begin_patch = fn(LIB, "cairo_mesh_pattern_begin_patch", [{ type: PATTERN_T_NONE }], t.void);
const cairo_mesh_pattern_end_patch = fn(LIB, "cairo_mesh_pattern_end_patch", [{ type: PATTERN_T_NONE }], t.void);
const cairo_mesh_pattern_move_to = fn(
    LIB,
    "cairo_mesh_pattern_move_to",
    [{ type: PATTERN_T_NONE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
const cairo_mesh_pattern_line_to = fn(
    LIB,
    "cairo_mesh_pattern_line_to",
    [{ type: PATTERN_T_NONE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
const cairo_mesh_pattern_curve_to = fn(
    LIB,
    "cairo_mesh_pattern_curve_to",
    [
        { type: PATTERN_T_NONE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    t.void,
);
const cairo_mesh_pattern_set_control_point = fn(
    LIB,
    "cairo_mesh_pattern_set_control_point",
    [{ type: PATTERN_T_NONE }, { type: INT_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
const cairo_mesh_pattern_set_corner_color_rgb = fn(
    LIB,
    "cairo_mesh_pattern_set_corner_color_rgb",
    [{ type: PATTERN_T_NONE }, { type: INT_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
const cairo_mesh_pattern_set_corner_color_rgba = fn(
    LIB,
    "cairo_mesh_pattern_set_corner_color_rgba",
    [
        { type: PATTERN_T_NONE },
        { type: INT_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    t.void,
);
const cairo_mesh_pattern_get_patch_count = fn(
    LIB,
    "cairo_mesh_pattern_get_patch_count",
    [{ type: PATTERN_T_NONE }, { type: INT_REF }],
    INT_TYPE,
);
const cairo_mesh_pattern_get_path = fn(
    LIB,
    "cairo_mesh_pattern_get_path",
    [{ type: PATTERN_T_NONE }, { type: INT_TYPE }],
    PATH_STRUCT_T,
);
const cairo_mesh_pattern_get_control_point = fn(
    LIB,
    "cairo_mesh_pattern_get_control_point",
    [{ type: PATTERN_T_NONE }, { type: INT_TYPE }, { type: INT_TYPE }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    INT_TYPE,
);
const cairo_mesh_pattern_get_corner_color_rgba = fn(
    LIB,
    "cairo_mesh_pattern_get_corner_color_rgba",
    [
        { type: PATTERN_T_NONE },
        { type: INT_TYPE },
        { type: INT_TYPE },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
        { type: DOUBLE_REF },
    ],
    INT_TYPE,
);

/**
 * Linear gradient pattern produced by {@link Pattern.createLinear}.
 */
export class LinearPattern extends Pattern {
    /**
     * Returns the endpoints of the gradient line.
     */
    getLinearPoints(): { x0: number; y0: number; x1: number; y1: number } {
        const x0Ref = createRef(0);
        const y0Ref = createRef(0);
        const x1Ref = createRef(0);
        const y1Ref = createRef(0);
        cairo_pattern_get_linear_points(getHandle(this), x0Ref, y0Ref, x1Ref, y1Ref);
        return { x0: x0Ref.value, y0: y0Ref.value, x1: x1Ref.value, y1: y1Ref.value };
    }
}

/**
 * Radial gradient pattern produced by {@link Pattern.createRadial}.
 */
export class RadialPattern extends Pattern {
    /**
     * Returns the centres and radii of the gradient circles.
     */
    getRadialCircles(): { x0: number; y0: number; r0: number; x1: number; y1: number; r1: number } {
        const x0Ref = createRef(0);
        const y0Ref = createRef(0);
        const r0Ref = createRef(0);
        const x1Ref = createRef(0);
        const y1Ref = createRef(0);
        const r1Ref = createRef(0);
        cairo_pattern_get_radial_circles(getHandle(this), x0Ref, y0Ref, r0Ref, x1Ref, y1Ref, r1Ref);
        return {
            x0: x0Ref.value,
            y0: y0Ref.value,
            r0: r0Ref.value,
            x1: x1Ref.value,
            y1: y1Ref.value,
            r1: r1Ref.value,
        };
    }
}

/**
 * Mesh gradient pattern produced by {@link Pattern.createMesh}.
 */
export class MeshPattern extends Pattern {
    /**
     * Begins a new patch in the mesh pattern.
     */
    beginPatch(): void {
        cairo_mesh_pattern_begin_patch(getHandle(this));
    }

    /**
     * Completes the current patch in the mesh pattern.
     */
    endPatch(): void {
        cairo_mesh_pattern_end_patch(getHandle(this));
    }

    /**
     * Defines the first point of the current patch.
     */
    moveTo(x: number, y: number): void {
        cairo_mesh_pattern_move_to(getHandle(this), x, y);
    }

    /**
     * Adds a line segment to the current patch.
     */
    lineTo(x: number, y: number): void {
        cairo_mesh_pattern_line_to(getHandle(this), x, y);
    }

    /**
     * Adds a cubic Bézier segment to the current patch.
     */
    curveTo(curve: BezierCurve): void {
        cairo_mesh_pattern_curve_to(getHandle(this), curve.x1, curve.y1, curve.x2, curve.y2, curve.x3, curve.y3);
    }

    /**
     * Sets an internal control point of the current patch.
     */
    setControlPoint(pointNum: number, x: number, y: number): void {
        cairo_mesh_pattern_set_control_point(getHandle(this), pointNum, x, y);
    }

    /**
     * Sets the RGB color of a corner of the current patch.
     */
    setCornerColorRgb(cornerNum: number, red: number, green: number, blue: number): void {
        cairo_mesh_pattern_set_corner_color_rgb(getHandle(this), cornerNum, red, green, blue);
    }

    /**
     * Sets the RGBA color of a corner of the current patch.
     */
    setCornerColorRgba(cornerNum: number, color: RgbaColor): void {
        cairo_mesh_pattern_set_corner_color_rgba(
            getHandle(this),
            cornerNum,
            color.red,
            color.green,
            color.blue,
            color.alpha,
        );
    }

    /**
     * Returns the number of patches recorded in the mesh pattern.
     */
    getPatchCount(): number {
        const countRef = createRef(0);
        cairo_mesh_pattern_get_patch_count(getHandle(this), countRef);
        return countRef.value;
    }

    /**
     * Returns the path defining the boundary of patch `patchNum`.
     */
    getPath(patchNum: number): PathData[] {
        return parsePath(cairo_mesh_pattern_get_path(getHandle(this), patchNum) as NativeHandle);
    }

    /**
     * Returns an internal control point of patch `patchNum`.
     */
    getControlPoint(patchNum: number, pointNum: number): { x: number; y: number } {
        const xRef = createRef(0);
        const yRef = createRef(0);
        cairo_mesh_pattern_get_control_point(getHandle(this), patchNum, pointNum, xRef, yRef);
        return { x: xRef.value, y: yRef.value };
    }

    /**
     * Returns the RGBA color of a corner of patch `patchNum`.
     */
    getCornerColorRgba(patchNum: number, cornerNum: number): RgbaColor {
        return readRgba((red, green, blue, alpha) =>
            cairo_mesh_pattern_get_corner_color_rgba(getHandle(this), patchNum, cornerNum, red, green, blue, alpha),
        );
    }
}

type PatternStatic = {
    createRgb(red: number, green: number, blue: number): Pattern;
    createRgba(red: number, green: number, blue: number, alpha: number): Pattern;
    createLinear(x0: number, y0: number, x1: number, y1: number): LinearPattern;
    createRadial(circles: RadialCircles): RadialPattern;
    createMesh(): MeshPattern;
    createForSurface(surface: Surface): Pattern;
};

const PatternWithStatics = Pattern as typeof Pattern & PatternStatic;

const cairo_pattern_create_rgb = fn(
    LIB,
    "cairo_pattern_create_rgb",
    [{ type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    PATTERN_T,
);
PatternWithStatics.createRgb = (red: number, green: number, blue: number): Pattern => {
    return wrapHandle(Pattern, cairo_pattern_create_rgb(red, green, blue) as NativeHandle);
};

const cairo_pattern_create_rgba = fn(
    LIB,
    "cairo_pattern_create_rgba",
    [{ type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    PATTERN_T,
);
PatternWithStatics.createRgba = (red: number, green: number, blue: number, alpha: number): Pattern => {
    return wrapHandle(Pattern, cairo_pattern_create_rgba(red, green, blue, alpha) as NativeHandle);
};

const cairo_pattern_create_linear = fn(
    LIB,
    "cairo_pattern_create_linear",
    [{ type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    PATTERN_T,
);
PatternWithStatics.createLinear = (x0: number, y0: number, x1: number, y1: number): LinearPattern => {
    return wrapHandle(LinearPattern, cairo_pattern_create_linear(x0, y0, x1, y1) as NativeHandle);
};

const cairo_pattern_create_radial = fn(
    LIB,
    "cairo_pattern_create_radial",
    [
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    PATTERN_T,
);
PatternWithStatics.createRadial = ({ cx0, cy0, radius0, cx1, cy1, radius1 }: RadialCircles): RadialPattern => {
    return wrapHandle(RadialPattern, cairo_pattern_create_radial(cx0, cy0, radius0, cx1, cy1, radius1) as NativeHandle);
};

const cairo_pattern_create_mesh = fn(LIB, "cairo_pattern_create_mesh", [], PATTERN_T);
PatternWithStatics.createMesh = (): MeshPattern => {
    return wrapHandle(MeshPattern, cairo_pattern_create_mesh() as NativeHandle);
};

const cairo_pattern_create_for_surface = fn(
    LIB,
    "cairo_pattern_create_for_surface",
    [{ type: SURFACE_T_NONE }],
    PATTERN_T,
);
PatternWithStatics.createForSurface = (surface: Surface): Pattern => {
    return wrapHandle(Pattern, cairo_pattern_create_for_surface(getHandle(surface)) as NativeHandle);
};
