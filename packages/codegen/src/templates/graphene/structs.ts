import { Point as GeneratedPoint, Rect as GeneratedRect, Size as GeneratedSize } from "../graphene.js";

const createPoint = (x: number, y: number): GeneratedPoint => {
    const point = GeneratedPoint.alloc();
    point.init(x, y);
    return point;
};

const createRect = (x: number, y: number, width: number, height: number): GeneratedRect => {
    const rect = GeneratedRect.alloc();
    rect.init(x, y, width, height);
    return rect;
};

const createSize = (width: number, height: number): GeneratedSize => {
    const size = GeneratedSize.alloc();
    size.init(width, height);
    return size;
};

export const Point: typeof GeneratedPoint & { create: typeof createPoint } = Object.assign(GeneratedPoint, {
    create: createPoint,
});

export type Point = GeneratedPoint;

export const Rect: typeof GeneratedRect & { create: typeof createRect } = Object.assign(GeneratedRect, {
    create: createRect,
});

export type Rect = GeneratedRect;

export const Size: typeof GeneratedSize & { create: typeof createSize } = Object.assign(GeneratedSize, {
    create: createSize,
});

export type Size = GeneratedSize;
