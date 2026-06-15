import { getHandle, setHandle, t, wrapHandle } from "@gtkx/ffi";
import { alloc, type NativeHandle, write } from "@gtkx/native";
import type { RegionOverlap, Status } from "../cairo.js";
import { RectangleInt, Region } from "../cairo.js";

const { bind } = t;
const RECT_INT_ARRAY_T = t.boxed("cairo_rectangle_int_t[]", "borrowed", "libcairo.so.2");

declare module "../cairo.js" {
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

const cairoRegionCreate = bind(
    "libcairo.so.2",
    "cairo_region_create",
    [],
    t.boxed("CairoRegion", "full", "libcairo-gobject.so.2", "cairo_gobject_region_get_type"),
);
const cairoRegionCreateRectangle = bind(
    "libcairo.so.2",
    "cairo_region_create_rectangle",
    [{ type: t.boxed("cairo_rectangle_int_t", "borrowed", "libcairo.so.2") }],
    t.boxed("CairoRegion", "full", "libcairo-gobject.so.2", "cairo_gobject_region_get_type"),
);
const cairoRegionCreateRectangles = bind(
    "libcairo.so.2",
    "cairo_region_create_rectangles",
    [{ type: RECT_INT_ARRAY_T }, { type: t.int32 }],
    t.boxed("CairoRegion", "full", "libcairo-gobject.so.2", "cairo_gobject_region_get_type"),
);

class RegionImpl extends Region {
    /**
     * Creates a region containing the single rectangle `rect`.
     *
     * @param rect - The rectangle the region covers
     */
    constructor(rect: RectangleInt) {
        super();
        setHandle(this, cairoRegionCreateRectangle(getHandle(rect)) as NativeHandle);
    }

    static empty(): Region {
        return wrapHandle(cairoRegionCreate() as NativeHandle, RegionImpl);
    }

    static copy(original: Region): Region {
        return wrapHandle(cairoRegionCopy(getHandle(original)) as NativeHandle, RegionImpl);
    }

    static forRectangle(rect: RectangleInt): Region {
        return wrapHandle(cairoRegionCreateRectangle(getHandle(rect)) as NativeHandle, RegionImpl);
    }

