import { type ExternalObject, getHandle, type Handle, t, wrapHandle } from "@gtkx/runtime";
import type { Surface } from "../base.js";
import type { Extend, Filter, PatternType, Status } from "../enums.js";
import type { PathData, RgbaColor } from "../types.js";
import { Pattern } from "../base.js";
import { parsePath } from "../path.js";
import { allocMatrix, type Matrix as CairoMatrix } from "./matrix.js";

const { bind } = t;
const PATTERN_T = t.boxed("CairoPattern", {
    ownership: "borrowed",
    sharedLibrary: "libcairo-gobject.so.2",
    getTypeFnName: "cairo_gobject_pattern_get_type",
});

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

declare module "../base.js" {
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
    [PATTERN_T, t.float64, t.float64, t.float64, t.float64],
    t.void,
);
Pattern.prototype.addColorStopRgb = function (offset: number, red: number, green: number, blue: number): void {
    cairoPatternAddColorStopRgb(getHandle(this), offset, red, green, blue);
};

const cairoPatternAddColorStopRgba = bind(
    "libcairo.so.2",
    "cairo_pattern_add_color_stop_rgba",
    [PATTERN_T, t.float64, t.float64, t.float64, t.float64, t.float64],
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
    [PATTERN_T, t.ref(t.int32)],
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
    [PATTERN_T, t.int32, t.ref(t.float64), t.ref(t.float64), t.ref(t.float64), t.ref(t.float64), t.ref(t.float64)],
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
    [PATTERN_T, t.ref(t.float64), t.ref(t.float64), t.ref(t.float64), t.ref(t.float64)],
    t.int32,
);
Pattern.prototype.getRgba = function (): RgbaColor {
    return readRgba((red, green, blue, alpha) => cairoPatternGetRgba(getHandle(this), red, green, blue, alpha));
};

const cairoPatternStatus = bind("libcairo.so.2", "cairo_pattern_status", [PATTERN_T], t.int32);
Pattern.prototype.status = function (): Status {
    return cairoPatternStatus(getHandle(this)) as Status;
};

const cairoPatternSetExtend = bind("libcairo.so.2", "cairo_pattern_set_extend", [PATTERN_T, t.int32], t.void);
Pattern.prototype.setExtend = function (extend: Extend): void {
    cairoPatternSetExtend(getHandle(this), extend);
};

const cairoPatternGetExtend = bind("libcairo.so.2", "cairo_pattern_get_extend", [PATTERN_T], t.int32);
Pattern.prototype.getExtend = function (): Extend {
    return cairoPatternGetExtend(getHandle(this)) as Extend;
};

const cairoPatternSetFilter = bind("libcairo.so.2", "cairo_pattern_set_filter", [PATTERN_T, t.int32], t.void);
Pattern.prototype.setFilter = function (filter: Filter): void {
    cairoPatternSetFilter(getHandle(this), filter);
};

const cairoPatternGetFilter = bind("libcairo.so.2", "cairo_pattern_get_filter", [PATTERN_T], t.int32);
Pattern.prototype.getFilter = function (): Filter {
    return cairoPatternGetFilter(getHandle(this)) as Filter;
};

const cairoPatternSetMatrix = bind(
    "libcairo.so.2",
    "cairo_pattern_set_matrix",
    [PATTERN_T, t.boxed("cairo_matrix_t", { ownership: "borrowed", sharedLibrary: "libcairo.so.2" })],
    t.void,
);
Pattern.prototype.setMatrix = function (matrix: CairoMatrix): void {
    cairoPatternSetMatrix(getHandle(this), getHandle(matrix));
};

const cairoPatternGetMatrix = bind(
    "libcairo.so.2",
    "cairo_pattern_get_matrix",
    [PATTERN_T, t.boxed("cairo_matrix_t", { ownership: "borrowed", sharedLibrary: "libcairo.so.2" })],
    t.void,
);
Pattern.prototype.getMatrix = function (): CairoMatrix {
    const { handle, obj } = allocMatrix();
    cairoPatternGetMatrix(getHandle(this), handle);
    return obj;
};

const cairoPatternGetType = bind("libcairo.so.2", "cairo_pattern_get_type", [PATTERN_T], t.int32);
Pattern.prototype.getType = function (): PatternType {
    return cairoPatternGetType(getHandle(this)) as PatternType;
};

const cairoPatternGetReferenceCount = bind("libcairo.so.2", "cairo_pattern_get_reference_count", [PATTERN_T], t.int32);
Pattern.prototype.getReferenceCount = function (): number {
    return cairoPatternGetReferenceCount(getHandle(this)) as number;
};

