import {
    type ExternalObject,
    getHandle,
    type Handle,
    registerWrapperClass,
    registerWrapperClassResolver,
    t,
    wrapHandle,
    type WrapperClassResolver,
} from "@gtkx/runtime";
import type { Surface } from "./surface.js";
import type { ColorStop, LinearPoints, PathData, Point, RadialCircles, RgbaColor } from "./types.js";
import { type Extend, type Filter, PatternType, type Status } from "./enums.js";
import {
    bindCairo,
    type BoundFunction,
    cairoGType,
    MATRIX_T,
    PATH_T,
    PATTERN_FULL_T,
    PATTERN_T,
    SURFACE_T,
} from "./lib.js";
import { allocMatrix, Matrix } from "./matrix.js";
import { parsePath } from "./path.js";

type RgbaRefs = [
    red: { value: number },
    green: { value: number },
    blue: { value: number },
    alpha: { value: number },
];

const PATTERN_TYPE = cairoGType("cairo_gobject_pattern_get_type");
const FOUR_DOUBLES_OUT = [t.ref(t.float64), t.ref(t.float64), t.ref(t.float64), t.ref(t.float64)];
const POINT_ARGS = [PATTERN_T, t.float64, t.float64];
const cairoPatternCreateRgb = bindCairo("cairo_pattern_create_rgb", [t.float64, t.float64, t.float64], PATTERN_FULL_T);

const cairoPatternCreateRgba = bindCairo(
    "cairo_pattern_create_rgba",
    [t.float64, t.float64, t.float64, t.float64],
    PATTERN_FULL_T,
);

const cairoPatternCreateLinear = bindCairo(
    "cairo_pattern_create_linear",
    [t.float64, t.float64, t.float64, t.float64],
    PATTERN_FULL_T,
);

const cairoPatternCreateRadial = bindCairo(
    "cairo_pattern_create_radial",
    [t.float64, t.float64, t.float64, t.float64, t.float64, t.float64],
    PATTERN_FULL_T,
);

const cairoPatternCreateMesh = bindCairo("cairo_pattern_create_mesh", [], PATTERN_FULL_T);
const cairoPatternCreateForSurface = bindCairo("cairo_pattern_create_for_surface", [SURFACE_T], PATTERN_FULL_T);

const cairoPatternAddColorStopRgb = bindCairo(
    "cairo_pattern_add_color_stop_rgb",
    [PATTERN_T, t.float64, t.float64, t.float64, t.float64],
    t.void,
);

const cairoPatternAddColorStopRgba = bindCairo(
    "cairo_pattern_add_color_stop_rgba",
    [PATTERN_T, t.float64, t.float64, t.float64, t.float64, t.float64],
    t.void,
);

const cairoPatternGetColorStopCount = bindCairo(
    "cairo_pattern_get_color_stop_count",
    [PATTERN_T, t.ref(t.int32)],
    t.int32,
);

const cairoPatternGetColorStopRgba = bindCairo(
    "cairo_pattern_get_color_stop_rgba",
    [PATTERN_T, t.int32, t.ref(t.float64), ...FOUR_DOUBLES_OUT],
    t.int32,
);

const cairoPatternGetRgba = bindCairo("cairo_pattern_get_rgba", [PATTERN_T, ...FOUR_DOUBLES_OUT], t.int32);
const cairoPatternStatus = bindCairo("cairo_pattern_status", [PATTERN_T], t.int32);
const cairoPatternSetExtend = bindCairo("cairo_pattern_set_extend", [PATTERN_T, t.int32], t.void);
const cairoPatternGetExtend = bindCairo("cairo_pattern_get_extend", [PATTERN_T], t.int32);
const cairoPatternSetFilter = bindCairo("cairo_pattern_set_filter", [PATTERN_T, t.int32], t.void);
const cairoPatternGetFilter = bindCairo("cairo_pattern_get_filter", [PATTERN_T], t.int32);
const cairoPatternSetMatrix = bindCairo("cairo_pattern_set_matrix", [PATTERN_T, MATRIX_T], t.void);
const cairoPatternGetMatrix = bindCairo("cairo_pattern_get_matrix", [PATTERN_T, MATRIX_T], t.void);
const cairoPatternGetType = bindCairo("cairo_pattern_get_type", [PATTERN_T], t.int32);
const cairoPatternGetReferenceCount = bindCairo("cairo_pattern_get_reference_count", [PATTERN_T], t.int32);

