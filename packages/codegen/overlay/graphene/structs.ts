/**
 * Hand-written `Graphene` struct factory shorthands.
 *
 * The contract `.d.ts` declares a `static create` on `Point`, `Rect`, and
 * `Size` that ts-for-gir injects from its node-gtk override tables; these have
 * no GIR backing. This module re-exports the generated structs with those
 * statics implemented, keeping the FFI runtime in agreement with the contract.
 */

import { Point as GeneratedPoint, Rect as GeneratedRect, Size as GeneratedSize } from "@gtkx/gi/graphene/graphene.js";

/**
 * Constructs a {@link Point} at the given coordinates.
 *
 * @param x - The X coordinate.
 * @param y - The Y coordinate.
 * @returns The initialized `Point` instance.
 */
const createPoint = (x: number, y: number): GeneratedPoint => {
    const point = GeneratedPoint.alloc();
    point.init(x, y);
    return point;
};

/**
 * Constructs a {@link Rect} with the given origin and dimensions.
 *
 * @param x - The X coordinate of the origin.
 * @param y - The Y coordinate of the origin.
 * @param width - The rectangle width.
 * @param height - The rectangle height.
 * @returns The initialized `Rect` instance.
 */
const createRect = (x: number, y: number, width: number, height: number): GeneratedRect => {
    const rect = GeneratedRect.alloc();
    rect.init(x, y, width, height);
    return rect;
};

/**
 * Constructs a {@link Size} with the given dimensions.
 *
 * @param width - The width.
 * @param height - The height.
 * @returns The initialized `Size` instance.
 */
const createSize = (width: number, height: number): GeneratedSize => {
    const size = GeneratedSize.alloc();
    size.init(width, height);
    return size;
};

/**
 * The `Graphene.Point` struct, extended with the `create` factory shorthand.
 */
export const Point: typeof GeneratedPoint & { create: typeof createPoint } = Object.assign(GeneratedPoint, {
    create: createPoint,
});

/**
 * An instance of the `Graphene.Point` struct.
 */
export type Point = GeneratedPoint;

/**
 * The `Graphene.Rect` struct, extended with the `create` factory shorthand.
 */
export const Rect: typeof GeneratedRect & { create: typeof createRect } = Object.assign(GeneratedRect, {
    create: createRect,
});

/**
 * An instance of the `Graphene.Rect` struct.
 */
export type Rect = GeneratedRect;

/**
 * The `Graphene.Size` struct, extended with the `create` factory shorthand.
 */
export const Size: typeof GeneratedSize & { create: typeof createSize } = Object.assign(GeneratedSize, {
    create: createSize,
});

/**
 * An instance of the `Graphene.Size` struct.
 */
export type Size = GeneratedSize;