const cairoPatternGetLinearPoints = bind(
    "libcairo.so.2",
    "cairo_pattern_get_linear_points",
    [PATTERN_T, t.ref(t.float64), t.ref(t.float64), t.ref(t.float64), t.ref(t.float64)],
    t.int32,
);
const cairoPatternGetRadialCircles = bind(
    "libcairo.so.2",
    "cairo_pattern_get_radial_circles",
    [
        PATTERN_T,
        t.ref(t.float64),
        t.ref(t.float64),
        t.ref(t.float64),
        t.ref(t.float64),
        t.ref(t.float64),
        t.ref(t.float64),
    ],
    t.int32,
);
const cairoMeshPatternBeginPatch = bind("libcairo.so.2", "cairo_mesh_pattern_begin_patch", [PATTERN_T], t.void);
const cairoMeshPatternEndPatch = bind("libcairo.so.2", "cairo_mesh_pattern_end_patch", [PATTERN_T], t.void);
const cairoMeshPatternMoveTo = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_move_to",
    [PATTERN_T, t.float64, t.float64],
    t.void,
);
const cairoMeshPatternLineTo = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_line_to",
    [PATTERN_T, t.float64, t.float64],
    t.void,
);
const cairoMeshPatternCurveTo = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_curve_to",
    [PATTERN_T, t.float64, t.float64, t.float64, t.float64, t.float64, t.float64],
    t.void,
);
const cairoMeshPatternSetControlPoint = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_set_control_point",
    [PATTERN_T, t.int32, t.float64, t.float64],
    t.void,
);
const cairoMeshPatternSetCornerColorRgb = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_set_corner_color_rgb",
    [PATTERN_T, t.int32, t.float64, t.float64, t.float64],
    t.void,
);
const cairoMeshPatternSetCornerColorRgba = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_set_corner_color_rgba",
    [PATTERN_T, t.int32, t.float64, t.float64, t.float64, t.float64],
    t.void,
);
const cairoMeshPatternGetPatchCount = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_get_patch_count",
    [PATTERN_T, t.ref(t.int32)],
    t.int32,
);
const cairoMeshPatternGetPath = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_get_path",
    [PATTERN_T, t.int32],
    t.boxed("cairo_path_t", { ownership: "full", sharedLibrary: "libcairo.so.2", freeFnName: "cairo_path_destroy" }),
);
const cairoMeshPatternGetControlPoint = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_get_control_point",
    [PATTERN_T, t.int32, t.int32, t.ref(t.float64), t.ref(t.float64)],
    t.int32,
);
const cairoMeshPatternGetCornerColorRgba = bind(
    "libcairo.so.2",
    "cairo_mesh_pattern_get_corner_color_rgba",
    [PATTERN_T, t.int32, t.int32, t.ref(t.float64), t.ref(t.float64), t.ref(t.float64), t.ref(t.float64)],
    t.int32,
);

export class LinearPattern extends Pattern {
    getLinearPoints(): { x0: number; y0: number; x1: number; y1: number } {
        const x0Ref = { value: 0 };
        const y0Ref = { value: 0 };
        const x1Ref = { value: 0 };
        const y1Ref = { value: 0 };
        cairoPatternGetLinearPoints(getHandle(this), x0Ref, y0Ref, x1Ref, y1Ref);
        return { x0: x0Ref.value, y0: y0Ref.value, x1: x1Ref.value, y1: y1Ref.value };
    }
}

export class RadialPattern extends Pattern {
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

export class MeshPattern extends Pattern {
    beginPatch(): void {
        cairoMeshPatternBeginPatch(getHandle(this));
    }

    endPatch(): void {
        cairoMeshPatternEndPatch(getHandle(this));
    }

    moveTo(x: number, y: number): void {
        cairoMeshPatternMoveTo(getHandle(this), x, y);
    }

    lineTo(x: number, y: number): void {
        cairoMeshPatternLineTo(getHandle(this), x, y);
    }

    curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
        cairoMeshPatternCurveTo(getHandle(this), x1, y1, x2, y2, x3, y3);
    }

    setControlPoint(pointNum: number, x: number, y: number): void {
        cairoMeshPatternSetControlPoint(getHandle(this), pointNum, x, y);
    }

    setCornerColorRgb(cornerNum: number, red: number, green: number, blue: number): void {
        cairoMeshPatternSetCornerColorRgb(getHandle(this), cornerNum, red, green, blue);
    }

