import { Context, Format, ImageSurface, Matrix, RectangleInt, Region, Status } from "@gtkx/cairo";
import { describe, expect, it } from "vitest";

const createSurface = (): ImageSurface => new ImageSurface(Format.ARGB32, 16, 16);

const rect = (x: number, y: number, width: number, height: number): RectangleInt =>
    new RectangleInt({ x, y, width, height });

describe("Context", () => {
    it("constructs a context for a surface", () => {
        const ctx = new Context(createSurface());
        expect(ctx).toBeInstanceOf(Context);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("creates a context through the create static", () => {
        const ctx = Context.create(createSurface());
        expect(ctx).toBeInstanceOf(Context);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("draws on the surface it was created for", () => {
        const surface = createSurface();
        const ctx = Context.create(surface);
        ctx.setSourceRgb(1, 0, 0);
        ctx.paint();
        surface.flush();
        const [blue, green, red, alpha] = surface.getData();
        expect([red, green, blue, alpha]).toEqual([255, 0, 0, 255]);
    });

    it("has no current point on a fresh context", () => {
        const ctx = Context.create(createSurface());
        expect(ctx.hasCurrentPoint()).toBe(false);
        expect(ctx.getCurrentPoint()).toBeNull();
    });

    it("round-trips a path through copyPath and appendPath", () => {
        const source = Context.create(createSurface());
        source.moveTo(1, 2);
        source.lineTo(3, 4);
        source.curveTo(5, 6, 7, 8, 9, 10);
        source.closePath();
        const data = source.copyPath();
        const target = Context.create(createSurface());
        target.appendPath(data);
        expect(target.copyPath()).toEqual(data);
    });

    it("rejects a missing target surface", () => {
        expect(() => Context.create(undefined as never)).toThrow();
        expect(() => new Context(undefined as never)).toThrow();
    });
});

describe("Region", () => {
    it("constructs a region from a rectangle", () => {
        const region = new Region(rect(0, 0, 10, 10));
        expect(region).toBeInstanceOf(Region);
        expect(region.numRectangles()).toBe(1);
    });

    it("creates regions through the statics", () => {
        const original = Region.forRectangle(rect(1, 2, 3, 4));
        expect(Region.empty()).toBeInstanceOf(Region);
        expect(original).toBeInstanceOf(Region);
        expect(Region.copy(original)).toBeInstanceOf(Region);
        expect(Region.copy(original).equal(original)).toBe(true);
        expect(original.copy()).toBeInstanceOf(Region);
        expect(Region.createRectangles([{ x: 0, y: 0, width: 2, height: 2 }])).toBeInstanceOf(Region);
    });

    it("creates an empty region from no rectangles", () => {
        const region = Region.createRectangles([]);
        expect(region).toBeInstanceOf(Region);
        expect(region.isEmpty()).toBe(true);
    });

    it("rejects a missing rectangle", () => {
        expect(() => new Region(undefined as never)).toThrow();
        expect(() => Region.forRectangle(undefined as never)).toThrow();
    });
});

describe("Matrix", () => {
    it("builds matrices through the statics", () => {
        expect(Matrix.initIdentity()).toBeInstanceOf(Matrix);
        expect(Matrix.initTranslate(1, 2)).toBeInstanceOf(Matrix);
        expect(Matrix.initScale(2, 3)).toBeInstanceOf(Matrix);
        expect(Matrix.initRotate(Math.PI)).toBeInstanceOf(Matrix);
        expect(Matrix.multiply(Matrix.initScale(2, 2), Matrix.initTranslate(1, 1))).toBeInstanceOf(Matrix);
    });

    it("transforms points and distances", () => {
        const matrix = Matrix.multiply(Matrix.initScale(2, 2), Matrix.initTranslate(1, 1));
        expect(matrix.transformPoint(1, 1)).toEqual({ x: 3, y: 3 });
        expect(matrix.transformDistance(1, 1)).toEqual({ dx: 2, dy: 2 });
    });

    it("reports a singular matrix on invert", () => {
        expect(Matrix.initScale(0, 0).invert()).toBe(Status.INVALID_MATRIX);
        expect(Matrix.initScale(2, 2).invert()).toBe(Status.SUCCESS);
    });

    it("rejects a missing operand in multiply", () => {
        expect(() => Matrix.multiply(Matrix.initIdentity(), undefined as never)).toThrow();
    });
});
