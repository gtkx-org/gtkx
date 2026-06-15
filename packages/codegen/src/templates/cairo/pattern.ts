import { getHandle, t, wrapHandle } from "@gtkx/ffi";
import type { NativeHandle } from "@gtkx/native";
import { type Extend, type Filter, Pattern, type PatternType, type Status, type Surface } from "../cairo.js";
import { type PathData, parsePath } from "./context.js";
import { allocMatrix, type Matrix as CairoMatrix } from "./matrix.js";

const { bind } = t;

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
    fill: (red: { value: number }, green: { value: number }, blue: { value: number }, alpha: { value: number }) => void,
): RgbaColor => {
    const redRef = { value: 0 };
    const greenRef = { value: 0 };
    const blueRef = { value: 0 };
    const alphaRef = { value: 0 };
    fill(redRef, greenRef, blueRef, alphaRef);
    return { red: redRef.value, green: greenRef.value, blue: blueRef.value, alpha: alphaRef.value };
};

declare module "../cairo.js" {
    interface Pattern {
        addColorStopRgb(offset: number, red: number, green: number, blue: number): void;
        addColorStopRgba(offset: number, red: number, green: number, blue: number, alpha: number): void;
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
        function createRadial(
            cx0: number,
            cy0: number,
            radius0: number,
            cx1: number,
            cy1: number,
            radius1: number,
        ): RadialPattern;
        function createMesh(): MeshPattern;
        function createForSurface(surface: Surface): Pattern;
    }
}

const cairoPatternAddColorStopRgb = bind(
    "libcairo.so.2",
    "cairo_pattern_add_color_stop_rgb",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Pattern.prototype.addColorStopRgb = function (offset: number, red: number, green: number, blue: number): void {
    cairoPatternAddColorStopRgb(getHandle(this), offset, red, green, blue);
};

const cairoPatternAddColorStopRgba = bind(
    "libcairo.so.2",
    "cairo_pattern_add_color_stop_rgba",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Pattern.prototype.addColorStopRgba = function (
    offset: number,
    red: number,
    green: number,
    blue: number,
    alpha: number,
): void {
    cairoPatternAddColorStopRgba(getHandle(this), offset, red, green, blue, alpha);
};

const cairoPatternGetColorStopCount = bind(
    "libcairo.so.2",
    "cairo_pattern_get_color_stop_count",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.ref(t.int32) },
    ],
    t.int32,
);
Pattern.prototype.getColorStopCount = function (): number {
    const countRef = { value: 0 };
    cairoPatternGetColorStopCount(getHandle(this), countRef);
    return countRef.value;
};

const cairoPatternGetColorStopRgba = bind(
    "libcairo.so.2",
    "cairo_pattern_get_color_stop_rgba",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.int32,
);
Pattern.prototype.getColorStopRgba = function (index: number): {
    offset: number;
    red: number;
    green: number;
    blue: number;
    alpha: number;
} {
    const offsetRef = { value: 0 };
    const redRef = { value: 0 };
    const greenRef = { value: 0 };
    const blueRef = { value: 0 };
    const alphaRef = { value: 0 };
    cairoPatternGetColorStopRgba(getHandle(this), index, offsetRef, redRef, greenRef, blueRef, alphaRef);
    return {
        offset: offsetRef.value,
        red: redRef.value,
        green: greenRef.value,
        blue: blueRef.value,
        alpha: alphaRef.value,
    };
};

const cairoPatternGetRgba = bind(
    "libcairo.so.2",
    "cairo_pattern_get_rgba",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.int32,
);
Pattern.prototype.getRgba = function (): RgbaColor {
    return readRgba((red, green, blue, alpha) => cairoPatternGetRgba(getHandle(this), red, green, blue, alpha));
};

