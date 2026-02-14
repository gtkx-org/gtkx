import { createRef, type NativeHandle } from "@gtkx/native";
import type { Status } from "../generated/cairo/enums.js";
import { Matrix } from "../generated/cairo/matrix.js";
import { alloc, call, read } from "../native.js";
import { DOUBLE_TYPE, INT_TYPE, LIB, MATRIX_T } from "./common.js";

declare module "../generated/cairo/matrix.js" {
    interface Matrix {
        get xx(): number;
        get yx(): number;
        get xy(): number;
        get yy(): number;
        get x0(): number;
        get y0(): number;
        translate(tx: number, ty: number): void;
        scale(sx: number, sy: number): void;
        rotate(radians: number): void;
        invert(): Status;
        multiply(other: Matrix): Matrix;
        transformPoint(x: number, y: number): { x: number; y: number };
        transformDistance(dx: number, dy: number): { dx: number; dy: number };
    }
}

export const allocMatrix = (): { handle: unknown; obj: MatrixImpl } => {
    const handle = alloc(48, "cairo_matrix_t", LIB);
    const obj = Object.create(MatrixImpl.prototype) as MatrixImpl;
    obj.handle = handle as NativeHandle;
    return { handle, obj };
};

class MatrixImpl extends Matrix {
    static override readonly glibTypeName: string = "cairo_matrix_t";

    constructor();
    constructor(xx: number, yx: number, xy: number, yy: number, x0: number, y0: number);
    constructor(xx?: number, yx?: number, xy?: number, yy?: number, x0?: number, y0?: number) {
        super();
        this.handle = alloc(48, "cairo_matrix_t", LIB) as NativeHandle;
        if (xx === undefined) {
            call(LIB, "cairo_matrix_init_identity", [{ type: MATRIX_T, value: this.handle }], { type: "undefined" });
        } else {
            call(
                LIB,
                "cairo_matrix_init",
                [
                    { type: MATRIX_T, value: this.handle },
                    { type: DOUBLE_TYPE, value: xx },
                    { type: DOUBLE_TYPE, value: yx },
                    { type: DOUBLE_TYPE, value: xy },
                    { type: DOUBLE_TYPE, value: yy },
                    { type: DOUBLE_TYPE, value: x0 },
                    { type: DOUBLE_TYPE, value: y0 },
                ],
                { type: "undefined" },
            );
        }
    }

    static createTranslate(tx: number, ty: number): MatrixImpl {
        const { handle, obj } = allocMatrix();
        call(
            LIB,
            "cairo_matrix_init_translate",
            [
                { type: MATRIX_T, value: handle },
                { type: DOUBLE_TYPE, value: tx },
                { type: DOUBLE_TYPE, value: ty },
            ],
            { type: "undefined" },
        );
        return obj;
    }

    static createScale(sx: number, sy: number): MatrixImpl {
        const { handle, obj } = allocMatrix();
        call(
            LIB,
            "cairo_matrix_init_scale",
            [
                { type: MATRIX_T, value: handle },
                { type: DOUBLE_TYPE, value: sx },
                { type: DOUBLE_TYPE, value: sy },
            ],
            { type: "undefined" },
        );
        return obj;
    }

    static createRotate(radians: number): MatrixImpl {
        const { handle, obj } = allocMatrix();
        call(
            LIB,
            "cairo_matrix_init_rotate",
            [
                { type: MATRIX_T, value: handle },
                { type: DOUBLE_TYPE, value: radians },
            ],
            { type: "undefined" },
        );
        return obj;
    }
}

export { MatrixImpl as Matrix };

/**
 * `cairo_matrix_t` struct layout (48 bytes, 6 doubles):
 *   offset  0: double xx (x scale)
 *   offset  8: double yx (y shear)
 *   offset 16: double xy (x shear)
 *   offset 24: double yy (y scale)
 *   offset 32: double x0 (x translation)
 *   offset 40: double y0 (y translation)
 */
Object.defineProperties(Matrix.prototype, {
    xx: {
        get(this: Matrix) {
            return read(this.handle, DOUBLE_TYPE, 0) as number;
        },
    },
    yx: {
        get(this: Matrix) {
            return read(this.handle, DOUBLE_TYPE, 8) as number;
        },
    },
    xy: {
        get(this: Matrix) {
            return read(this.handle, DOUBLE_TYPE, 16) as number;
        },
    },
    yy: {
        get(this: Matrix) {
            return read(this.handle, DOUBLE_TYPE, 24) as number;
        },
    },
    x0: {
        get(this: Matrix) {
            return read(this.handle, DOUBLE_TYPE, 32) as number;
        },
    },
    y0: {
        get(this: Matrix) {
            return read(this.handle, DOUBLE_TYPE, 40) as number;
        },
    },
});

Matrix.prototype.translate = function (tx: number, ty: number): void {
    call(
        LIB,
        "cairo_matrix_translate",
        [
            { type: MATRIX_T, value: this.handle },
            { type: DOUBLE_TYPE, value: tx },
            { type: DOUBLE_TYPE, value: ty },
        ],
        { type: "undefined" },
    );
};

Matrix.prototype.scale = function (sx: number, sy: number): void {
    call(
        LIB,
        "cairo_matrix_scale",
        [
            { type: MATRIX_T, value: this.handle },
            { type: DOUBLE_TYPE, value: sx },
            { type: DOUBLE_TYPE, value: sy },
        ],
        { type: "undefined" },
    );
};

Matrix.prototype.rotate = function (radians: number): void {
    call(
        LIB,
        "cairo_matrix_rotate",
        [
            { type: MATRIX_T, value: this.handle },
            { type: DOUBLE_TYPE, value: radians },
        ],
        { type: "undefined" },
    );
};

Matrix.prototype.invert = function (): Status {
    return call(LIB, "cairo_matrix_invert", [{ type: MATRIX_T, value: this.handle }], INT_TYPE) as Status;
};

Matrix.prototype.multiply = function (other: Matrix): Matrix {
    const { handle, obj } = allocMatrix();
    call(
        LIB,
        "cairo_matrix_multiply",
        [
            { type: MATRIX_T, value: handle },
            { type: MATRIX_T, value: this.handle },
            { type: MATRIX_T, value: other.handle },
        ],
        { type: "undefined" },
    );
    return obj;
};

Matrix.prototype.transformPoint = function (x: number, y: number): { x: number; y: number } {
    const xRef = createRef(x);
    const yRef = createRef(y);
    call(
        LIB,
        "cairo_matrix_transform_point",
        [
            { type: MATRIX_T, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: xRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: yRef },
        ],
        { type: "undefined" },
    );
    return { x: xRef.value, y: yRef.value };
};

Matrix.prototype.transformDistance = function (dx: number, dy: number): { dx: number; dy: number } {
    const dxRef = createRef(dx);
    const dyRef = createRef(dy);
    call(
        LIB,
        "cairo_matrix_transform_distance",
        [
            { type: MATRIX_T, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: dxRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: dyRef },
        ],
        { type: "undefined" },
    );
    return { dx: dxRef.value, dy: dyRef.value };
};
