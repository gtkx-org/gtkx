import { getHandle, setHandle, t, wrapHandle } from "@gtkx/ffi";
import { alloc, type NativeHandle } from "@gtkx/native";
import type { Status } from "../cairo.js";

const { bind } = t;

export const allocMatrix = (): { handle: NativeHandle; obj: Matrix } => {
    const handle = alloc(48, "cairo_matrix_t");
    const obj = wrapHandle(handle, Matrix);
    return { handle, obj };
};

const cairo_matrix_translate = bind(
    "libcairo.so.2",
    "cairo_matrix_translate",
    [{ type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);
const cairo_matrix_scale = bind(
    "libcairo.so.2",
    "cairo_matrix_scale",
    [{ type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);
const cairo_matrix_rotate = bind(
    "libcairo.so.2",
    "cairo_matrix_rotate",
    [{ type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") }, { type: t.float64 }],
    t.void,
);
const cairo_matrix_invert = bind(
    "libcairo.so.2",
    "cairo_matrix_invert",
    [{ type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") }],
    t.int32,
);
const cairo_matrix_multiply = bind(
    "libcairo.so.2",
    "cairo_matrix_multiply",
    [
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
const cairo_matrix_transform_point = bind(
    "libcairo.so.2",
    "cairo_matrix_transform_point",
    [
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.void,
);
const cairo_matrix_transform_distance = bind(
    "libcairo.so.2",
    "cairo_matrix_transform_distance",
    [
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.void,
);
const cairo_matrix_init_identity = bind(
    "libcairo.so.2",
    "cairo_matrix_init_identity",
    [{ type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") }],
    t.void,
);
const cairo_matrix_init_translate = bind(
    "libcairo.so.2",
    "cairo_matrix_init_translate",
    [{ type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);
const cairo_matrix_init_scale = bind(
    "libcairo.so.2",
    "cairo_matrix_init_scale",
    [{ type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") }, { type: t.float64 }, { type: t.float64 }],
    t.void,
);
const cairo_matrix_init_rotate = bind(
    "libcairo.so.2",
    "cairo_matrix_init_rotate",
    [{ type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") }, { type: t.float64 }],
    t.void,
);
const cairo_matrix_init = bind(
    "libcairo.so.2",
    "cairo_matrix_init",
    [
        { type: t.boxed("cairo_matrix_t", "borrowed", "libcairo.so.2") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
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
        cairo_matrix_init(handle, xx, yx, xy, yy, x0, y0);
    }

    /**
     * Applies a translation to the transformation in `this` by `(tx, ty)`.
     */
    translate(tx: number, ty: number): void {
        cairo_matrix_translate(getHandle(this), tx, ty);
    }

    /**
     * Applies scaling by `(sx, sy)` to the transformation in `this`.
     */
    scale(sx: number, sy: number): void {
        cairo_matrix_scale(getHandle(this), sx, sy);
    }

    /**
     * Applies a rotation by `radians` to the transformation in `this`.
     */
    rotate(radians: number): void {
        cairo_matrix_rotate(getHandle(this), radians);
    }

    /**
     * Inverts the transformation in `this`, returning the resulting status.
     */
    invert(): Status {
        return cairo_matrix_invert(getHandle(this)) as Status;
    }

    /**
     * Transforms the point `(x, y)` by the transformation in `this`.
     */
    transformPoint(x: number, y: number): { x: number; y: number } {
        const xRef = { value: x };
        const yRef = { value: y };
        cairo_matrix_transform_point(getHandle(this), xRef, yRef);
        return { x: xRef.value, y: yRef.value };
    }

    /**
     * Transforms the distance vector `(dx, dy)` by the transformation in `this`.
     */
    transformDistance(dx: number, dy: number): { dx: number; dy: number } {
        const dxRef = { value: dx };
        const dyRef = { value: dy };
        cairo_matrix_transform_distance(getHandle(this), dxRef, dyRef);
        return { dx: dxRef.value, dy: dyRef.value };
    }

    /**
     * Allocates a matrix initialized to the identity transformation.
     */
    static initIdentity(): Matrix {
        const { handle, obj } = allocMatrix();
        cairo_matrix_init_identity(handle);
        return obj;
    }

    /**
     * Allocates a matrix initialized to a translation by `(tx, ty)`.
     */
    static initTranslate(tx: number, ty: number): Matrix {
        const { handle, obj } = allocMatrix();
        cairo_matrix_init_translate(handle, tx, ty);
        return obj;
    }

    /**
     * Allocates a matrix initialized to a scaling by `(sx, sy)`.
     */
    static initScale(sx: number, sy: number): Matrix {
        const { handle, obj } = allocMatrix();
        cairo_matrix_init_scale(handle, sx, sy);
        return obj;
    }

    /**
     * Allocates a matrix initialized to a rotation by `radians`.
     */
    static initRotate(radians: number): Matrix {
        const { handle, obj } = allocMatrix();
        cairo_matrix_init_rotate(handle, radians);
        return obj;
    }

    /**
     * Allocates a matrix holding the product of matrices `a` and `b`.
     */
    static multiply(a: Matrix, b: Matrix): Matrix {
        const { handle, obj } = allocMatrix();
        cairo_matrix_multiply(handle, getHandle(a), getHandle(b));
        return obj;
    }
}
