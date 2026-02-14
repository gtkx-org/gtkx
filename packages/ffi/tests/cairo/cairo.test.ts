import { existsSync, unlinkSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    Context,
    FontOptions,
    ImageSurface,
    LinearPattern,
    Matrix,
    Pattern,
    PdfSurface,
    RadialPattern,
    Region,
    SolidPattern,
    Surface,
    SurfacePattern,
} from "../../src/cairo/index.js";
import {
    Content,
    Extend,
    Filter,
    Format,
    HintMetrics,
    HintStyle,
    LineCap,
    LineJoin,
    Operator,
    PatternType,
    Status,
    SubpixelOrder,
    SurfaceType,
} from "../../src/generated/cairo/enums.js";

const createTestSurface = (): Surface => {
    return new PdfSurface("/dev/null", 200, 200);
};

const createTestContext = (): Context => {
    return new Context(createTestSurface());
};

describe("Matrix", () => {
    it("creates with explicit values", () => {
        const m = new Matrix(1, 0, 0, 1, 10, 20);
        expect(m.xx).toBeCloseTo(1);
        expect(m.yx).toBeCloseTo(0);
        expect(m.xy).toBeCloseTo(0);
        expect(m.yy).toBeCloseTo(1);
        expect(m.x0).toBeCloseTo(10);
        expect(m.y0).toBeCloseTo(20);
    });

    it("creates identity matrix", () => {
        const m = new Matrix();
        expect(m.xx).toBeCloseTo(1);
        expect(m.yx).toBeCloseTo(0);
        expect(m.xy).toBeCloseTo(0);
        expect(m.yy).toBeCloseTo(1);
        expect(m.x0).toBeCloseTo(0);
        expect(m.y0).toBeCloseTo(0);
    });

    it("creates a translation matrix", () => {
        const m = Matrix.createTranslate(5, 10);
        expect(m.x0).toBeCloseTo(5);
        expect(m.y0).toBeCloseTo(10);
    });

    it("creates a scale matrix", () => {
        const m = Matrix.createScale(2, 3);
        expect(m.xx).toBeCloseTo(2);
        expect(m.yy).toBeCloseTo(3);
    });

    it("creates a rotation matrix", () => {
        const m = Matrix.createRotate(Math.PI / 2);
        expect(m.xx).toBeCloseTo(0, 5);
        expect(m.yx).toBeCloseTo(1, 5);
        expect(m.xy).toBeCloseTo(-1, 5);
        expect(m.yy).toBeCloseTo(0, 5);
    });

    it("translates in place", () => {
        const m = new Matrix();
        m.translate(5, 10);
        expect(m.x0).toBeCloseTo(5);
        expect(m.y0).toBeCloseTo(10);
    });

    it("scales in place", () => {
        const m = new Matrix();
        m.scale(2, 3);
        expect(m.xx).toBeCloseTo(2);
        expect(m.yy).toBeCloseTo(3);
    });

    it("rotates in place", () => {
        const m = new Matrix();
        m.rotate(Math.PI / 2);
        expect(m.xx).toBeCloseTo(0, 5);
        expect(m.yx).toBeCloseTo(1, 5);
    });

    it("inverts", () => {
        const m = Matrix.createScale(2, 4);
        m.invert();
        expect(m.xx).toBeCloseTo(0.5);
        expect(m.yy).toBeCloseTo(0.25);
    });

    it("multiplies two matrices", () => {
        const a = Matrix.createScale(2, 2);
        const b = Matrix.createTranslate(10, 10);
        const c = a.multiply(b);
        expect(c).toBeInstanceOf(Matrix);
        const p = c.transformPoint(5, 5);
        expect(p.x).toBeCloseTo(20);
        expect(p.y).toBeCloseTo(20);
    });

    it("transforms a point", () => {
        const m = Matrix.createTranslate(10, 20);
        const p = m.transformPoint(5, 5);
        expect(p.x).toBeCloseTo(15);
        expect(p.y).toBeCloseTo(25);
    });

    it("transforms a distance", () => {
        const m = Matrix.createScale(3, 4);
        const d = m.transformDistance(2, 3);
        expect(d.dx).toBeCloseTo(6);
        expect(d.dy).toBeCloseTo(12);
    });
});

