import type { NativeHandle } from "@gtkx/native";
import type { RegionOverlap, Status } from "../generated/cairo/enums.js";
import { RectangleInt } from "../generated/cairo/rectangle-int.js";
import { Region } from "../generated/cairo/region.js";
import { alloc, call, write } from "../native.js";
import { getNativeObject } from "../registry.js";
import { INT_TYPE, LIB, RECT_INT_T, REGION_T, REGION_T_NONE } from "./common.js";

declare module "../generated/cairo/region.js" {
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

class RegionImpl extends Region {
    static override readonly glibTypeName: string = "CairoRegion";

    constructor();
    constructor(rect: RectangleInt);
    constructor(rect?: RectangleInt) {
        super();
        if (rect) {
            this.handle = call(
                LIB,
                "cairo_region_create_rectangle",
                [{ type: RECT_INT_T, value: rect.handle }],
                REGION_T,
            ) as NativeHandle;
        } else {
            this.handle = call(LIB, "cairo_region_create", [], REGION_T) as NativeHandle;
        }
    }

    static createRectangles(rects: Array<{ x: number; y: number; width: number; height: number }>): Region {
        if (rects.length === 0) {
            return new RegionImpl();
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
        const ptr = call(
            LIB,
            "cairo_region_create_rectangles",
            [
                {
                    type: { type: "boxed", innerType: "cairo_rectangle_int_t[]", library: LIB, ownership: "borrowed" },
                    value: buf,
                },
                { type: INT_TYPE, value: rects.length },
            ],
            REGION_T,
        ) as NativeHandle;
        return getNativeObject(ptr, Region) as Region;
    }
}

export { RegionImpl as Region };

Region.prototype.copy = function (): Region {
    const ptr = call(LIB, "cairo_region_copy", [{ type: REGION_T_NONE, value: this.handle }], REGION_T) as NativeHandle;
    return getNativeObject(ptr, Region) as Region;
};

Region.prototype.status = function (): Status {
    return call(LIB, "cairo_region_status", [{ type: REGION_T_NONE, value: this.handle }], INT_TYPE) as Status;
};

Region.prototype.getExtents = function (): RectangleInt {
    const rect = new RectangleInt();
    call(
        LIB,
        "cairo_region_get_extents",
        [
            { type: REGION_T_NONE, value: this.handle },
            { type: RECT_INT_T, value: rect.handle },
        ],
        { type: "undefined" },
    );
    return rect;
};

Region.prototype.numRectangles = function (): number {
    return call(LIB, "cairo_region_num_rectangles", [{ type: REGION_T_NONE, value: this.handle }], INT_TYPE) as number;
};

Region.prototype.getRectangle = function (nth: number): RectangleInt {
    const rect = new RectangleInt();
    call(
        LIB,
        "cairo_region_get_rectangle",
        [
            { type: REGION_T_NONE, value: this.handle },
            { type: INT_TYPE, value: nth },
            { type: RECT_INT_T, value: rect.handle },
        ],
        { type: "undefined" },
    );
    return rect;
};

Region.prototype.isEmpty = function (): boolean {
    return call(LIB, "cairo_region_is_empty", [{ type: REGION_T_NONE, value: this.handle }], {
        type: "boolean",
    }) as boolean;
};

Region.prototype.containsPoint = function (x: number, y: number): boolean {
    return call(
        LIB,
        "cairo_region_contains_point",
        [
            { type: REGION_T_NONE, value: this.handle },
            { type: INT_TYPE, value: x },
            { type: INT_TYPE, value: y },
        ],
        { type: "boolean" },
    ) as boolean;
};

Region.prototype.containsRectangle = function (rect: RectangleInt): RegionOverlap {
    return call(
        LIB,
        "cairo_region_contains_rectangle",
        [
            { type: REGION_T_NONE, value: this.handle },
            { type: RECT_INT_T, value: rect.handle },
        ],
        INT_TYPE,
    ) as RegionOverlap;
};

Region.prototype.equal = function (other: Region): boolean {
    return call(
        LIB,
        "cairo_region_equal",
        [
            { type: REGION_T_NONE, value: this.handle },
            { type: REGION_T_NONE, value: other.handle },
        ],
        { type: "boolean" },
    ) as boolean;
};

Region.prototype.translate = function (dx: number, dy: number): void {
    call(
        LIB,
        "cairo_region_translate",
        [
            { type: REGION_T_NONE, value: this.handle },
            { type: INT_TYPE, value: dx },
            { type: INT_TYPE, value: dy },
        ],
        { type: "undefined" },
    );
};

const regionBinaryOp = (self: Region, fn: string, other: Region): void => {
    call(
        LIB,
        fn,
        [
            { type: REGION_T_NONE, value: self.handle },
            { type: REGION_T_NONE, value: other.handle },
        ],
        INT_TYPE,
    );
};

const regionRectOp = (self: Region, fn: string, rect: RectangleInt): void => {
    call(
        LIB,
        fn,
        [
            { type: REGION_T_NONE, value: self.handle },
            { type: RECT_INT_T, value: rect.handle },
        ],
        INT_TYPE,
    );
};

Region.prototype.intersect = function (other: Region): void {
    regionBinaryOp(this, "cairo_region_intersect", other);
};

Region.prototype.intersectRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, "cairo_region_intersect_rectangle", rect);
};

Region.prototype.subtract = function (other: Region): void {
    regionBinaryOp(this, "cairo_region_subtract", other);
};

Region.prototype.subtractRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, "cairo_region_subtract_rectangle", rect);
};

Region.prototype.union = function (other: Region): void {
    regionBinaryOp(this, "cairo_region_union", other);
};

Region.prototype.unionRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, "cairo_region_union_rectangle", rect);
};

Region.prototype.xor = function (other: Region): void {
    regionBinaryOp(this, "cairo_region_xor", other);
};

Region.prototype.xorRectangle = function (rect: RectangleInt): void {
    regionRectOp(this, "cairo_region_xor_rectangle", rect);
};
