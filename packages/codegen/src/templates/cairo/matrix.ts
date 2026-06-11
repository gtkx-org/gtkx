import { getHandle, registerNativeClass, t, wrapHandle } from "@gtkx/ffi";
import { alloc, DOUBLE_REF, DOUBLE_TYPE, INT_TYPE, LIB, MATRIX_T, type NativeHandle } from "@gtkx/ffi/cairo";
import type { Status } from "@gtkx/gi/cairo/cairo.js";

const { fn } = t;

export const allocMatrix = (): { handle: NativeHandle; obj: Matrix } => {
    const handle = alloc(48, "cairo_matrix_t");
    const obj = wrapHandle(Matrix, handle);
    return { handle, obj };
};

const cairo_matrix_translate = fn(
    LIB,
    "cairo_matrix_translate",
    [{ type: MATRIX_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
const cairo_matrix_scale = fn(
    LIB,
    "cairo_matrix_scale",
    [{ type: MATRIX_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
const cairo_matrix_rotate = fn(LIB, "cairo_matrix_rotate", [{ type: MATRIX_T }, { type: DOUBLE_TYPE }], t.void);
const cairo_matrix_invert = fn(LIB, "cairo_matrix_invert", [{ type: MATRIX_T }], INT_TYPE);
const cairo_matrix_multiply = fn(
    LIB,
    "cairo_matrix_multiply",
    [{ type: MATRIX_T }, { type: MATRIX_T }, { type: MATRIX_T }],
    t.void,
);
const cairo_matrix_transform_point = fn(
    LIB,
    "cairo_matrix_transform_point",
    [{ type: MATRIX_T }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    t.void,
);
const cairo_matrix_transform_distance = fn(
    LIB,
    "cairo_matrix_transform_distance",
    [{ type: MATRIX_T }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    t.void,
);
const cairo_matrix_init_identity = fn(LIB, "cairo_matrix_init_identity", [{ type: MATRIX_T }], t.void);
const cairo_matrix_init_translate = fn(
    LIB,
    "cairo_matrix_init_translate",
    [{ type: MATRIX_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
const cairo_matrix_init_scale = fn(
    LIB,
    "cairo_matrix_init_scale",
    [{ type: MATRIX_T }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
const cairo_matrix_init_rotate = fn(
    LIB,
    "cairo_matrix_init_rotate",
    [{ type: MATRIX_T }, { type: DOUBLE_TYPE }],
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
    transformPoint(x: number, y: number): [number, number] {
        const xRef = { value: x };
        const yRef = { value: y };
        cairo_matrix_transform_point(getHandle(this), xRef, yRef);
        return [xRef.value, yRef.value];
    }

    /**
     * Transforms the distance vector `(dx, dy)` by the transformation in `this`.
     */
    transformDistance(dx: number, dy: number): [number, number] {
        const dxRef = { value: dx };
        const dyRef = { value: dy };
        cairo_matrix_transform_distance(getHandle(this), dxRef, dyRef);
        return [dxRef.value, dyRef.value];
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

registerNativeClass(Matrix, { role: "boxed" });