describe("Context", () => {
    describe("path operations", () => {
        it("moves to a point", () => {
            const ctx = createTestContext();
            ctx.moveTo(10, 20);
            const point = ctx.getCurrentPoint();
            expect(point).not.toBeNull();
            expect(point?.x).toBeCloseTo(10);
            expect(point?.y).toBeCloseTo(20);
        });

        it("draws a line to a point", () => {
            const ctx = createTestContext();
            ctx.moveTo(0, 0);
            ctx.lineTo(50, 50);
            const point = ctx.getCurrentPoint();
            expect(point?.x).toBeCloseTo(50);
            expect(point?.y).toBeCloseTo(50);
        });

        it("performs relative move", () => {
            const ctx = createTestContext();
            ctx.moveTo(10, 10);
            ctx.relMoveTo(5, 5);
            const point = ctx.getCurrentPoint();
            expect(point?.x).toBeCloseTo(15);
            expect(point?.y).toBeCloseTo(15);
        });

        it("performs relative line", () => {
            const ctx = createTestContext();
            ctx.moveTo(10, 10);
            ctx.relLineTo(20, 30);
            const point = ctx.getCurrentPoint();
            expect(point?.x).toBeCloseTo(30);
            expect(point?.y).toBeCloseTo(40);
        });

        it("draws a curve", () => {
            const ctx = createTestContext();
            ctx.moveTo(0, 0);
            ctx.curveTo(10, 10, 20, 20, 30, 30);
            const point = ctx.getCurrentPoint();
            expect(point?.x).toBeCloseTo(30);
            expect(point?.y).toBeCloseTo(30);
        });

        it("draws a relative curve", () => {
            const ctx = createTestContext();
            ctx.moveTo(0, 0);
            ctx.relCurveTo(10, 10, 20, 20, 30, 30);
            const point = ctx.getCurrentPoint();
            expect(point?.x).toBeCloseTo(30);
            expect(point?.y).toBeCloseTo(30);
        });

        it("draws an arc", () => {
            const ctx = createTestContext();
            ctx.arc(50, 50, 25, 0, Math.PI * 2);
            const point = ctx.getCurrentPoint();
            expect(point).not.toBeNull();
        });

        it("draws a negative arc", () => {
            const ctx = createTestContext();
            ctx.arcNegative(50, 50, 25, Math.PI * 2, 0);
            const point = ctx.getCurrentPoint();
            expect(point).not.toBeNull();
        });

        it("draws a rectangle", () => {
            const ctx = createTestContext();
            ctx.rectangle(10, 10, 80, 60);
            const point = ctx.getCurrentPoint();
            expect(point).not.toBeNull();
        });

        it("closes a path", () => {
            const ctx = createTestContext();
            ctx.moveTo(0, 0);
            ctx.lineTo(50, 50);
            ctx.lineTo(100, 0);
            ctx.closePath();
            const point = ctx.getCurrentPoint();
            expect(point?.x).toBeCloseTo(0);
            expect(point?.y).toBeCloseTo(0);
        });

        it("creates a new path", () => {
            const ctx = createTestContext();
            ctx.moveTo(10, 10);
            ctx.newPath();
            const point = ctx.getCurrentPoint();
            expect(point).toBeNull();
        });

        it("creates a new sub-path", () => {
            const ctx = createTestContext();
            ctx.moveTo(10, 10);
            ctx.newSubPath();
            const point = ctx.getCurrentPoint();
            expect(point).toBeNull();
        });
    });

    describe("getCurrentPoint", () => {
        it("returns null when no current point exists", () => {
            const ctx = createTestContext();
            expect(ctx.getCurrentPoint()).toBeNull();
        });

        it("returns coordinates after moveTo", () => {
            const ctx = createTestContext();
            ctx.moveTo(42, 84);
            const point = ctx.getCurrentPoint();
            expect(point).toEqual({ x: 42, y: 84 });
        });
    });

    describe("drawing operations", () => {
        it("strokes the current path", () => {
            const ctx = createTestContext();
            ctx.moveTo(0, 0);
            ctx.lineTo(100, 100);
            ctx.stroke();
        });

        it("strokes preserving the path", () => {
            const ctx = createTestContext();
            ctx.moveTo(0, 0);
            ctx.lineTo(100, 100);
            ctx.strokePreserve();
        });

        it("fills the current path", () => {
            const ctx = createTestContext();
            ctx.rectangle(0, 0, 100, 100);
            ctx.fill();
        });

        it("fills preserving the path", () => {
            const ctx = createTestContext();
            ctx.rectangle(0, 0, 100, 100);
            ctx.fillPreserve();
        });

        it("paints the entire surface", () => {
            const ctx = createTestContext();
            ctx.paint();
        });

        it("paints with alpha", () => {
            const ctx = createTestContext();
            ctx.paintWithAlpha(0.5);
        });
    });

    describe("clipping", () => {
        it("clips to the current path", () => {
            const ctx = createTestContext();
            ctx.rectangle(10, 10, 80, 80);
            ctx.clip();
        });

        it("clips preserving the path", () => {
            const ctx = createTestContext();
            ctx.rectangle(10, 10, 80, 80);
            ctx.clipPreserve();
        });

        it("resets the clip region", () => {
            const ctx = createTestContext();
            ctx.resetClip();
        });
    });

    describe("source color", () => {
        it("sets source RGB", () => {
            const ctx = createTestContext();
            ctx.setSourceRgb(1.0, 0.0, 0.0);
        });

        it("sets source RGBA", () => {
            const ctx = createTestContext();
            ctx.setSourceRgba(1.0, 0.0, 0.0, 0.5);
        });

        it("sets a pattern as source", () => {
            const ctx = createTestContext();
            const pattern = new LinearPattern(0, 0, 100, 100);
            pattern.addColorStopRgb(0, 1, 0, 0);
            pattern.addColorStopRgb(1, 0, 0, 1);
            ctx.setSource(pattern);
        });
    });

    describe("line settings", () => {
        it("sets and gets line width", () => {
            const ctx = createTestContext();
            ctx.setLineWidth(2.5);
            expect(ctx.getLineWidth()).toBeCloseTo(2.5);
        });

        it("sets and gets line cap", () => {
            const ctx = createTestContext();
            ctx.setLineCap(LineCap.ROUND);
            expect(ctx.getLineCap()).toBe(LineCap.ROUND);
        });

        it("sets and gets line join", () => {
            const ctx = createTestContext();
            ctx.setLineJoin(LineJoin.BEVEL);
            expect(ctx.getLineJoin()).toBe(LineJoin.BEVEL);
        });

        it("sets dash pattern", () => {
            const ctx = createTestContext();
            ctx.setDash([5, 3], 0);
        });

        it("gets dash count and dash values", () => {
            const ctx = createTestContext();
            ctx.setDash([5, 3, 2], 1.5);
            expect(ctx.getDashCount()).toBe(3);
            const dash = ctx.getDash();
            expect(dash.dashes).toHaveLength(3);
            expect(dash.dashes[0]).toBeCloseTo(5);
            expect(dash.dashes[1]).toBeCloseTo(3);
            expect(dash.dashes[2]).toBeCloseTo(2);
            expect(dash.offset).toBeCloseTo(1.5);
        });

        it("returns empty dash when none set", () => {
            const ctx = createTestContext();
            ctx.setDash([], 0);
            expect(ctx.getDashCount()).toBe(0);
            const dash = ctx.getDash();
            expect(dash.dashes).toHaveLength(0);
            expect(dash.offset).toBe(0);
        });

        it("sets and gets miter limit", () => {
            const ctx = createTestContext();
            ctx.setMiterLimit(5.0);
            expect(ctx.getMiterLimit()).toBeCloseTo(5.0);
        });

        it("sets and gets tolerance", () => {
            const ctx = createTestContext();
            ctx.setTolerance(0.5);
            expect(ctx.getTolerance()).toBeCloseTo(0.5);
        });
    });

    describe("fill rule", () => {
        it("sets and gets the fill rule", () => {
            const ctx = createTestContext();
            ctx.setFillRule(1);
            expect(ctx.getFillRule()).toBe(1);
        });
    });

    describe("transformations", () => {
        it("saves and restores state", () => {
            const ctx = createTestContext();
            ctx.save();
            ctx.translate(10, 10);
            ctx.restore();
            ctx.moveTo(0, 0);
            const point = ctx.getCurrentPoint();
            expect(point?.x).toBeCloseTo(0);
            expect(point?.y).toBeCloseTo(0);
        });

        it("translates the coordinate system", () => {
            const ctx = createTestContext();
            ctx.translate(50, 50);
        });

        it("scales the coordinate system", () => {
            const ctx = createTestContext();
            ctx.scale(2, 2);
        });

        it("rotates the coordinate system", () => {
            const ctx = createTestContext();
            ctx.rotate(Math.PI / 4);
        });
    });

    describe("operator", () => {
        it("sets and gets the compositing operator", () => {
            const ctx = createTestContext();
            ctx.setOperator(Operator.ADD);
            expect(ctx.getOperator()).toBe(Operator.ADD);
        });
    });

    describe("text", () => {
        it("selects a font face", () => {
            const ctx = createTestContext();
            ctx.selectFontFace("Sans", 0, 0);
        });

        it("sets font size", () => {
            const ctx = createTestContext();
            ctx.setFontSize(14);
        });

        it("shows text", () => {
            const ctx = createTestContext();
            ctx.selectFontFace("Sans", 0, 0);
            ctx.setFontSize(14);
            ctx.moveTo(10, 50);
            ctx.showText("Hello");
        });

        it("adds text to path", () => {
            const ctx = createTestContext();
            ctx.selectFontFace("Sans", 0, 0);
            ctx.setFontSize(14);
            ctx.moveTo(10, 50);
            ctx.textPath("Hello");
        });

        it("measures text extents", () => {
            const ctx = createTestContext();
            ctx.selectFontFace("Sans", 0, 0);
            ctx.setFontSize(14);
            const extents = ctx.textExtents("Hello");
            expect(extents).toHaveProperty("xBearing");
            expect(extents).toHaveProperty("yBearing");
            expect(extents).toHaveProperty("width");
            expect(extents).toHaveProperty("height");
            expect(extents).toHaveProperty("xAdvance");
            expect(extents).toHaveProperty("yAdvance");
            expect(extents.width).toBeGreaterThan(0);
        });

        it("gets font extents", () => {
            const ctx = createTestContext();
            ctx.selectFontFace("Sans", 0, 0);
            ctx.setFontSize(14);
            const fe = ctx.fontExtents();
            expect(fe.ascent).toBeGreaterThan(0);
            expect(fe.descent).toBeGreaterThanOrEqual(0);
            expect(fe.height).toBeGreaterThan(0);
            expect(fe.maxXAdvance).toBeGreaterThan(0);
        });
    });

    describe("font options", () => {
        it("sets and gets font options", () => {
            const ctx = createTestContext();
            const options = new FontOptions();
            ctx.setFontOptions(options);
            const retrieved = ctx.getFontOptions();
            expect(retrieved).not.toBeNull();
        });
    });

    describe("antialias", () => {
        it("sets and gets antialias mode", () => {
            const ctx = createTestContext();
            ctx.setAntialias(0);
            expect(ctx.getAntialias()).toBe(0);
        });
    });

    describe("page operations", () => {
        it("shows a page", () => {
            const ctx = createTestContext();
            ctx.showPage();
        });

        it("copies a page", () => {
            const ctx = createTestContext();
            ctx.copyPage();
        });
    });

    describe("surface interaction", () => {
        it("gets the target surface", () => {
            const surface = createTestSurface();
            const ctx = new Context(surface);
            const target = ctx.getTarget();
            expect(target).not.toBeNull();
        });

        it("sets a surface as source", () => {
            const surface = createTestSurface();
            const ctx = new Context(surface);
            ctx.setSourceSurface(surface, 0, 0);
        });
    });

    describe("extents", () => {
        it("gets stroke extents", () => {
            const ctx = createTestContext();
            ctx.setLineWidth(2);
            ctx.rectangle(10, 10, 80, 60);
            const ext = ctx.strokeExtents();
            expect(ext.x1).toBeLessThan(ext.x2);
            expect(ext.y1).toBeLessThan(ext.y2);
        });

        it("gets fill extents", () => {
            const ctx = createTestContext();
            ctx.rectangle(10, 20, 80, 60);
            const ext = ctx.fillExtents();
            expect(ext.x1).toBeCloseTo(10);
            expect(ext.y1).toBeCloseTo(20);
            expect(ext.x2).toBeCloseTo(90);
            expect(ext.y2).toBeCloseTo(80);
        });

        it("gets clip extents", () => {
            const ctx = createTestContext();
            const ext = ctx.clipExtents();
            expect(ext.x2).toBeGreaterThan(ext.x1);
            expect(ext.y2).toBeGreaterThan(ext.y1);
        });

        it("gets path extents", () => {
            const ctx = createTestContext();
            ctx.rectangle(5, 5, 50, 50);
            const ext = ctx.pathExtents();
            expect(ext.x1).toBeCloseTo(5);
            expect(ext.y1).toBeCloseTo(5);
            expect(ext.x2).toBeCloseTo(55);
            expect(ext.y2).toBeCloseTo(55);
        });
    });

    describe("hit testing", () => {
        it("inStroke detects points on stroke", () => {
            const ctx = createTestContext();
            ctx.setLineWidth(10);
            ctx.moveTo(0, 50);
            ctx.lineTo(100, 50);
            expect(ctx.inStroke(50, 50)).toBe(true);
            expect(ctx.inStroke(50, 100)).toBe(false);
        });

        it("inFill detects points inside fill", () => {
            const ctx = createTestContext();
            ctx.rectangle(10, 10, 80, 80);
            expect(ctx.inFill(50, 50)).toBe(true);
            expect(ctx.inFill(0, 0)).toBe(false);
        });

        it("inClip detects points inside clip", () => {
            const ctx = createTestContext();
            expect(ctx.inClip(50, 50)).toBe(true);
            ctx.rectangle(10, 10, 20, 20);
            ctx.clip();
            expect(ctx.inClip(15, 15)).toBe(true);
            expect(ctx.inClip(50, 50)).toBe(false);
        });
    });

    describe("masking", () => {
        it("masks with a pattern", () => {
            const ctx = createTestContext();
            ctx.setSourceRgb(1, 0, 0);
            const pattern = new SolidPattern(0, 0, 0, 0.5);
            ctx.mask(pattern);
        });

        it("masks with a surface", () => {
            const surface = createTestSurface();
            const ctx = new Context(surface);
            ctx.setSourceRgb(1, 0, 0);
            const maskSurf = surface.createSimilar("ALPHA", 100, 100);
            ctx.maskSurface(maskSurf, 0, 0);
        });
    });

    describe("matrix operations", () => {
        it("sets and gets matrix", () => {
            const ctx = createTestContext();
            const m = Matrix.createTranslate(10, 20);
            ctx.setMatrix(m);
            const got = ctx.getMatrix();
            expect(got.x0).toBeCloseTo(10);
            expect(got.y0).toBeCloseTo(20);
        });

        it("transforms with matrix", () => {
            const ctx = createTestContext();
            const m = Matrix.createScale(2, 2);
            ctx.transform(m);
            const got = ctx.getMatrix();
            expect(got.xx).toBeCloseTo(2);
            expect(got.yy).toBeCloseTo(2);
        });

        it("resets to identity matrix", () => {
            const ctx = createTestContext();
            ctx.translate(50, 50);
            ctx.identityMatrix();
            const m = ctx.getMatrix();
            expect(m.xx).toBeCloseTo(1);
            expect(m.x0).toBeCloseTo(0);
        });

        it("converts user to device coordinates", () => {
            const ctx = createTestContext();
            ctx.translate(10, 20);
            const p = ctx.userToDevice(5, 5);
            expect(p.x).toBeCloseTo(15);
            expect(p.y).toBeCloseTo(25);
        });

        it("converts user to device distance", () => {
            const ctx = createTestContext();
            ctx.scale(2, 3);
            const d = ctx.userToDeviceDistance(5, 5);
            expect(d.dx).toBeCloseTo(10);
            expect(d.dy).toBeCloseTo(15);
        });

        it("converts device to user coordinates", () => {
            const ctx = createTestContext();
            ctx.translate(10, 20);
            const p = ctx.deviceToUser(15, 25);
            expect(p.x).toBeCloseTo(5);
            expect(p.y).toBeCloseTo(5);
        });

        it("converts device to user distance", () => {
            const ctx = createTestContext();
            ctx.scale(2, 3);
            const d = ctx.deviceToUserDistance(10, 15);
            expect(d.dx).toBeCloseTo(5);
            expect(d.dy).toBeCloseTo(5);
        });
    });

    describe("status", () => {
        it("returns SUCCESS for valid context", () => {
            const ctx = createTestContext();
            expect(ctx.status()).toBe(Status.SUCCESS);
        });
    });
});

