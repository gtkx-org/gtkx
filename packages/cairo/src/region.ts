import {
    alloc,
    type ExternalObject,
    getHandle,
    type Handle,
    registerWrapperClass,
    setHandle,
    t,
    wrapHandle,
} from "@gtkx/runtime";
import type { RegionOverlap, Status } from "./enums.js";
import type { RectangleData } from "./types.js";
import {
    bindCairo,
    type BoundFunction,
    cairoGType,
    RECTANGLE_INT_ARRAY_T,
    RECTANGLE_INT_T,
    REGION_FULL_T,
    REGION_T,
} from "./lib.js";
import { RectangleInt } from "./structs.js";

const REGION_TYPE = cairoGType("cairo_gobject_region_get_type");
const RECTANGLE_INT_SIZE = 16;
const BINARY_OP_ARGS = [REGION_T, REGION_T];
const RECTANGLE_OP_ARGS = [REGION_T, RECTANGLE_INT_T];
const cairoRegionCreate = bindCairo("cairo_region_create", [], REGION_FULL_T);
const cairoRegionCreateRectangle = bindCairo("cairo_region_create_rectangle", [RECTANGLE_INT_T], REGION_FULL_T);

const cairoRegionCreateRectangles = bindCairo(
    "cairo_region_create_rectangles",
    [RECTANGLE_INT_ARRAY_T, t.int32],
    REGION_FULL_T,
);

const cairoRegionCopy = bindCairo("cairo_region_copy", [REGION_T], REGION_FULL_T);
const cairoRegionStatus = bindCairo("cairo_region_status", [REGION_T], t.int32);
const cairoRegionGetExtents = bindCairo("cairo_region_get_extents", [REGION_T, RECTANGLE_INT_T], t.void);
const cairoRegionNumRectangles = bindCairo("cairo_region_num_rectangles", [REGION_T], t.int32);
const cairoRegionGetRectangle = bindCairo("cairo_region_get_rectangle", [REGION_T, t.int32, RECTANGLE_INT_T], t.void);
const cairoRegionIsEmpty = bindCairo("cairo_region_is_empty", [REGION_T], t.boolean);
const cairoRegionContainsPoint = bindCairo("cairo_region_contains_point", [REGION_T, t.int32, t.int32], t.boolean);
const cairoRegionContainsRectangle = bindCairo("cairo_region_contains_rectangle", RECTANGLE_OP_ARGS, t.int32);
const cairoRegionEqual = bindCairo("cairo_region_equal", BINARY_OP_ARGS, t.boolean);
const cairoRegionTranslate = bindCairo("cairo_region_translate", [REGION_T, t.int32, t.int32], t.void);
const cairoRegionIntersect = bindCairo("cairo_region_intersect", BINARY_OP_ARGS, t.int32);
const cairoRegionSubtract = bindCairo("cairo_region_subtract", BINARY_OP_ARGS, t.int32);
const cairoRegionUnion = bindCairo("cairo_region_union", BINARY_OP_ARGS, t.int32);
const cairoRegionXor = bindCairo("cairo_region_xor", BINARY_OP_ARGS, t.int32);
const cairoRegionIntersectRectangle = bindCairo("cairo_region_intersect_rectangle", RECTANGLE_OP_ARGS, t.int32);
const cairoRegionSubtractRectangle = bindCairo("cairo_region_subtract_rectangle", RECTANGLE_OP_ARGS, t.int32);
const cairoRegionUnionRectangle = bindCairo("cairo_region_union_rectangle", RECTANGLE_OP_ARGS, t.int32);
const cairoRegionXorRectangle = bindCairo("cairo_region_xor_rectangle", RECTANGLE_OP_ARGS, t.int32);
const INT = t.fieldAt(t.int32);

const allocRectangleBuffer = (rects: RectangleData[]): ExternalObject<Handle> => {
    const buffer = alloc(rects.length * RECTANGLE_INT_SIZE);
    let offset = 0;

    for (const rect of rects) {
        INT.write(buffer, offset, rect.x);
        INT.write(buffer, offset + 4, rect.y);
        INT.write(buffer, offset + 8, rect.width);
        INT.write(buffer, offset + 12, rect.height);
        offset += RECTANGLE_INT_SIZE;
    }

    return buffer;
};

const applyRegionOp = (self: object, boundFn: BoundFunction, arg: object): void => {
    boundFn(getHandle(self), getHandle(arg));
};

/**
 * A cairo region (`cairo_region_t`): a set of integer rectangles, as GTK uses for clip and damage areas.
 * Set operations modify the region in place.
 */
class Region {
    static {
        registerWrapperClass(this, REGION_TYPE);
    }

