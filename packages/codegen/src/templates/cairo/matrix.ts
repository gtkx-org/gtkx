import { getHandle, setHandle, t, wrapHandle } from "@gtkx/ffi";
import { alloc, type Handle } from "@gtkx/native";
import type { Status } from "../cairo.js";

const { bind } = t;

export const allocMatrix = (): { handle: Handle; obj: Matrix } => {
    const handle = alloc(48, "cairo_matrix_t");
    const obj = wrapHandle(handle, Matrix);
    return { handle, obj };
};

const cairoMatrixTranslate = bind(
    "libcairo.so.2",
    "cairo_matrix_translate",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"), t.float64, t.float64],
    t.void,
);
const cairoMatrixScale = bind(
    "libcairo.so.2",
    "cairo_matrix_scale",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"), t.float64, t.float64],
    t.void,
);
const cairoMatrixRotate = bind(
    "libcairo.so.2",
    "cairo_matrix_rotate",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"), t.float64],
    t.void,
);
const cairoMatrixInvert = bind(
    "libcairo.so.2",
    "cairo_matrix_invert",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2")],
    t.int32,
);
const cairoMatrixMultiply = bind(
    "libcairo.so.2",
    "cairo_matrix_multiply",
    [
        t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"),
        t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"),
        t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"),
    ],
    t.void,
);
const cairoMatrixTransformPoint = bind(
    "libcairo.so.2",
    "cairo_matrix_transform_point",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"), t.ref(t.float64), t.ref(t.float64)],
    t.void,
);
const cairoMatrixTransformDistance = bind(
    "libcairo.so.2",
    "cairo_matrix_transform_distance",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"), t.ref(t.float64), t.ref(t.float64)],
    t.void,
);
const cairoMatrixInitIdentity = bind(
    "libcairo.so.2",
    "cairo_matrix_init_identity",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2")],
    t.void,
);
const cairoMatrixInitTranslate = bind(
    "libcairo.so.2",
    "cairo_matrix_init_translate",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"), t.float64, t.float64],
    t.void,
);
const cairoMatrixInitScale = bind(
    "libcairo.so.2",
    "cairo_matrix_init_scale",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"), t.float64, t.float64],
    t.void,
);
const cairoMatrixInitRotate = bind(
    "libcairo.so.2",
    "cairo_matrix_init_rotate",
    [t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"), t.float64],
    t.void,
);
const cairoMatrixInit = bind(
    "libcairo.so.2",
    "cairo_matrix_init",
    [
        t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2"),
        t.float64,
        t.float64,
        t.float64,
        t.float64,
        t.float64,
        t.float64,
    ],
    t.void,
);

/**
 * Cairo affine transformation matrix backed by the `cairo_matrix_t` C struct.
 *
 * The struct is treated as an opaque 48-byte block accessed through cairo's
 * own functions. Instances are produced by the static `init*` factories and
 * mutated in place by the prototype methods.
 */
export class Matrix {
    /**
     * Allocates a matrix initialized to the components `(xx, yx, xy, yy, x0, y0)`,
     * where `(xx, yx, xy, yy)` is the linear transformation and `(x0, y0)` the
     * translation.
     *
     * @param xx - Component `xx` of the affine transformation
     * @param yx - Component `yx` of the affine transformation
     * @param xy - Component `xy` of the affine transformation
     * @param yy - Component `yy` of the affine transformation
     * @param x0 - Translation in the X direction
     * @param y0 - Translation in the Y direction
     */
    constructor(xx: number, yx: number, xy: number, yy: number, x0: number, y0: number) {
        const handle = alloc(48, "cairo_matrix_t");
        setHandle(this, handle);
        cairoMatrixInit(handle, xx, yx, xy, yy, x0, y0);
    }

    /**
     * Applies a translation to the transformation in `this` by `(tx, ty)`.
     */
    translate(tx: number, ty: number): void {
        cairoMatrixTranslate(getHandle(this), tx, ty);
    }

    /**
     * Applies scaling by `(sx, sy)` to the transformation in `this`.
     */
    scale(sx: number, sy: number): void {
        cairoMatrixScale(getHandle(this), sx, sy);
    }

    /**
     * Applies a rotation by `radians` to the transformation in `this`.
     */
    rotate(radians: number): void {
        cairoMatrixRotate(getHandle(this), radians);
    }

    /**
     * Inverts the transformation in `this`, returning the resulting status.
     */
    invert(): Status {
        return cairoMatrixInvert(getHandle(this)) as Status;
    }

    /**
     * Transforms the point `(x, y)` by the transformation in `this`.
     */
    transformPoint(x: number, y: number): { x: number; y: number } {
        const xRef = { value: x };
        const yRef = { value: y };
        cairoMatrixTransformPoint(getHandle(this), xRef, yRef);
        return { x: xRef.value, y: yRef.value };
    }

    /**
     * Transforms the distance vector `(dx, dy)` by the transformation in `this`.
     */
    transformDistance(dx: number, dy: number): { dx: number; dy: number } {
        const dxRef = { value: dx };
        const dyRef = { value: dy };
        cairoMatrixTransformDistance(getHandle(this), dxRef, dyRef);
        return { dx: dxRef.value, dy: dyRef.value };
    }

    /**
     * Allocates a matrix initialized to the identity transformation.
     */
    static initIdentity(): Matrix {
        const { handle, obj } = allocMatrix();
        cairoMatrixInitIdentity(handle);
        return obj;
    }

    /**
     * Allocates a matrix initialized to a translation by `(tx, ty)`.
     */
    static initTranslate(tx: number, ty: number): Matrix {
        const { handle, obj } = allocMatrix();
        cairoMatrixInitTranslate(handle, tx, ty);
        return obj;
    }

    /**
     * Allocates a matrix initialized to a scaling by `(sx, sy)`.
     */
    static initScale(sx: number, sy: number): Matrix {
        const { handle, obj } = allocMatrix();
        cairoMatrixInitScale(handle, sx, sy);
        return obj;
    }

    /**
     * Allocates a matrix initialized to a rotation by `radians`.
     */
    static initRotate(radians: number): Matrix {
        const { handle, obj } = allocMatrix();
        cairoMatrixInitRotate(handle, radians);
        return obj;
    }

    /**
     * Allocates a matrix holding the product of matrices `a` and `b`.
     */
    static multiply(a: Matrix, b: Matrix): Matrix {
        const { handle, obj } = allocMatrix();
        cairoMatrixMultiply(handle, getHandle(a), getHandle(b));
        return obj;
    }
}