describe("Pattern", () => {
    describe("createLinear", () => {
        it("creates a linear gradient pattern", () => {
            const pattern = new LinearPattern(0, 0, 100, 100);
            expect(pattern).not.toBeNull();
            expect(pattern).toBeInstanceOf(Pattern);
        });
    });

    describe("createRadial", () => {
        it("creates a radial gradient pattern", () => {
            const pattern = new RadialPattern(50, 50, 10, 50, 50, 50);
            expect(pattern).not.toBeNull();
            expect(pattern).toBeInstanceOf(Pattern);
        });
    });

    describe("createForSurface", () => {
        it("creates a pattern from a surface", () => {
            const surface = createTestSurface();
            const pattern = new SurfacePattern(surface);
            expect(pattern).toBeInstanceOf(Pattern);
            expect(pattern.getType()).toBe(PatternType.SURFACE);
        });
    });

    describe("createRgb", () => {
        it("creates a solid RGB pattern", () => {
            const pattern = new SolidPattern(1, 0, 0);
            expect(pattern).toBeInstanceOf(Pattern);
            expect(pattern.getType()).toBe(PatternType.SOLID);
        });
    });

    describe("createRgba", () => {
        it("creates a solid RGBA pattern", () => {
            const pattern = new SolidPattern(1, 0, 0, 0.5);
            expect(pattern).toBeInstanceOf(Pattern);
            expect(pattern.getType()).toBe(PatternType.SOLID);
        });
    });

    describe("addColorStopRgb", () => {
        it("adds an RGB color stop to a gradient", () => {
            const pattern = new LinearPattern(0, 0, 100, 0);
            pattern.addColorStopRgb(0, 1, 0, 0);
        });
    });

    describe("addColorStopRgba", () => {
        it("adds an RGBA color stop to a gradient", () => {
            const pattern = new LinearPattern(0, 0, 100, 0);
            pattern.addColorStopRgba(0.5, 0, 1, 0, 0.5);
        });
    });

    describe("extend", () => {
        it("sets and gets extend mode", () => {
            const pattern = new LinearPattern(0, 0, 100, 0);
            pattern.setExtend(Extend.REPEAT);
            expect(pattern.getExtend()).toBe(Extend.REPEAT);
        });
    });

    describe("filter", () => {
        it("sets and gets filter", () => {
            const pattern = new LinearPattern(0, 0, 100, 0);
            pattern.setFilter(Filter.NEAREST);
            expect(pattern.getFilter()).toBe(Filter.NEAREST);
        });
    });

    describe("matrix", () => {
        it("sets and gets matrix", () => {
            const pattern = new LinearPattern(0, 0, 100, 0);
            const m = Matrix.createTranslate(5, 10);
            pattern.setMatrix(m);
            const got = pattern.getMatrix();
            expect(got.x0).toBeCloseTo(5);
            expect(got.y0).toBeCloseTo(10);
        });
    });

    describe("getType", () => {
        it("returns LINEAR for linear pattern", () => {
            const pattern = new LinearPattern(0, 0, 100, 0);
            expect(pattern.getType()).toBe(PatternType.LINEAR);
        });

        it("returns RADIAL for radial pattern", () => {
            const pattern = new RadialPattern(50, 50, 10, 50, 50, 50);
            expect(pattern.getType()).toBe(PatternType.RADIAL);
        });
    });
});

