import { getHandle, getNativeObject, t, wrapHandle } from "@gtkx/ffi";
import type { RegionOverlap, Status } from "@gtkx/gi/cairo/cairo.js";
import { RectangleInt, Region } from "@gtkx/gi/cairo/cairo.js";
import { alloc, type NativeHandle, write } from "@gtkx/native";
import { INT_TYPE, LIB, RECT_INT_T, REGION_T, REGION_T_NONE } from "./common.js";

const { fn } = t;
const RECT_INT_ARRAY_T = t.boxed("cairo_rectangle_int_t[]", "borrowed", LIB);

declare module "@gtkx/gi/cairo/cairo.js" {
    interface Region {
        copy(): Region;
        status(): Status;
        getExtents(): RectangleInt;
        numRectangles(): number;
        getRectangle(nth: number): RectangleInt;
        isEmpty(): boolean;
        containsPoint(x: number, y: number): boolean;
        containsRectangle(rect: RectangleInt): RegionOverlap;
        equal(other: Region): boolean;
        translate(dx: number, dy: number): void;
        intersect(other: Region): void;
        intersectRectangle(rect: RectangleInt): void;
        subtract(other: Region): void;
        subtractRectangle(rect: RectangleInt): void;
        union(other: Region): void;
        unionRectangle(rect: RectangleInt): void;
        xor(other: Region): void;
        xorRectangle(rect: RectangleInt): void;
    }
}

const cairo_region_create = fn(LIB, "cairo_region_create", [], REGION_T);
const cairo_region_create_rectangle = fn(LIB, "cairo_region_create_rectangle", [{ type: RECT_INT_T }], REGION_T);
const cairo_region_create_rectangles = fn(
    LIB,
    "cairo_region_create_rectangles",
    [{ type: RECT_INT_ARRAY_T }, { type: INT_TYPE }],
    REGION_T,
);

class RegionImpl extends Region {
    static empty(): Region {
        return wrapHandle(RegionImpl, cairo_region_create() as NativeHandle);
    }

    static forRectangle(rect: RectangleInt): Region {
        return wrapHandle(RegionImpl, cairo_region_create_rectangle(getHandle(rect)) as NativeHandle);
    }

    static createRectangles(rects: Array<{ x: number; y: number; width: number; height: number }>): Region {
        if (rects.length === 0) {
            return RegionImpl.empty();
        }
        const buf = alloc(rects.length * 16, "cairo_rectangle_int_t[]", LIB);
        let offset = 0;
        for (const rect of rects) {
            write(buf, INT_TYPE, offset, rect.x);
            write(buf, INT_TYPE, offset + 4, rect.y);
            write(buf, INT_TYPE, offset + 8, rect.width);
            write(buf, INT_TYPE, offset + 12, rect.height);
            offset += 16;
        }
        const ptr = cairo_region_create_rectangles(buf, rects.length) as NativeHandle;
        return getNativeObject(ptr, Region) as Region;
    }
}

export { RegionImpl as Region };

const cairo_region_copy = fn(LIB, "cairo_region_copy", [{ type: REGION_T_NONE }], REGION_T);
Region.prototype.copy = function (): Region {
    return getNativeObject(cairo_region_copy(getHandle(this)) as NativeHandle, Region) as Region;
};

const cairo_region_status = fn(LIB, "cairo_region_status", [{ type: REGION_T_NONE }], INT_TYPE);
Region.prototype.status = function (): Status {
    return cairo_region_status(getHandle(this)) as Status;
};

const cairo_region_get_extents = fn(
    LIB,
    "cairo_region_get_extents",
    [{ type: REGION_T_NONE }, { type: RECT_INT_T }],
    t.void,
);
Region.prototype.getExtents = function (): RectangleInt {
    const rect = new RectangleInt();
    cairo_region_get_extents(getHandle(this), getHandle(rect));
    return rect;
};

const cairo_region_num_rectangles = fn(LIB, "cairo_region_num_rectangles", [{ type: REGION_T_NONE }], INT_TYPE);
Region.prototype.numRectangles = function (): number {
    return cairo_region_num_rectangles(getHandle(this)) as number;
};

const cairo_region_get_rectangle = fn(
    LIB,
    "cairo_region_get_rectangle",
    [{ type: REGION_T_NONE }, { type: INT_TYPE }, { type: RECT_INT_T }],
    t.void,
);
Region.prototype.getRectangle = function (nth: number): RectangleInt {
    const rect = new RectangleInt();
    cairo_region_get_rectangle(getHandle(this), nth, getHandle(rect));
    return rect;
};