const cairoPatternStatus = bind(
    "libcairo.so.2",
    "cairo_pattern_status",
    [{ type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") }],
    t.int32,
);
Pattern.prototype.status = function (): Status {
    return cairoPatternStatus(getHandle(this)) as Status;
};

const cairoPatternSetExtend = bind(
    "libcairo.so.2",
    "cairo_pattern_set_extend",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
Pattern.prototype.setExtend = function (extend: Extend): void {
    cairoPatternSetExtend(getHandle(this), extend);
};

const cairoPatternGetExtend = bind(
    "libcairo.so.2",
    "cairo_pattern_get_extend",
    [{ type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") }],
    t.int32,
);
Pattern.prototype.getExtend = function (): Extend {
    return cairoPatternGetExtend(getHandle(this)) as Extend;
};

const cairoPatternSetFilter = bind(
    "libcairo.so.2",
    "cairo_pattern_set_filter",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
    ],
    t.void,
);
Pattern.prototype.setFilter = function (filter: Filter): void {
    cairoPatternSetFilter(getHandle(this), filter);
};

const cairoPatternGetFilter = bind(
    "libcairo.so.2",
    "cairo_pattern_get_filter",
    [{ type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") }],
    t.int32,
);
Pattern.prototype.getFilter = function (): Filter {
    return cairoPatternGetFilter(getHandle(this)) as Filter;
};

const cairoPatternSetMatrix = bind(
    "libcairo.so.2",
    "cairo_pattern_set_matrix",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Pattern.prototype.setMatrix = function (matrix: CairoMatrix): void {
    cairoPatternSetMatrix(getHandle(this), getHandle(matrix));
};

const cairoPatternGetMatrix = bind(
    "libcairo.so.2",
    "cairo_pattern_get_matrix",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Pattern.prototype.getMatrix = function (): CairoMatrix {
    const { handle, obj } = allocMatrix();
    cairoPatternGetMatrix(getHandle(this), handle);
    return obj;
};

const cairoPatternGetType = bind(
    "libcairo.so.2",
    "cairo_pattern_get_type",
    [{ type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") }],
    t.int32,
);
Pattern.prototype.getType = function (): PatternType {
    return cairoPatternGetType(getHandle(this)) as PatternType;
};

const cairoPatternGetReferenceCount = bind(
    "libcairo.so.2",
    "cairo_pattern_get_reference_count",
    [{ type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") }],
    t.int32,
);
Pattern.prototype.getReferenceCount = function (): number {
    return cairoPatternGetReferenceCount(getHandle(this)) as number;
};

const cairoPatternGetLinearPoints = bind(
    "libcairo.so.2",
    "cairo_pattern_get_linear_points",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.int32,
);
const cairoPatternGetRadialCircles = bind(
    "libcairo.so.2",
    "cairo_pattern_get_radial_circles",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.int32,
);
const cairoMeshPatternBeginPatch = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_begin_patch",
    [{ type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") }],
    t.void,
);
const cairoMeshPatternEndPatch = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_end_patch",
    [{ type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") }],
    t.void,
);
const cairoMeshPatternMoveTo = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_move_to",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
const cairoMeshPatternLineTo = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_line_to",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
const cairoMeshPatternCurveTo = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_curve_to",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
const cairoMeshPatternSetControlPoint = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_set_control_point",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
const cairoMeshPatternSetCornerColorRgb = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_set_corner_color_rgb",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
const cairoMeshPatternSetCornerColorRgba = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_set_corner_color_rgba",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
const cairoMeshPatternGetPatchCount = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_get_patch_count",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.ref(t.int32) },
    ],
    t.int32,
);
const cairoMeshPatternGetPath = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_get_path",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
    ],
    t.boxed("cairo_path_t", "full", "libcairo.so.2", undefined, "cairo_path_destroy"),
);
const cairoMeshPatternGetControlPoint = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_get_control_point",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.int32,
);
const cairoMeshPatternGetCornerColorRgba = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_get_corner_color_rgba",
    [
        { type: t.boxed("CairoPattern", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type") },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.int32,
);

/**
 * Linear gradient pattern produced by {@link Pattern.createLinear}.
 */
export class LinearPattern extends Pattern {
    /**
     * Returns the endpoints of the gradient line.
     */
    getLinearPoints(): { x0: number; y0: number; x1: number; y1: number } {
        const x0Ref = { value: 0 };
        const y0Ref = { value: 0 };
        const x1Ref = { value: 0 };
        const y1Ref = { value: 0 };
        cairoPatternGetLinearPoints(getHandle(this), x0Ref, y0Ref, x1Ref, y1Ref);
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
        const x0Ref = { value: 0 };
        const y0Ref = { value: 0 };
        const r0Ref = { value: 0 };
        const x1Ref = { value: 0 };
        const y1Ref = { value: 0 };
        const r1Ref = { value: 0 };
        cairoPatternGetRadialCircles(getHandle(this), x0Ref, y0Ref, r0Ref, x1Ref, y1Ref, r1Ref);
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
        cairoMeshPatternBeginPatch(getHandle(this));
    }

    /**
     * Completes the current patch in the mesh pattern.
     */
    endPatch(): void {
        cairoMeshPatternEndPatch(getHandle(this));
    }

    /**
     * Defines the first point of the current patch.
     */
    moveTo(x: number, y: number): void {
        cairoMeshPatternMoveTo(getHandle(this), x, y);
    }

    /**
     * Adds a line segment to the current patch.
     */
    lineTo(x: number, y: number): void {
        cairoMeshPatternLineTo(getHandle(this), x, y);
    }

    /**
     * Adds a cubic Bézier segment to the current patch.
     */
    curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        cairoMeshPatternCurveTo(getHandle(this), x1, y1, x2, y2, x3, y3);
    }

    /**
     * Sets an internal control point of the current patch.
     */
    setControlPoint(pointNum: number, x: number, y: number): void {
        cairoMeshPatternSetControlPoint(getHandle(this), pointNum, x, y);
    }

    /**
     * Sets the RGB color of a corner of the current patch.
     */
    setCornerColorRgb(cornerNum: number, red: number, green: number, blue: number): void {
        cairoMeshPatternSetCornerColorRgb(getHandle(this), cornerNum, red, green, blue);
    }

    /**
     * Sets the RGBA color of a corner of the current patch.
     */
    setCornerColorRgba(cornerNum: number, red: number, green: number, blue: number, alpha: number): void {
        cairoMeshPatternSetCornerColorRgba(getHandle(this), cornerNum, red, green, blue, alpha);
    }

    /**
     * Returns the number of patches recorded in the mesh pattern.
     */
    getPatchCount(): number {
        const countRef = { value: 0 };
        cairoMeshPatternGetPatchCount(getHandle(this), countRef);
        return countRef.value;
    }

    /**
     * Returns the path defining the boundary of patch `patchNum`.
     */
    getPath(patchNum: number): PathData[] {
        return parsePath(cairoMeshPatternGetPath(getHandle(this), patchNum) as NativeHandle);
    }

    /**
     * Returns an internal control point of patch `patchNum`.
     */
    getControlPoint(patchNum: number, pointNum: number): { x: number; y: number } {
        const xRef = { value: 0 };
        const yRef = { value: 0 };
        cairoMeshPatternGetControlPoint(getHandle(this), patchNum, pointNum, xRef, yRef);
        return { x: xRef.value, y: yRef.value };
    }

    /**
     * Returns the RGBA color of a corner of patch `patchNum`.
     */
    getCornerColorRgba(patchNum: number, cornerNum: number): RgbaColor {
        return readRgba((red, green, blue, alpha) =>
            cairoMeshPatternGetCornerColorRgba(getHandle(this), patchNum, cornerNum, red, green, blue, alpha),
        );
    }
}

type PatternStatic = {
    createRgb(red: number, green: number, blue: number): Pattern;
    createRgba(red: number, green: number, blue: number, alpha: number): Pattern;
    createLinear(x0: number, y0: number, x1: number, y1: number): LinearPattern;
    createRadial(cx0: number, cy0: number, radius0: number, cx1: number, cy1: number, radius1: number): RadialPattern;
    createMesh(): MeshPattern;
    createForSurface(surface: Surface): Pattern;
};

const PatternWithStatics = Pattern as typeof Pattern & PatternStatic;

const cairoPatternCreateRgb = bind(
    "libcairo.so.2",
    "cairo_pattern_create_rgb",
    [{ type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.boxed("CairoPattern", "full", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type"),
);
PatternWithStatics.createRgb = (red: number, green: number, blue: number): Pattern => {
    return wrapHandle(cairoPatternCreateRgb(red, green, blue) as NativeHandle, Pattern);
};

const cairoPatternCreateRgba = bind(
    "libcairo.so.2",
    "cairo_pattern_create_rgba",
    [{ type: t.float64 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.boxed("CairoPattern", "full", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type"),
);
PatternWithStatics.createRgba = (red: number, green: number, blue: number, alpha: number): Pattern => {
    return wrapHandle(cairoPatternCreateRgba(red, green, blue, alpha) as NativeHandle, Pattern);
};

const cairoPatternCreateLinear = bind(
    "libcairo.so.2",
    "cairo_pattern_create_linear",
    [{ type: t.float64 }, { type: t.float64 }, { type: t.float64 }, { type: t.float64 }],
    t.boxed("CairoPattern", "full", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type"),
);
PatternWithStatics.createLinear = (x0: number, y0: number, x1: number, y1: number): LinearPattern => {
    return wrapHandle(cairoPatternCreateLinear(x0, y0, x1, y1) as NativeHandle, LinearPattern);
};

const cairoPatternCreateRadial = bind(
    "libcairo.so.2",
    "cairo_pattern_create_radial",
    [
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.boxed("CairoPattern", "full", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type"),
);
PatternWithStatics.createRadial = (
    cx0: number,
    cy0: number,
    radius0: number,
    cx1: number,
    cy1: number,
    radius1: number,
): RadialPattern => {
    return wrapHandle(cairoPatternCreateRadial(cx0, cy0, radius0, cx1, cy1, radius1) as NativeHandle, RadialPattern);
};

const cairoPatternCreateMesh = bind(
    "libcairo.so.2",
    "cairo_pattern_create_mesh",
    [],
    t.boxed("CairoPattern", "full", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type"),
);
PatternWithStatics.createMesh = (): MeshPattern => {
    return wrapHandle(cairoPatternCreateMesh() as NativeHandle, MeshPattern);
};

const cairoPatternCreateForSurface = bind(
    "libcairo.so.2",
    "cairo_pattern_create_for_surface",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.boxed("CairoPattern", "full", "libcairo-gobject.so.2", "cairo_gobject_pattern_get_type"),
);
PatternWithStatics.createForSurface = (surface: Surface): Pattern => {
    return wrapHandle(cairoPatternCreateForSurface(getHandle(surface)) as NativeHandle, Pattern);
};