const cairoPatternGetLinearPoints = bindCairo(
    "cairo_pattern_get_linear_points",
    [PATTERN_T, ...FOUR_DOUBLES_OUT],
    t.int32,
);

const cairoPatternGetRadialCircles = bindCairo(
    "cairo_pattern_get_radial_circles",
    [PATTERN_T, ...FOUR_DOUBLES_OUT, t.ref(t.float64), t.ref(t.float64)],
    t.int32,
);

const cairoMeshPatternBeginPatch = bindCairo("cairo_mesh_pattern_begin_patch", [PATTERN_T], t.void);
const cairoMeshPatternEndPatch = bindCairo("cairo_mesh_pattern_end_patch", [PATTERN_T], t.void);
const cairoMeshPatternMoveTo = bindCairo("cairo_mesh_pattern_move_to", POINT_ARGS, t.void);
const cairoMeshPatternLineTo = bindCairo("cairo_mesh_pattern_line_to", POINT_ARGS, t.void);

const cairoMeshPatternCurveTo = bindCairo(
    "cairo_mesh_pattern_curve_to",
    [PATTERN_T, t.float64, t.float64, t.float64, t.float64, t.float64, t.float64],
    t.void,
);

const cairoMeshPatternSetControlPoint = bindCairo(
    "cairo_mesh_pattern_set_control_point",
    [PATTERN_T, t.int32, t.float64, t.float64],
    t.void,
);

const cairoMeshPatternSetCornerColorRgb = bindCairo(
    "cairo_mesh_pattern_set_corner_color_rgb",
    [PATTERN_T, t.int32, t.float64, t.float64, t.float64],
    t.void,
);

const cairoMeshPatternSetCornerColorRgba = bindCairo(
    "cairo_mesh_pattern_set_corner_color_rgba",
    [PATTERN_T, t.int32, t.float64, t.float64, t.float64, t.float64],
    t.void,
);

const cairoMeshPatternGetPatchCount = bindCairo(
    "cairo_mesh_pattern_get_patch_count",
    [PATTERN_T, t.ref(t.int32)],
    t.int32,
);

const cairoMeshPatternGetPath = bindCairo("cairo_mesh_pattern_get_path", [PATTERN_T, t.int32], PATH_T);

const cairoMeshPatternGetControlPoint = bindCairo(
    "cairo_mesh_pattern_get_control_point",
    [PATTERN_T, t.int32, t.int32, t.ref(t.float64), t.ref(t.float64)],
    t.int32,
);

const cairoMeshPatternGetCornerColorRgba = bindCairo(
    "cairo_mesh_pattern_get_corner_color_rgba",
    [PATTERN_T, t.int32, t.int32, ...FOUR_DOUBLES_OUT],
    t.int32,
);

const wrapPattern = (handle: unknown): Pattern => wrapHandle(handle as ExternalObject<Handle>, Pattern);

const readRgba = (fill: (...refs: RgbaRefs) => void): RgbaColor => {
    const red = { value: 0 };
    const green = { value: 0 };
    const blue = { value: 0 };
    const alpha = { value: 0 };
    fill(red, green, blue, alpha);

    return { red: red.value, green: green.value, blue: blue.value, alpha: alpha.value };
};

const readCount = (boundFn: BoundFunction, self: object): number => {
    const count = { value: 0 };
    boundFn(getHandle(self), count);

    return count.value;
};

const patternClassFor: WrapperClassResolver = (handle) => {
    const type = cairoPatternGetType(handle) as PatternType;

    if (type === PatternType.LINEAR) {
        return LinearPattern;
    }

    if (type === PatternType.RADIAL) {
        return RadialPattern;
    }

    if (type === PatternType.MESH) {
        return MeshPattern;
    }

    return Pattern;
};

/**
 * A cairo pattern (`cairo_pattern_t`): the source a context paints with, such as a solid color, a gradient,
 * a mesh or another surface. Patterns come from the `create*` statics or from a context, and wrap as the
 * concrete class their type reports (`instanceof LinearPattern` for a linear gradient).
 */
abstract class Pattern {
    static {
        registerWrapperClass(this, PATTERN_TYPE);
        registerWrapperClassResolver(this, patternClassFor);
    }