    setCornerColorRgba(cornerNum: number, red: number, green: number, blue: number, alpha: number): void {
        cairoMeshPatternSetCornerColorRgba(getHandle(this), cornerNum, red, green, blue, alpha);
    }

    getPatchCount(): number {
        const countRef = { value: 0 };
        cairoMeshPatternGetPatchCount(getHandle(this), countRef);
        return countRef.value;
    }

    getPath(patchNum: number): PathData[] {
        return parsePath(cairoMeshPatternGetPath(getHandle(this), patchNum) as ExternalObject<Handle>);
    }

    getControlPoint(patchNum: number, pointNum: number): { x: number; y: number } {
        const xRef = { value: 0 };
        const yRef = { value: 0 };
        cairoMeshPatternGetControlPoint(getHandle(this), patchNum, pointNum, xRef, yRef);
        return { x: xRef.value, y: yRef.value };
    }

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
    [t.float64, t.float64, t.float64],
    t.boxed("CairoPattern", {
        ownership: "full",
        sharedLibrary: "libcairo-gobject.so.2",
        getTypeFnName: "cairo_gobject_pattern_get_type",
    }),
);
PatternWithStatics.createRgb = (red: number, green: number, blue: number): Pattern => {
    return wrapHandle(cairoPatternCreateRgb(red, green, blue) as ExternalObject<Handle>, Pattern);
};

const cairoPatternCreateRgba = bind(
    "libcairo.so.2",
    "cairo_pattern_create_rgba",
    [t.float64, t.float64, t.float64, t.float64],
    t.boxed("CairoPattern", {
        ownership: "full",
        sharedLibrary: "libcairo-gobject.so.2",
        getTypeFnName: "cairo_gobject_pattern_get_type",
    }),
);
PatternWithStatics.createRgba = (red: number, green: number, blue: number, alpha: number): Pattern => {
    return wrapHandle(cairoPatternCreateRgba(red, green, blue, alpha) as ExternalObject<Handle>, Pattern);
};

const cairoPatternCreateLinear = bind(
    "libcairo.so.2",
    "cairo_pattern_create_linear",
    [t.float64, t.float64, t.float64, t.float64],
    t.boxed("CairoPattern", {
        ownership: "full",
        sharedLibrary: "libcairo-gobject.so.2",
        getTypeFnName: "cairo_gobject_pattern_get_type",
    }),
);
PatternWithStatics.createLinear = (x0: number, y0: number, x1: number, y1: number): LinearPattern => {
    return wrapHandle(cairoPatternCreateLinear(x0, y0, x1, y1) as ExternalObject<Handle>, LinearPattern);
};

const cairoPatternCreateRadial = bind(
    "libcairo.so.2",
    "cairo_pattern_create_radial",
    [t.float64, t.float64, t.float64, t.float64, t.float64, t.float64],
    t.boxed("CairoPattern", {
        ownership: "full",
        sharedLibrary: "libcairo-gobject.so.2",
        getTypeFnName: "cairo_gobject_pattern_get_type",
    }),
);
PatternWithStatics.createRadial = (
    cx0: number,
    cy0: number,
    radius0: number,
    cx1: number,
    cy1: number,
    radius1: number,
): RadialPattern => {
    return wrapHandle(cairoPatternCreateRadial(cx0, cy0, radius0, cx1, cy1, radius1) as ExternalObject<Handle>, RadialPattern);
};

const cairoPatternCreateMesh = bind(
    "libcairo.so.2",
    "cairo_pattern_create_mesh",
    [],
    t.boxed("CairoPattern", {
        ownership: "full",
        sharedLibrary: "libcairo-gobject.so.2",
        getTypeFnName: "cairo_gobject_pattern_get_type",
    }),
);
PatternWithStatics.createMesh = (): MeshPattern => {
    return wrapHandle(cairoPatternCreateMesh() as ExternalObject<Handle>, MeshPattern);
};

const cairoPatternCreateForSurface = bind(
    "libcairo.so.2",
    "cairo_pattern_create_for_surface",
    [
        t.boxed("CairoSurface", {
            ownership: "borrowed",
            sharedLibrary: "libcairo-gobject.so.2",
            getTypeFnName: "cairo_gobject_surface_get_type",
        }),
    ],
    t.boxed("CairoPattern", {
        ownership: "full",
        sharedLibrary: "libcairo-gobject.so.2",
        getTypeFnName: "cairo_gobject_pattern_get_type",
    }),
);
PatternWithStatics.createForSurface = (surface: Surface): Pattern => {
    return wrapHandle(cairoPatternCreateForSurface(getHandle(surface)) as ExternalObject<Handle>, Pattern);
};