const cairo_region_is_empty = fn(LIB, "cairo_region_is_empty", [{ type: REGION_T_NONE }], t.boolean);
Region.prototype.isEmpty = function (): boolean {
    return cairo_region_is_empty(getHandle(this)) as boolean;
};

const cairo_region_contains_point = fn(
    LIB,
    "cairo_region_contains_point",
    [{ type: REGION_T_NONE }, { type: INT_TYPE }, { type: INT_TYPE }],
    t.boolean,
);
Region.prototype.containsPoint = function (x: number, y: number): boolean {
    return cairo_region_contains_point(getHandle(this), x, y) as boolean;
};

const cairo_region_contains_rectangle = fn(
    LIB,
    "cairo_region_contains_rectangle",
    [{ type: REGION_T_NONE }, { type: RECT_INT_T }],
    INT_TYPE,
);
Region.prototype.containsRectangle = function (rect: RectangleInt): RegionOverlap {
    return cairo_region_contains_rectangle(getHandle(this), getHandle(rect)) as RegionOverlap;
};

const cairo_region_equal = fn(LIB, "cairo_region_equal", [{ type: REGION_T_NONE }, { type: REGION_T_NONE }], t.boolean);
Region.prototype.equal = function (other: Region): boolean {
    return cairo_region_equal(getHandle(this), getHandle(other)) as boolean;
};

const cairo_region_translate = fn(
    LIB,
    "cairo_region_translate",
    [{ type: REGION_T_NONE }, { type: INT_TYPE }, { type: INT_TYPE }],
    t.void,
);
Region.prototype.translate = function (dx: number, dy: number): void {
    cairo_region_translate(getHandle(this), dx, dy);
};

const BINARY_OP_ARGS = [{ type: REGION_T_NONE }, { type: REGION_T_NONE }] as const;
const cairo_region_intersect = fn(LIB, "cairo_region_intersect", BINARY_OP_ARGS, INT_TYPE);
const cairo_region_subtract = fn(LIB, "cairo_region_subtract", BINARY_OP_ARGS, INT_TYPE);
const cairo_region_union = fn(LIB, "cairo_region_union", BINARY_OP_ARGS, INT_TYPE);
const cairo_region_xor = fn(LIB, "cairo_region_xor", BINARY_OP_ARGS, INT_TYPE);

const RECT_OP_ARGS = [{ type: REGION_T_NONE }, { type: RECT_INT_T }] as const;
const cairo_region_intersect_rectangle = fn(LIB, "cairo_region_intersect_rectangle", RECT_OP_ARGS, INT_TYPE);
const cairo_region_subtract_rectangle = fn(LIB, "cairo_region_subtract_rectangle", RECT_OP_ARGS, INT_TYPE);
const cairo_region_union_rectangle = fn(LIB, "cairo_region_union_rectangle", RECT_OP_ARGS, INT_TYPE);
const cairo_region_xor_rectangle = fn(LIB, "cairo_region_xor_rectangle", RECT_OP_ARGS, INT_TYPE);

const regionBinaryOp = (self: Region, boundFn: (...args: unknown[]) => unknown, other: Region): void => {
    boundFn(getHandle(self), getHandle(other));
};

const regionRectOp = (self: Region, boundFn: (...args: unknown[]) => unknown, rect: RectangleInt): void => {
    boundFn(getHandle(self), getHandle(rect));
};

Region.prototype.intersect = function (other: Region): void {
    regionBinaryOp(this, cairo_region_intersect, other);
};

Region.prototype.intersectRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, cairo_region_intersect_rectangle, rect);
};

Region.prototype.subtract = function (other: Region): void {
    regionBinaryOp(this, cairo_region_subtract, other);
};

Region.prototype.subtractRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, cairo_region_subtract_rectangle, rect);
};

Region.prototype.union = function (other: Region): void {
    regionBinaryOp(this, cairo_region_union, other);
};

Region.prototype.unionRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, cairo_region_union_rectangle, rect);
};

Region.prototype.xor = function (other: Region): void {
    regionBinaryOp(this, cairo_region_xor, other);
};

Region.prototype.xorRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, cairo_region_xor_rectangle, rect);
};