    /** Creates an opaque solid-color pattern. */
    static createRgb(red: number, green: number, blue: number): Pattern {
        return wrapPattern(cairoPatternCreateRgb(red, green, blue));
    }

    /** Creates a translucent solid-color pattern. */
    static createRgba(red: number, green: number, blue: number, alpha: number): Pattern {
        return wrapPattern(cairoPatternCreateRgba(red, green, blue, alpha));
    }

    /** Creates a linear gradient between `(x0, y0)` and `(x1, y1)`; add stops with `addColorStopRgba`. */
    static createLinear(x0: number, y0: number, x1: number, y1: number): LinearPattern {
        return wrapHandle(cairoPatternCreateLinear(x0, y0, x1, y1) as ExternalObject<Handle>, LinearPattern);
    }

    /** Creates a radial gradient between two circles; add stops with `addColorStopRgba`. */
    static createRadial(
        cx0: number,
        cy0: number,
        radius0: number,
        cx1: number,
        cy1: number,
        radius1: number,
    ): RadialPattern {
        const handle = cairoPatternCreateRadial(cx0, cy0, radius0, cx1, cy1, radius1) as ExternalObject<Handle>;

        return wrapHandle(handle, RadialPattern);
    }

    /** Creates an empty mesh gradient; describe its patches with the `MeshPattern` methods. */
    static createMesh(): MeshPattern {
        return wrapHandle(cairoPatternCreateMesh() as ExternalObject<Handle>, MeshPattern);
    }

    /** Creates a pattern that paints with the content of `surface`. */
    static createForSurface(surface: Surface): Pattern {
        return wrapPattern(cairoPatternCreateForSurface(getHandle(surface)));
    }

    /** GType of `CairoPattern`, the boxed type this class is registered under. */
    declare __type__: bigint;

    /** Adds an opaque color stop at `offset` (0 to 1) to a gradient pattern. */
    addColorStopRgb(offset: number, red: number, green: number, blue: number): void {
        cairoPatternAddColorStopRgb(getHandle(this), offset, red, green, blue);
    }

    /** Adds a translucent color stop at `offset` (0 to 1) to a gradient pattern. */
    addColorStopRgba(offset: number, red: number, green: number, blue: number, alpha: number): void {
        cairoPatternAddColorStopRgba(getHandle(this), offset, red, green, blue, alpha);
    }

    /** Returns how many color stops a gradient pattern has. */
    getColorStopCount(): number {
        return readCount(cairoPatternGetColorStopCount, this);
    }

    /** Returns the color stop at `index` of a gradient pattern. */
    getColorStopRgba(index: number): ColorStop {
        const offset = { value: 0 };
        const color = readRgba((...refs) => cairoPatternGetColorStopRgba(getHandle(this), index, offset, ...refs));

        return { offset: offset.value, ...color };
    }

    /** Returns the color of a solid pattern. */
    getRgba(): RgbaColor {
        return readRgba((...refs) => cairoPatternGetRgba(getHandle(this), ...refs));
    }

    /** Returns the error status of the pattern, `Status.SUCCESS` when it is usable. */
    status(): Status {
        return cairoPatternStatus(getHandle(this)) as Status;
    }

    /** Sets how the pattern is extended outside its natural area. */
    setExtend(extend: Extend): void {
        cairoPatternSetExtend(getHandle(this), extend);
    }

    /** Returns how the pattern is extended outside its natural area. */
    getExtend(): Extend {
        return cairoPatternGetExtend(getHandle(this)) as Extend;
    }

    /** Sets the filter used when the pattern is resampled. */
    setFilter(filter: Filter): void {
        cairoPatternSetFilter(getHandle(this), filter);
    }

    /** Returns the filter used when the pattern is resampled. */
    getFilter(): Filter {
        return cairoPatternGetFilter(getHandle(this)) as Filter;
    }

    /** Sets the transformation from user space to pattern space. */
    setMatrix(matrix: Matrix): void {
        cairoPatternSetMatrix(getHandle(this), getHandle(matrix));
    }

    /** Returns the transformation from user space to pattern space. */
    getMatrix(): Matrix {
        const { handle, matrix } = allocMatrix();
        cairoPatternGetMatrix(getHandle(this), handle);

        return matrix;
    }

    /** Returns the kind of pattern this is. */
    getType(): PatternType {
        return cairoPatternGetType(getHandle(this)) as PatternType;
    }

