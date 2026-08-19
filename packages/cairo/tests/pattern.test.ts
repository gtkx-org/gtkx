import {
    Content,
    Context,
    Extend,
    Filter,
    Format,
    ImageSurface,
    LinearPattern,
    Matrix,
    MeshPattern,
    Pattern,
    PatternType,
    RadialPattern,
    Status,
} from "@gtkx/cairo";
import { describe, expect, it } from "vitest";

type Constructor<T> = abstract new (...args: never[]) => T;

const createContext = (): Context => Context.create(new ImageSurface(Format.ARGB32, 4, 4));

const asInstance = <T>(value: unknown, cls: Constructor<T>): T => {
    if (value instanceof cls) {
        return value;
    }

    throw new TypeError(`Expected an instance of ${cls.name}`);
};

const sourceAfterSetting = (pattern: Pattern): Pattern => {
    const ctx = createContext();
    ctx.setSource(pattern);

    return ctx.getSource();
};

const createPatch = (): MeshPattern => {
    const mesh = Pattern.createMesh();
    mesh.beginPatch();
    mesh.moveTo(0, 0);
    mesh.lineTo(10, 0);
    mesh.lineTo(10, 10);
    mesh.lineTo(0, 10);
    mesh.setCornerColorRgba(0, 1, 0, 0, 0.5);
    mesh.setControlPoint(0, 2, 2);
    mesh.endPatch();

    return mesh;
};

describe("Pattern (context sources)", () => {
    it("wraps the source of a context as the concrete gradient class", () => {
        const linear = sourceAfterSetting(Pattern.createLinear(1, 2, 3, 4));
        expect(linear).toBeInstanceOf(LinearPattern);
        expect(asInstance(linear, LinearPattern).getLinearPoints()).toEqual({ x0: 1, y0: 2, x1: 3, y1: 4 });
        const radial = sourceAfterSetting(Pattern.createRadial(1, 2, 3, 4, 5, 6));
        expect(radial).toBeInstanceOf(RadialPattern);

        expect(asInstance(radial, RadialPattern).getRadialCircles()).toEqual({
            x0: 1,
            y0: 2,
            r0: 3,
            x1: 4,
            y1: 5,
            r1: 6,
        });
    });

    it("wraps the source of a context as a mesh pattern", () => {
        const mesh = asInstance(sourceAfterSetting(createPatch()), MeshPattern);
        expect(mesh).toBeInstanceOf(MeshPattern);
        expect(mesh.getPatchCount()).toBe(1);
        expect(mesh.getCornerColorRgba(0, 0)).toEqual({ red: 1, green: 0, blue: 0, alpha: 0.5 });
        expect(mesh.getControlPoint(0, 0)).toEqual({ x: 2, y: 2 });
        expect(mesh.getPath(0)[0]).toEqual({ type: "moveTo", x: 0, y: 0 });
    });

    it("wraps a popped group as a surface pattern", () => {
        const ctx = createContext();
        ctx.pushGroupWithContent(Content.COLOR_ALPHA);
        ctx.setSourceRgb(1, 0, 0);
        ctx.paint();
        const group = ctx.popGroup();
        expect(group).toBeInstanceOf(Pattern);
        expect(group).not.toBeInstanceOf(LinearPattern);
        expect(group.getType()).toBe(PatternType.SURFACE);
        expect(group.status()).toBe(Status.SUCCESS);
    });

    it("reports a black opaque source on a fresh context", () => {
        const source = createContext().getSource();
        expect(source.getType()).toBe(PatternType.SOLID);
        expect(source.getRgba()).toEqual({ red: 0, green: 0, blue: 0, alpha: 1 });
        expect(source.getColorStopCount()).toBe(0);
    });

    it("rejects a missing source", () => {
        expect(() => {
            createContext().setSource(undefined as never);
        }).toThrow();
    });
});

describe("Pattern (statics)", () => {
    it("wraps solid and surface patterns as plain patterns", () => {
        const solid = Pattern.createRgb(0.25, 0.5, 0.75);
        const surface = Pattern.createForSurface(new ImageSurface(Format.ARGB32, 2, 2));
        expect(solid).toBeInstanceOf(Pattern);
        expect(solid).not.toBeInstanceOf(LinearPattern);
        expect(solid.getRgba()).toEqual({ red: 0.25, green: 0.5, blue: 0.75, alpha: 1 });
        expect(surface.getType()).toBe(PatternType.SURFACE);
        expect(surface).not.toBeInstanceOf(MeshPattern);

        expect(sourceAfterSetting(Pattern.createRgba(0, 0, 1, 0.5)).getRgba()).toEqual({
            red: 0,
            green: 0,
            blue: 1,
            alpha: 0.5,
        });
    });

    it("reads back color stops, extend, filter and matrix", () => {
        const gradient = Pattern.createLinear(0, 0, 10, 0);
        gradient.addColorStopRgb(0, 1, 0, 0);
        gradient.addColorStopRgba(1, 0, 0, 1, 0.5);
        gradient.setExtend(Extend.REFLECT);
        gradient.setFilter(Filter.NEAREST);
        gradient.setMatrix(Matrix.initTranslate(3, 4));
        expect(gradient.getColorStopCount()).toBe(2);
        expect(gradient.getColorStopRgba(1)).toEqual({ offset: 1, red: 0, green: 0, blue: 1, alpha: 0.5 });
        expect(gradient.getExtend()).toBe(Extend.REFLECT);
        expect(gradient.getFilter()).toBe(Filter.NEAREST);
        expect(gradient.getMatrix().transformPoint(0, 0)).toEqual({ x: 3, y: 4 });
        expect(gradient.getReferenceCount()).toBe(1);
    });

    it("reports no patches on a fresh mesh", () => {
        const mesh = Pattern.createMesh();
        expect(mesh).toBeInstanceOf(MeshPattern);
        expect(mesh.getPatchCount()).toBe(0);
        expect(mesh.getType()).toBe(PatternType.MESH);
    });

    it("rejects a missing operand", () => {
        expect(() => Pattern.createForSurface(undefined as never)).toThrow();

        expect(() => {
            Pattern.createLinear(0, 0, 1, 1).setMatrix(undefined as never);
        }).toThrow();
    });
});