describe("FontOptions", () => {
    describe("create", () => {
        it("creates a new FontOptions instance", () => {
            const options = new FontOptions();
            expect(options).not.toBeNull();
        });
    });

    describe("settings", () => {
        it("sets and gets hint style", () => {
            const options = new FontOptions();
            options.setHintStyle(HintStyle.FULL);
            expect(options.getHintStyle()).toBe(HintStyle.FULL);
        });

        it("sets and gets antialias", () => {
            const options = new FontOptions();
            options.setAntialias(1);
            expect(options.getAntialias()).toBe(1);
        });

        it("sets and gets hint metrics", () => {
            const options = new FontOptions();
            options.setHintMetrics(HintMetrics.ON);
            expect(options.getHintMetrics()).toBe(HintMetrics.ON);
        });

        it("sets and gets subpixel order", () => {
            const options = new FontOptions();
            options.setSubpixelOrder(SubpixelOrder.RGB);
            expect(options.getSubpixelOrder()).toBe(SubpixelOrder.RGB);
        });
    });

    describe("equal", () => {
        it("returns true for equal options", () => {
            const a = new FontOptions();
            const b = new FontOptions();
            a.setHintStyle(HintStyle.FULL);
            b.setHintStyle(HintStyle.FULL);
            expect(a.equal(b)).toBe(true);
        });

        it("returns false for different options", () => {
            const a = new FontOptions();
            const b = new FontOptions();
            a.setHintStyle(HintStyle.FULL);
            b.setHintStyle(HintStyle.NONE);
            expect(a.equal(b)).toBe(false);
        });
    });

    describe("merge", () => {
        it("merges another font options into this one", () => {
            const a = new FontOptions();
            const b = new FontOptions();
            b.setHintStyle(HintStyle.FULL);
            a.merge(b);
            expect(a.getHintStyle()).toBe(HintStyle.FULL);
        });
    });

    describe("copy", () => {
        it("creates a copy with same values", () => {
            const orig = new FontOptions();
            orig.setHintStyle(HintStyle.SLIGHT);
            orig.setSubpixelOrder(SubpixelOrder.BGR);
            const copy = orig.copy();
            expect(copy.getHintStyle()).toBe(HintStyle.SLIGHT);
            expect(copy.getSubpixelOrder()).toBe(SubpixelOrder.BGR);
            expect(orig.equal(copy)).toBe(true);
        });
    });
});