    /** Creates an empty region. */
    static empty(): Region {
        return wrapHandle(cairoRegionCreate() as ExternalObject<Handle>, this);
    }

    /** Creates a region with the same rectangles as `original`. */
    static copy(original: Region): Region {
        return wrapHandle(cairoRegionCopy(getHandle(original)) as ExternalObject<Handle>, this);
    }

    /** Creates a region covering `rect`. */
    static forRectangle(rect: RectangleInt): Region {
        return wrapHandle(cairoRegionCreateRectangle(getHandle(rect)) as ExternalObject<Handle>, this);
    }

    /** Creates a region covering the union of `rects`; an empty list yields an empty region. */
    static createRectangles(rects: RectangleData[]): Region {
        if (rects.length === 0) {
            return this.empty();
        }

        const buffer = allocRectangleBuffer(rects);

        return wrapHandle(cairoRegionCreateRectangles(buffer, rects.length) as ExternalObject<Handle>, this);
    }

    /** GType of `CairoRegion`, the boxed type this class is registered under. */
    declare __type__: bigint;

    /** Creates a region covering `rect`. */
    constructor(rect: RectangleInt) {
        setHandle(this, cairoRegionCreateRectangle(getHandle(rect)) as ExternalObject<Handle>);
    }

    /** Returns a region with the same rectangles as this one. */
    copy(): Region {
        return wrapHandle(cairoRegionCopy(getHandle(this)) as ExternalObject<Handle>, Region);
    }

    /** Returns the error status of the region, `Status.SUCCESS` when it is usable. */
    status(): Status {
        return cairoRegionStatus(getHandle(this)) as Status;
    }

    /** Returns the bounding rectangle of the region. */
    getExtents(): RectangleInt {
        const rect = new RectangleInt();
        cairoRegionGetExtents(getHandle(this), getHandle(rect));

        return rect;
    }

    /** Returns how many rectangles make up the region. */
    numRectangles(): number {
        return cairoRegionNumRectangles(getHandle(this)) as number;
    }

    /** Returns the `nth` rectangle of the region, counting from zero. */
    getRectangle(nth: number): RectangleInt {
        const rect = new RectangleInt();
        cairoRegionGetRectangle(getHandle(this), nth, getHandle(rect));

        return rect;
    }

    /** Returns whether the region covers no area. */
    isEmpty(): boolean {
        return cairoRegionIsEmpty(getHandle(this)) as boolean;
    }

    /** Returns whether the point `(x, y)` lies inside the region. */
    containsPoint(x: number, y: number): boolean {
        return cairoRegionContainsPoint(getHandle(this), x, y) as boolean;
    }

    /** Returns whether `rect` lies inside, outside or partly inside the region. */
    containsRectangle(rect: RectangleInt): RegionOverlap {
        return cairoRegionContainsRectangle(getHandle(this), getHandle(rect)) as RegionOverlap;
    }

    /** Returns whether the region covers the same area as `other`. */
    equal(other: Region): boolean {
        return cairoRegionEqual(getHandle(this), getHandle(other)) as boolean;
    }

    /** Moves the region by `dx` and `dy`. */
    translate(dx: number, dy: number): void {
        cairoRegionTranslate(getHandle(this), dx, dy);
    }

    /** Keeps only the area the region shares with `other`. */
    intersect(other: Region): void {
        applyRegionOp(this, cairoRegionIntersect, other);
    }

    /** Keeps only the area the region shares with `rect`. */
    intersectRectangle(rect: RectangleInt): void {
        applyRegionOp(this, cairoRegionIntersectRectangle, rect);
    }

    /** Removes the area of `other` from the region. */
    subtract(other: Region): void {
        applyRegionOp(this, cairoRegionSubtract, other);
    }

    /** Removes the area of `rect` from the region. */
    subtractRectangle(rect: RectangleInt): void {
        applyRegionOp(this, cairoRegionSubtractRectangle, rect);
    }

    /** Adds the area of `other` to the region. */
    union(other: Region): void {
        applyRegionOp(this, cairoRegionUnion, other);
    }

    /** Adds the area of `rect` to the region. */
    unionRectangle(rect: RectangleInt): void {
        applyRegionOp(this, cairoRegionUnionRectangle, rect);
    }

    /** Keeps the area covered by exactly one of the region and `other`. */
    xor(other: Region): void {
        applyRegionOp(this, cairoRegionXor, other);
    }

    /** Keeps the area covered by exactly one of the region and `rect`. */
    xorRectangle(rect: RectangleInt): void {
        applyRegionOp(this, cairoRegionXorRectangle, rect);
    }
}

export { Region };