    /** Returns the reference count of the pattern. */
    getReferenceCount(): number {
        return cairoPatternGetReferenceCount(getHandle(this)) as number;
    }
}

/** A linear gradient pattern, created with `Pattern.createLinear`. */
class LinearPattern extends Pattern {
    /** Returns the two end points of the gradient. */
    getLinearPoints(): LinearPoints {
        const x0 = { value: 0 };
        const y0 = { value: 0 };
        const x1 = { value: 0 };
        const y1 = { value: 0 };
        cairoPatternGetLinearPoints(getHandle(this), x0, y0, x1, y1);

        return { x0: x0.value, y0: y0.value, x1: x1.value, y1: y1.value };
    }
}

/** A radial gradient pattern, created with `Pattern.createRadial`. */
class RadialPattern extends Pattern {
    /** Returns the two circles of the gradient. */
    getRadialCircles(): RadialCircles {
        const x0 = { value: 0 };
        const y0 = { value: 0 };
        const r0 = { value: 0 };
        const x1 = { value: 0 };
        const y1 = { value: 0 };
        const r1 = { value: 0 };
        cairoPatternGetRadialCircles(getHandle(this), x0, y0, r0, x1, y1, r1);

        return { x0: x0.value, y0: y0.value, r0: r0.value, x1: x1.value, y1: y1.value, r1: r1.value };
    }
}

/**
 * A mesh gradient pattern, created with `Pattern.createMesh`: a set of Coons patches, each described between
 * `beginPatch` and `endPatch` by a path of up to four sides and the colors of its corners.
 */
class MeshPattern extends Pattern {
    /** Starts describing a new patch. */
    beginPatch(): void {
        cairoMeshPatternBeginPatch(getHandle(this));
    }

    /** Finishes the patch being described. */
    endPatch(): void {
        cairoMeshPatternEndPatch(getHandle(this));
    }

    /** Sets the first corner of the patch being described. */
    moveTo(x: number, y: number): void {
        cairoMeshPatternMoveTo(getHandle(this), x, y);
    }

    /** Adds a straight side from the previous corner to `(x, y)`. */
    lineTo(x: number, y: number): void {
        cairoMeshPatternLineTo(getHandle(this), x, y);
    }

    /** Adds a curved side from the previous corner through two control points to `(x3, y3)`. */
    curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        cairoMeshPatternCurveTo(getHandle(this), x1, y1, x2, y2, x3, y3);
    }

    /** Sets an interior control point (0 to 3) of the patch being described. */
    setControlPoint(pointNum: number, x: number, y: number): void {
        cairoMeshPatternSetControlPoint(getHandle(this), pointNum, x, y);
    }

    /** Sets the opaque color of a corner (0 to 3) of the patch being described. */
    setCornerColorRgb(cornerNum: number, red: number, green: number, blue: number): void {
        cairoMeshPatternSetCornerColorRgb(getHandle(this), cornerNum, red, green, blue);
    }

    /** Sets the translucent color of a corner (0 to 3) of the patch being described. */
    setCornerColorRgba(cornerNum: number, red: number, green: number, blue: number, alpha: number): void {
        cairoMeshPatternSetCornerColorRgba(getHandle(this), cornerNum, red, green, blue, alpha);
    }

    /** Returns how many patches have been finished. */
    getPatchCount(): number {
        return readCount(cairoMeshPatternGetPatchCount, this);
    }

    /** Returns the path around patch `patchNum`. */
    getPath(patchNum: number): PathData[] {
        return parsePath(cairoMeshPatternGetPath(getHandle(this), patchNum) as ExternalObject<Handle>);
    }

    /** Returns control point `pointNum` of patch `patchNum`. */
    getControlPoint(patchNum: number, pointNum: number): Point {
        const x = { value: 0 };
        const y = { value: 0 };
        cairoMeshPatternGetControlPoint(getHandle(this), patchNum, pointNum, x, y);

        return { x: x.value, y: y.value };
    }

    /** Returns the color of corner `cornerNum` of patch `patchNum`. */
    getCornerColorRgba(patchNum: number, cornerNum: number): RgbaColor {
        return readRgba((...refs) => cairoMeshPatternGetCornerColorRgba(getHandle(this), patchNum, cornerNum, ...refs));
    }
}

export { LinearPattern, MeshPattern, Pattern, RadialPattern };
