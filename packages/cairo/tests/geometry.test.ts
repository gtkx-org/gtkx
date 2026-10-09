import {
    Context,
    Format,
    ImageSurface,
    Matrix,
    Path,
    RectangleInt,
    Region,
    RegionOverlap,
    Status,
    statusToString,
    version,
    versionString,
} from "@gtkx/cairo";
import { type ExternalObject, getHandle, type Handle, t, wrapHandle } from "@gtkx/runtime";
import { describe, expect, it } from "vitest";

const regionOperations = [
    {
        name: "intersect",
        region: (a: Region, b: Region) => a.intersect(b),
        rectangle: (a: Region, b: RectangleInt) => a.intersectRectangle(b),
        points: [false, true, false],
    },
    {
        name: "subtract",
        region: (a: Region, b: Region) => a.subtract(b),
        rectangle: (a: Region, b: RectangleInt) => a.subtractRectangle(b),
        points: [true, false, false],
    },
    {
        name: "union",
        region: (a: Region, b: Region) => a.union(b),
        rectangle: (a: Region, b: RectangleInt) => a.unionRectangle(b),
        points: [true, true, true],
    },
    {
        name: "xor",
        region: (a: Region, b: Region) => a.xor(b),
        rectangle: (a: Region, b: RectangleInt) => a.xorRectangle(b),
        points: [true, false, true],
    },
];

describe("native region geometry", () => {
    it.each(regionOperations)("applies $name through both operand bindings", ({ region, rectangle, points }) => {
        const left = new RectangleInt({ x: 0, y: 0, width: 10, height: 10 });
        const right = new RectangleInt({ x: 5, y: 0, width: 10, height: 10 });
        const source = Region.forRectangle(left);
        const byRegion = source.copy();
        const byRectangle = Region.copy(source);
        region(byRegion, new Region(right));
        rectangle(byRectangle, right);
        expect(byRegion.equal(byRectangle)).toBe(true);
        expect([2, 7, 12].map((x) => byRegion.containsPoint(x, 5))).toEqual(points);
        expect(byRegion.status()).toBe(Status.SUCCESS);
        expect(source.containsRectangle(left)).toBe(RegionOverlap.IN);
        expect(source.containsRectangle(right)).toBe(RegionOverlap.PART);
        source.translate(20, 30);
        expect(source.getRectangle(0)).toMatchObject({ x: 20, y: 30, width: 10, height: 10 });
        expect(source.getExtents()).toMatchObject({ x: 20, y: 30, width: 10, height: 10 });
        expect(Region.empty().isEmpty()).toBe(true);
    });
});

it("composes native matrices and reverses the resulting transformation", () => {
    const scale = Matrix.initScale(2, 3);
    const translation = Matrix.initTranslate(4, 5);
    const combined = Matrix.multiply(scale, translation);
    const point = combined.transformPoint(2, 3);
    expect(point).toEqual({ x: 8, y: 14 });
    expect(combined.invert()).toBe(Status.SUCCESS);
    const restored = combined.transformPoint(point.x, point.y);
    expect(restored.x).toBeCloseTo(2);
    expect(restored.y).toBeCloseTo(3);
    const rotation = Matrix.initRotate(Math.PI / 2);
    expect(rotation.transformPoint(1, 0).y).toBeCloseTo(1);
    expect(new Matrix(0, 0, 0, 0, 0, 0).invert()).toBe(Status.INVALID_MATRIX);
});

it("copies curved and flattened paths, appends them and reads an owned native Path", () => {
    const context = new Context(new ImageSurface(Format.ARGB32, 16, 16));
    context.moveTo(1, 2);
    context.curveTo(2, 10, 10, 2, 12, 12);
    context.closePath();
    const original = context.copyPath();
    expect(original).toContainEqual({ type: "curveTo", x1: 2, y1: 10, x2: 10, y2: 2, x3: 12, y3: 12 });
    expect(context.copyPathFlat().some((segment) => segment.type === "curveTo")).toBe(false);
    const copy = t.bind(
        "libcairo.so.2",
        "cairo_copy_path",
        [
            t.boxed("CairoContext", {
                ownership: "borrowed",
                sharedLibrary: "libcairo-gobject.so.2",
                getTypeFnName: "cairo_gobject_context_get_type",
            }),
        ],
        t.boxed("cairo_path_t", {
            ownership: "full",
            sharedLibrary: "libcairo.so.2",
            freeFnName: "cairo_path_destroy",
        }),
    );
    const path = wrapHandle(copy(getHandle(context)) as ExternalObject<Handle>, Path);
    expect(path.toData()).toEqual(original);
    context.newPath();
    expect(context.copyPath()).toEqual([]);
    context.appendPath(original);
    expect(context.copyPath()).toEqual(original);
});

it("reports the linked Cairo version and error descriptions", () => {
    const [major = 0, minor = 0, micro = 0] = versionString().split(".").map(Number);
    expect(version()).toBe(major * 10000 + minor * 100 + micro);
    expect(statusToString(Status.SUCCESS)).toMatch(/no error/i);
    expect(statusToString(Status.INVALID_MATRIX)).toMatch(/matrix/i);
});