describe("Surface", () => {
    describe("createContext", () => {
        it("creates a context from a surface", () => {
            const surface = createTestSurface();
            const ctx = new Context(surface);
            expect(ctx).not.toBeNull();
            expect(ctx).toBeInstanceOf(Context);
        });
    });

    describe("finish", () => {
        it("finishes a surface", () => {
            const surface = createTestSurface();
            expect(() => surface.finish()).not.toThrow();
        });
    });

    describe("createSimilar", () => {
        it("creates a similar surface", () => {
            const surface = createTestSurface();
            const similar = surface.createSimilar("COLOR_ALPHA", 100, 100);
            expect(similar).not.toBeNull();
            expect(similar).toBeInstanceOf(Surface);
        });
    });

    describe("flush and markDirty", () => {
        it("flushes a surface", () => {
            const surface = createTestSurface();
            expect(() => surface.flush()).not.toThrow();
        });

        it("marks a surface dirty", () => {
            const surface = createTestSurface();
            expect(() => surface.markDirty()).not.toThrow();
        });
    });

    describe("writeToPng", () => {
        it("writes surface to PNG file", () => {
            const tmpPath = "/tmp/gtkx-test-cairo-write.png";
            try {
                const surface = new ImageSurface(Format.ARGB32, 10, 10);
                const ctx = new Context(surface);
                ctx.setSourceRgb(1, 0, 0);
                ctx.paint();
                surface.writeToPng(tmpPath);
                expect(existsSync(tmpPath)).toBe(true);
            } finally {
                if (existsSync(tmpPath)) unlinkSync(tmpPath);
            }
        });
    });

    describe("getType", () => {
        it("returns PDF type for PdfSurface", () => {
            const surface = new PdfSurface("/dev/null", 100, 100);
            expect(surface.getType()).toBe(SurfaceType.PDF);
        });

        it("returns IMAGE type for ImageSurface", () => {
            const surface = new ImageSurface(Format.ARGB32, 10, 10);
            expect(surface.getType()).toBe(SurfaceType.IMAGE);
        });
    });

    describe("getContent", () => {
        it("returns content type", () => {
            const surface = new ImageSurface(Format.ARGB32, 10, 10);
            expect(surface.getContent()).toBe(Content.COLOR_ALPHA);
        });
    });
});