    static createRectangles(rects: Array<{ x: number; y: number; width: number; height: number }>): Region {
        if (rects.length === 0) {
            return RegionImpl.empty();
        }
        const buf = alloc(rects.length * 16, "cairo_rectangle_int_t[]");
        let offset = 0;
        for (const rect of rects) {
            write(buf, t.int32, offset, rect.x);
            write(buf, t.int32, offset + 4, rect.y);
            write(buf, t.int32, offset + 8, rect.width);
            write(buf, t.int32, offset + 12, rect.height);
            offset += 16;
        }
        const ptr = cairoRegionCreateRectangles(buf, rects.length) as NativeHandle;
        return wrapHandle(ptr, Region) as Region;
    }
}

export { RegionImpl as Region };

const cairoRegionCopy = bind(
    "libcairo.so.2",
    "cairo_region_copy",
    [{ type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") }],
    t.boxed("CairoRegion", "full", "libcairo-gobject.so.2", "cairo_gobject_region_get_type"),
);
Region.prototype.copy = function (): Region {
    return wrapHandle(cairoRegionCopy(getHandle(this)) as NativeHandle, Region) as Region;
};

const cairoRegionStatus = bind(
    "libcairo.so.2",
    "cairo_region_status",
    [{ type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") }],
    t.int32,
);
Region.prototype.status = function (): Status {
    return cairoRegionStatus(getHandle(this)) as Status;
};

const cairoRegionGetExtents = bind(
    "libcairo.so.2",
    "cairo_region_get_extents",
    [
        { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
        { type: t.boxed("cairo_rectangle_int_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Region.prototype.getExtents = function (): RectangleInt {
    const rect = new RectangleInt();
    cairoRegionGetExtents(getHandle(this), getHandle(rect));
    return rect;
};

const cairoRegionNumRectangles = bind(
    "libcairo.so.2",
    "cairo_region_num_rectangles",
    [{ type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") }],
    t.int32,
);
Region.prototype.numRectangles = function (): number {
    return cairoRegionNumRectangles(getHandle(this)) as number;
};

const cairoRegionGetRectangle = bind(
    "libcairo.so.2",
    "cairo_region_get_rectangle",
    [
        { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
        { type: t.int32 },
        { type: t.boxed("cairo_rectangle_int_t", "borrowed", "libcairo.so.2") },
    ],
    t.void,
);
Region.prototype.getRectangle = function (nth: number): RectangleInt {
    const rect = new RectangleInt();
    cairoRegionGetRectangle(getHandle(this), nth, getHandle(rect));
    return rect;
};

const cairoRegionIsEmpty = bind(
    "libcairo.so.2",
    "cairo_region_is_empty",
    [{ type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") }],
    t.boolean,
);
Region.prototype.isEmpty = function (): boolean {
    return cairoRegionIsEmpty(getHandle(this)) as boolean;
};

const cairoRegionContainsPoint = bind(
    "libcairo.so.2",
    "cairo_region_contains_point",
    [
        { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.boolean,
);
Region.prototype.containsPoint = function (x: number, y: number): boolean {
    return cairoRegionContainsPoint(getHandle(this), x, y) as boolean;
};

const cairoRegionContainsRectangle = bind(
    "libcairo.so.2",
    "cairo_region_contains_rectangle",
    [
        { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
        { type: t.boxed("cairo_rectangle_int_t", "borrowed", "libcairo.so.2") },
    ],
    t.int32,
);
Region.prototype.containsRectangle = function (rect: RectangleInt): RegionOverlap {
    return cairoRegionContainsRectangle(getHandle(this), getHandle(rect)) as RegionOverlap;
};

const cairoRegionEqual = bind(
    "libcairo.so.2",
    "cairo_region_equal",
    [
        { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
        { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
    ],
    t.boolean,
);
Region.prototype.equal = function (other: Region): boolean {
    return cairoRegionEqual(getHandle(this), getHandle(other)) as boolean;
};

const cairoRegionTranslate = bind(
    "libcairo.so.2",
    "cairo_region_translate",
    [
        { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);
Region.prototype.translate = function (dx: number, dy: number): void {
    cairoRegionTranslate(getHandle(this), dx, dy);
};

const BINARY_OP_ARGS = [
    { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
    { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
] as const;
const cairoRegionIntersect = bind("libcairo.so.2", "cairo_region_intersect", BINARY_OP_ARGS, t.int32);
const cairoRegionSubtract = bind("libcairo.so.2", "cairo_region_subtract", BINARY_OP_ARGS, t.int32);
const cairoRegionUnion = bind("libcairo.so.2", "cairo_region_union", BINARY_OP_ARGS, t.int32);
const cairoRegionXor = bind("libcairo.so.2", "cairo_region_xor", BINARY_OP_ARGS, t.int32);

const RECT_OP_ARGS = [
    { type: t.boxed("CairoRegion", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_region_get_type") },
    { type: t.boxed("cairo_rectangle_int_t", "borrowed", "libcairo.so.2") },
] as const;
const cairoRegionIntersectRectangle = bind("libcairo.so.2", "cairo_region_intersect_rectangle", RECT_OP_ARGS, t.int32);
const cairoRegionSubtractRectangle = bind("libcairo.so.2", "cairo_region_subtract_rectangle", RECT_OP_ARGS, t.int32);
const cairoRegionUnionRectangle = bind("libcairo.so.2", "cairo_region_union_rectangle", RECT_OP_ARGS, t.int32);
const cairoRegionXorRectangle = bind("libcairo.so.2", "cairo_region_xor_rectangle", RECT_OP_ARGS, t.int32);

const regionBinaryOp = (self: Region, boundFn: (...args: unknown[]) => unknown, other: Region): void => {
    boundFn(getHandle(self), getHandle(other));
};

const regionRectOp = (self: Region, boundFn: (...args: unknown[]) => unknown, rect: RectangleInt): void => {
    boundFn(getHandle(self), getHandle(rect));
};

Region.prototype.intersect = function (other: Region): void {
    regionBinaryOp(this, cairoRegionIntersect, other);
};

Region.prototype.intersectRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, cairoRegionIntersectRectangle, rect);
};

Region.prototype.subtract = function (other: Region): void {
    regionBinaryOp(this, cairoRegionSubtract, other);
};

Region.prototype.subtractRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, cairoRegionSubtractRectangle, rect);
};

Region.prototype.union = function (other: Region): void {
    regionBinaryOp(this, cairoRegionUnion, other);
};

Region.prototype.unionRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, cairoRegionUnionRectangle, rect);
};

Region.prototype.xor = function (other: Region): void {
    regionBinaryOp(this, cairoRegionXor, other);
};

Region.prototype.xorRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, cairoRegionXorRectangle, rect);
};
