import { alloc, type ExternalObject, getHandle, type Handle, setHandle, t, wrapHandle } from "@gtkx/runtime";
import type { Status } from "./enums.js";
import type { Distance, Point } from "./types.js";
import { bindCairo, MATRIX_T } from "./lib.js";

type MatrixAllocation = { handle: ExternalObject<Handle>; matrix: Matrix };

const MATRIX_SIZE = 48;

const cairoMatrixInit = bindCairo(
    "cairo_matrix_init",
    [MATRIX_T, t.float64, t.float64, t.float64, t.float64, t.float64, t.float64],
    t.void,
);

const cairoMatrixInitIdentity = bindCairo("cairo_matrix_init_identity", [MATRIX_T], t.void);
const cairoMatrixInitTranslate = bindCairo("cairo_matrix_init_translate", [MATRIX_T, t.float64, t.float64], t.void);
const cairoMatrixInitScale = bindCairo("cairo_matrix_init_scale", [MATRIX_T, t.float64, t.float64], t.void);
const cairoMatrixInitRotate = bindCairo("cairo_matrix_init_rotate", [MATRIX_T, t.float64], t.void);
const cairoMatrixMultiply = bindCairo("cairo_matrix_multiply", [MATRIX_T, MATRIX_T, MATRIX_T], t.void);
const cairoMatrixTranslate = bindCairo("cairo_matrix_translate", [MATRIX_T, t.float64, t.float64], t.void);
const cairoMatrixScale = bindCairo("cairo_matrix_scale", [MATRIX_T, t.float64, t.float64], t.void);
const cairoMatrixRotate = bindCairo("cairo_matrix_rotate", [MATRIX_T, t.float64], t.void);
const cairoMatrixInvert = bindCairo("cairo_matrix_invert", [MATRIX_T], t.int32);

const cairoMatrixTransformPoint = bindCairo(
    "cairo_matrix_transform_point",
    [MATRIX_T, t.ref(t.float64), t.ref(t.float64)],
    t.void,
);

const cairoMatrixTransformDistance = bindCairo(
    "cairo_matrix_transform_distance",
    [MATRIX_T, t.ref(t.float64), t.ref(t.float64)],
    t.void,
);

const allocMatrix = (): MatrixAllocation => {
    const handle = alloc(MATRIX_SIZE);

    return { handle, matrix: wrapHandle(handle, Matrix) };
};

/**
 * An affine transformation (`cairo_matrix_t`) mapping user space to device space:
 * `x' = xx * x + xy * y + x0` and `y' = yx * x + yy * y + y0`.
 */
class Matrix {
    /** Returns the identity transformation. */
    static initIdentity(): Matrix {
        const { handle, matrix } = allocMatrix();
        cairoMatrixInitIdentity(handle);

        return matrix;
    }

    /** Returns a transformation translating by `tx` and `ty`. */
    static initTranslate(tx: number, ty: number): Matrix {
        const { handle, matrix } = allocMatrix();
        cairoMatrixInitTranslate(handle, tx, ty);

        return matrix;
    }

    /** Returns a transformation scaling by `sx` and `sy`. */
    static initScale(sx: number, sy: number): Matrix {
        const { handle, matrix } = allocMatrix();
        cairoMatrixInitScale(handle, sx, sy);

        return matrix;
    }

    /** Returns a transformation rotating by `radians`, positive angles turning from the X axis toward the Y axis. */
    static initRotate(radians: number): Matrix {
        const { handle, matrix } = allocMatrix();
        cairoMatrixInitRotate(handle, radians);

        return matrix;
    }

    /** Returns the product of `a` and `b`: the transformation that applies `a` first, then `b`. */
    static multiply(a: Matrix, b: Matrix): Matrix {
        const { handle, matrix } = allocMatrix();
        cairoMatrixMultiply(handle, getHandle(a), getHandle(b));

        return matrix;
    }

    /** Creates a matrix from its six affine components. */
    constructor(xx: number, yx: number, xy: number, yy: number, x0: number, y0: number) {
        const handle = alloc(MATRIX_SIZE);
        setHandle(this, handle);
        cairoMatrixInit(handle, xx, yx, xy, yy, x0, y0);
    }

    /** Applies a translation by `tx` and `ty` before the existing transformation. */
    translate(tx: number, ty: number): void {
        cairoMatrixTranslate(getHandle(this), tx, ty);
    }

    /** Applies a scaling by `sx` and `sy` before the existing transformation. */
    scale(sx: number, sy: number): void {
        cairoMatrixScale(getHandle(this), sx, sy);
    }

    /** Applies a rotation by `radians` before the existing transformation. */
    rotate(radians: number): void {
        cairoMatrixRotate(getHandle(this), radians);
    }

    /** Replaces the matrix with its inverse, returning `Status.INVALID_MATRIX` when it has none. */
    invert(): Status {
        return cairoMatrixInvert(getHandle(this)) as Status;
    }

    /** Transforms the point `(x, y)`, translation included. */
    transformPoint(x: number, y: number): Point {
        const xRef = { value: x };
        const yRef = { value: y };
        cairoMatrixTransformPoint(getHandle(this), xRef, yRef);

        return { x: xRef.value, y: yRef.value };
    }

    /** Transforms the distance vector `(dx, dy)`, ignoring translation. */
    transformDistance(dx: number, dy: number): Distance {
        const dxRef = { value: dx };
        const dyRef = { value: dy };
        cairoMatrixTransformDistance(getHandle(this), dxRef, dyRef);

        return { dx: dxRef.value, dy: dyRef.value };
    }
}

export { allocMatrix, Matrix };