describe("ImageSurface", () => {
    it("creates an image surface", () => {
        const surface = new ImageSurface(Format.ARGB32, 100, 50);
        expect(surface).toBeInstanceOf(Surface);
        expect(surface).toBeInstanceOf(ImageSurface);
    });

    it("gets width", () => {
        const surface = new ImageSurface(Format.ARGB32, 100, 50);
        expect(surface.getWidth()).toBe(100);
    });

    it("gets height", () => {
        const surface = new ImageSurface(Format.ARGB32, 100, 50);
        expect(surface.getHeight()).toBe(50);
    });

    it("gets format", () => {
        const surface = new ImageSurface(Format.RGB24, 10, 10);
        expect(surface.getFormat()).toBe(Format.RGB24);
    });

    it("gets stride", () => {
        const surface = new ImageSurface(Format.ARGB32, 10, 10);
        expect(surface.getStride()).toBeGreaterThanOrEqual(40);
    });

    describe("getData", () => {
        it("returns data with correct length", () => {
            const surface = new ImageSurface(Format.ARGB32, 10, 10);
            const data = surface.getData();
            expect(data.length).toBe(surface.getStride() * surface.getHeight());
        });

        it("contains painted pixel values", () => {
            const surface = new ImageSurface(Format.ARGB32, 2, 2);
            const ctx = new Context(surface);
            ctx.setSourceRgba(0, 0, 1, 1);
            ctx.paint();
            const data = surface.getData();
            expect(data[0]).toBe(255);
            expect(data[1]).toBe(0);
            expect(data[2]).toBe(0);
            expect(data[3]).toBe(255);
        });

        it("returns empty array for zero-size surface", () => {
            const surface = new ImageSurface(Format.ARGB32, 0, 0);
            const data = surface.getData();
            expect(data.length).toBe(0);
        });
    });
});

describe("PdfSurface", () => {
    it("creates a PDF surface with given dimensions", () => {
        const tmpPath = "/tmp/gtkx-test-cairo.pdf";
        try {
            const surface = new PdfSurface(tmpPath, 612, 792);
            expect(surface).toBeInstanceOf(Surface);
            const ctx = new Context(surface);
            ctx.setSourceRgb(0, 0, 0);
            ctx.selectFontFace("Sans", 0, 0);
            ctx.setFontSize(12);
            ctx.moveTo(72, 72);
            ctx.showText("Test PDF");
            surface.finish();
            expect(existsSync(tmpPath)).toBe(true);
        } finally {
            if (existsSync(tmpPath)) unlinkSync(tmpPath);
        }
    });
});

describe("Surface.createSimilarImage", () => {
    it("returns an ImageSurface instance", () => {
        const surface = new ImageSurface(Format.ARGB32, 100, 100);
        const similar = surface.createSimilarImage(Format.ARGB32, 50, 30);
        expect(similar).toBeInstanceOf(ImageSurface);
    });

    it("has correct dimensions", () => {
        const surface = new ImageSurface(Format.ARGB32, 100, 100);
        const similar = surface.createSimilarImage(Format.ARGB32, 50, 30);
        expect(similar.getWidth()).toBe(50);
        expect(similar.getHeight()).toBe(30);
    });
});

describe("Context.hasCurrentPoint", () => {
    it("returns false on fresh context", () => {
        const ctx = createTestContext();
        expect(ctx.hasCurrentPoint()).toBe(false);
    });

    it("returns true after moveTo", () => {
        const ctx = createTestContext();
        ctx.moveTo(10, 20);
        expect(ctx.hasCurrentPoint()).toBe(true);
    });

    it("returns false after newPath", () => {
        const ctx = createTestContext();
        ctx.moveTo(10, 20);
        ctx.newPath();
        expect(ctx.hasCurrentPoint()).toBe(false);
    });
});

describe("Region.createRectangles", () => {
    it("creates from multiple non-overlapping rects", () => {
        const region = Region.createRectangles([
            { x: 0, y: 0, width: 10, height: 10 },
            { x: 20, y: 20, width: 10, height: 10 },
            { x: 40, y: 40, width: 10, height: 10 },
        ]);
        expect(region.numRectangles()).toBe(3);
    });

    it("creates empty region from empty array", () => {
        const region = Region.createRectangles([]);
        expect(region.isEmpty()).toBe(true);
    });
});
