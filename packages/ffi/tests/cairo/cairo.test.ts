import { existsSync, unlinkSync } from "node:fs";
import {
    Content,
    Context,
    Extend,
    Filter,
    FontOptions,
    Format,
    HintMetrics,
    HintStyle,
    ImageSurface,
    LineCap,
    LineJoin,
    MeshPattern,
    Operator,
    Pattern,
    PatternType,
    Region,
    Status,
    SubpixelOrder,
    Surface,
    SurfaceType,
} from "@gtkx/gi/cairo";
import { describe, expect, it } from "vitest";

const createTestSurface = (): Surface => {
    return ImageSurface.create(Format.ARGB32, 200, 200);
};

const createTestContext = (): Context => {
    return Context.create(createTestSurface());
};

describe("Matrix", () => {
    it("creates an identity matrix", () => {
        const m = Pattern.createLinear(0, 0, 1, 1).getMatrix();
        const p = m.transformPoint(5, 7);
        expect(p[0]).toBeCloseTo(5);
        expect(p[1]).toBeCloseTo(7);
    });

    it("creates a translation matrix", () => {
        const m = Pattern.createLinear(0, 0, 1, 1).getMatrix();
        m.translate(5, 10);
        const p = m.transformPoint(0, 0);
        expect(p[0]).toBeCloseTo(5);
        expect(p[1]).toBeCloseTo(10);
    });

    it("creates a scale matrix", () => {
        const m = Pattern.createLinear(0, 0, 1, 1).getMatrix();
        m.scale(2, 3);
        const d = m.transformDistance(1, 1);
        expect(d[0]).toBeCloseTo(2);
        expect(d[1]).toBeCloseTo(3);
    });

    it("creates a rotation matrix", () => {
        const m = Pattern.createLinear(0, 0, 1, 1).getMatrix();
        m.rotate(Math.PI / 2);
        const d = m.transformDistance(1, 0);
        expect(d[0]).toBeCloseTo(0, 5);
        expect(d[1]).toBeCloseTo(1, 5);
    });

    it("inverts", () => {
        const m = Pattern.createLinear(0, 0, 1, 1).getMatrix();
        m.scale(2, 4);
        m.invert();
        const d = m.transformDistance(2, 4);
        expect(d[0]).toBeCloseTo(1);
        expect(d[1]).toBeCloseTo(1);
    });

    it("transforms a point", () => {
        const m = Pattern.createLinear(0, 0, 1, 1).getMatrix();
        m.translate(10, 20);
        const p = m.transformPoint(5, 5);
        expect(p[0]).toBeCloseTo(15);
        expect(p[1]).toBeCloseTo(25);
    });

    it("transforms a distance", () => {
        const m = Pattern.createLinear(0, 0, 1, 1).getMatrix();
        m.scale(3, 4);
        const d = m.transformDistance(2, 3);
        expect(d[0]).toBeCloseTo(6);
        expect(d[1]).toBeCloseTo(12);
    });
});

describe("Context — path operations: basic moves and lines", () => {
    it("moves to a point", () => {
        const ctx = createTestContext();
        ctx.moveTo(10, 20);
        const point = ctx.getCurrentPoint();
        expect(point).not.toBeNull();
        expect(point?.[0]).toBeCloseTo(10);
        expect(point?.[1]).toBeCloseTo(20);
    });

    it("draws a line to a point", () => {
        const ctx = createTestContext();
        ctx.moveTo(0, 0);
        ctx.lineTo(50, 50);
        const point = ctx.getCurrentPoint();
        expect(point?.[0]).toBeCloseTo(50);
        expect(point?.[1]).toBeCloseTo(50);
    });

    it("performs relative move", () => {
        const ctx = createTestContext();
        ctx.moveTo(10, 10);
        ctx.relMoveTo(5, 5);
        const point = ctx.getCurrentPoint();
        expect(point?.[0]).toBeCloseTo(15);
        expect(point?.[1]).toBeCloseTo(15);
    });

    it("performs relative line", () => {
        const ctx = createTestContext();
        ctx.moveTo(10, 10);
        ctx.relLineTo(20, 30);
        const point = ctx.getCurrentPoint();
        expect(point?.[0]).toBeCloseTo(30);
        expect(point?.[1]).toBeCloseTo(40);
    });
});

describe("Context — path operations: curves and arcs", () => {
    it("draws a curve", () => {
        const ctx = createTestContext();
        ctx.moveTo(0, 0);
        ctx.curveTo({ x1: 10, y1: 10, x2: 20, y2: 20, x3: 30, y3: 30 });
        const point = ctx.getCurrentPoint();
        expect(point?.[0]).toBeCloseTo(30);
        expect(point?.[1]).toBeCloseTo(30);
    });

    it("draws a relative curve", () => {
        const ctx = createTestContext();
        ctx.moveTo(0, 0);
        ctx.relCurveTo({ dx1: 10, dy1: 10, dx2: 20, dy2: 20, dx3: 30, dy3: 30 });
        const point = ctx.getCurrentPoint();
        expect(point?.[0]).toBeCloseTo(30);
        expect(point?.[1]).toBeCloseTo(30);
    });

    it("draws an arc", () => {
        const ctx = createTestContext();
        ctx.arc({ xc: 50, yc: 50, radius: 25, angle1: 0, angle2: Math.PI * 2 });
        const point = ctx.getCurrentPoint();
        expect(point).not.toBeNull();
    });

    it("draws a negative arc", () => {
        const ctx = createTestContext();
        ctx.arcNegative({ xc: 50, yc: 50, radius: 25, angle1: Math.PI * 2, angle2: 0 });
        const point = ctx.getCurrentPoint();
        expect(point).not.toBeNull();
    });
});

describe("Context — path operations: rectangles and closing", () => {
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
        expect(point?.[0]).toBeCloseTo(0);
        expect(point?.[1]).toBeCloseTo(0);
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

describe("Context — getCurrentPoint", () => {
    it("returns null when no current point exists", () => {
        const ctx = createTestContext();
        expect(ctx.getCurrentPoint()).toBeNull();
    });

    it("returns coordinates after moveTo", () => {
        const ctx = createTestContext();
        ctx.moveTo(42, 84);
        const point = ctx.getCurrentPoint();
        expect(point).toEqual([42, 84]);
    });
});

describe("Context — drawing operations", () => {
    it("strokes the current path", () => {
        const ctx = createTestContext();
        ctx.moveTo(0, 0);
        ctx.lineTo(100, 100);
        ctx.stroke();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("strokes preserving the path", () => {
        const ctx = createTestContext();
        ctx.moveTo(0, 0);
        ctx.lineTo(100, 100);
        ctx.strokePreserve();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("fills the current path", () => {
        const ctx = createTestContext();
        ctx.rectangle(0, 0, 100, 100);
        ctx.fill();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("fills preserving the path", () => {
        const ctx = createTestContext();
        ctx.rectangle(0, 0, 100, 100);
        ctx.fillPreserve();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("paints the entire surface", () => {
        const ctx = createTestContext();
        ctx.paint();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("paints with alpha", () => {
        const ctx = createTestContext();
        ctx.paintWithAlpha(0.5);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — clipping", () => {
    it("clips to the current path", () => {
        const ctx = createTestContext();
        ctx.rectangle(10, 10, 80, 80);
        ctx.clip();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("clips preserving the path", () => {
        const ctx = createTestContext();
        ctx.rectangle(10, 10, 80, 80);
        ctx.clipPreserve();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("resets the clip region", () => {
        const ctx = createTestContext();
        ctx.resetClip();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — source color", () => {
    it("sets source RGB", () => {
        const ctx = createTestContext();
        ctx.setSourceRgb(1, 0, 0);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("sets source RGBA", () => {
        const ctx = createTestContext();
        ctx.setSourceRgba(1, 0, 0, 0.5);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("sets a pattern as source", () => {
        const ctx = createTestContext();
        const pattern = Pattern.createLinear(0, 0, 100, 100);
        pattern.addColorStopRgb(0, 1, 0, 0);
        pattern.addColorStopRgb(1, 0, 0, 1);
        ctx.setSource(pattern);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — line settings", () => {
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

    it("reports zero dash count by default", () => {
        const ctx = createTestContext();
        expect(ctx.getDashCount()).toBe(0);
        const dash = ctx.getDash();
        expect(dash[0]).toHaveLength(0);
        expect(dash[1]).toBe(0);
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

describe("Context — fill rule", () => {
    it("sets and gets the fill rule", () => {
        const ctx = createTestContext();
        ctx.setFillRule(1);
        expect(ctx.getFillRule()).toBe(1);
    });
});

describe("Context — transformations", () => {
    it("saves and restores state", () => {
        const ctx = createTestContext();
        ctx.save();
        ctx.translate(10, 10);
        ctx.restore();
        ctx.moveTo(0, 0);
        const point = ctx.getCurrentPoint();
        expect(point?.[0]).toBeCloseTo(0);
        expect(point?.[1]).toBeCloseTo(0);
    });

    it("translates the coordinate system", () => {
        const ctx = createTestContext();
        ctx.translate(50, 50);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("scales the coordinate system", () => {
        const ctx = createTestContext();
        ctx.scale(2, 2);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("rotates the coordinate system", () => {
        const ctx = createTestContext();
        ctx.rotate(Math.PI / 4);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — operator", () => {
    it("sets and gets the compositing operator", () => {
        const ctx = createTestContext();
        ctx.setOperator(Operator.ADD);
        expect(ctx.getOperator()).toBe(Operator.ADD);
    });
});

describe("Context — text: font setup and rendering", () => {
    it("selects a font face", () => {
        const ctx = createTestContext();
        ctx.selectFontFace("Sans", 0, 0);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("sets font size", () => {
        const ctx = createTestContext();
        ctx.setFontSize(14);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("shows text", () => {
        const ctx = createTestContext();
        ctx.selectFontFace("Sans", 0, 0);
        ctx.setFontSize(14);
        ctx.moveTo(10, 50);
        ctx.showText("Hello");
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("adds text to path", () => {
        const ctx = createTestContext();
        ctx.selectFontFace("Sans", 0, 0);
        ctx.setFontSize(14);
        ctx.moveTo(10, 50);
        ctx.textPath("Hello");
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — text: extents", () => {
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

describe("Context — font options", () => {
    it("sets and gets font options", () => {
        const ctx = createTestContext();
        const options = FontOptions.create();
        ctx.setFontOptions(options);
        const retrieved = ctx.getFontOptions();
        expect(retrieved).not.toBeNull();
    });
});

describe("Context — antialias", () => {
    it("sets and gets antialias mode", () => {
        const ctx = createTestContext();
        ctx.setAntialias(0);
        expect(ctx.getAntialias()).toBe(0);
    });
});

describe("Context — page operations", () => {
    it("shows a page", () => {
        const ctx = createTestContext();
        ctx.showPage();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("copies a page", () => {
        const ctx = createTestContext();
        ctx.copyPage();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — surface interaction", () => {
    it("gets the target surface", () => {
        const surface = createTestSurface();
        const ctx = Context.create(surface);
        const target = ctx.getTarget();
        expect(target).not.toBeNull();
    });

    it("sets a surface as source", () => {
        const surface = createTestSurface();
        const ctx = Context.create(surface);
        ctx.setSourceSurface(surface, 0, 0);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — extents", () => {
    it("gets stroke extents", () => {
        const ctx = createTestContext();
        ctx.setLineWidth(2);
        ctx.rectangle(10, 10, 80, 60);
        const ext = ctx.strokeExtents();
        expect(ext[0]).toBeLessThan(ext[2]);
        expect(ext[1]).toBeLessThan(ext[3]);
    });

    it("gets fill extents", () => {
        const ctx = createTestContext();
        ctx.rectangle(10, 20, 80, 60);
        const ext = ctx.fillExtents();
        expect(ext[0]).toBeCloseTo(10);
        expect(ext[1]).toBeCloseTo(20);
        expect(ext[2]).toBeCloseTo(90);
        expect(ext[3]).toBeCloseTo(80);
    });

    it("gets clip extents", () => {
        const ctx = createTestContext();
        const ext = ctx.clipExtents();
        expect(ext[2]).toBeGreaterThan(ext[0]);
        expect(ext[3]).toBeGreaterThan(ext[1]);
    });

    it("gets path extents", () => {
        const ctx = createTestContext();
        ctx.rectangle(5, 5, 50, 50);
        const ext = ctx.pathExtents();
        expect(ext[0]).toBeCloseTo(5);
        expect(ext[1]).toBeCloseTo(5);
        expect(ext[2]).toBeCloseTo(55);
        expect(ext[3]).toBeCloseTo(55);
    });
});

describe("Context — hit testing", () => {
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

describe("Context — masking", () => {
    it("masks with a pattern", () => {
        const ctx = createTestContext();
        ctx.setSourceRgb(1, 0, 0);
        const pattern = Pattern.createRgba(0, 0, 0, 0.5);
        ctx.mask(pattern);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("masks with a surface", () => {
        const surface = createTestSurface();
        const ctx = Context.create(surface);
        ctx.setSourceRgb(1, 0, 0);
        const maskSurf = Surface.createSimilar(surface, Content.ALPHA, 100, 100);
        ctx.maskSurface(maskSurf, 0, 0);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — matrix operations: setting and transforming", () => {
    it("sets and gets matrix", () => {
        const ctx = createTestContext();
        const m = ctx.getMatrix();
        m.translate(10, 20);
        ctx.setMatrix(m);
        const got = ctx.getMatrix();
        const p = got.transformPoint(0, 0);
        expect(p[0]).toBeCloseTo(10);
        expect(p[1]).toBeCloseTo(20);
    });

    it("transforms with matrix", () => {
        const ctx = createTestContext();
        const m = ctx.getMatrix();
        m.scale(2, 2);
        ctx.transform(m);
        const d = ctx.getMatrix().transformDistance(1, 1);
        expect(d[0]).toBeCloseTo(2);
        expect(d[1]).toBeCloseTo(2);
    });

    it("resets to identity matrix", () => {
        const ctx = createTestContext();
        ctx.translate(50, 50);
        ctx.identityMatrix();
        const p = ctx.getMatrix().transformPoint(0, 0);
        expect(p[0]).toBeCloseTo(0);
        expect(p[1]).toBeCloseTo(0);
    });
});

describe("Context — matrix operations: coordinate conversion", () => {
    it("converts user to device coordinates", () => {
        const ctx = createTestContext();
        ctx.translate(10, 20);
        const p = ctx.userToDevice(5, 5);
        expect(p[0]).toBeCloseTo(15);
        expect(p[1]).toBeCloseTo(25);
    });

    it("converts user to device distance", () => {
        const ctx = createTestContext();
        ctx.scale(2, 3);
        const d = ctx.userToDeviceDistance(5, 5);
        expect(d[0]).toBeCloseTo(10);
        expect(d[1]).toBeCloseTo(15);
    });

    it("converts device to user coordinates", () => {
        const ctx = createTestContext();
        ctx.translate(10, 20);
        const p = ctx.deviceToUser(15, 25);
        expect(p[0]).toBeCloseTo(5);
        expect(p[1]).toBeCloseTo(5);
    });

    it("converts device to user distance", () => {
        const ctx = createTestContext();
        ctx.scale(2, 3);
        const d = ctx.deviceToUserDistance(10, 15);
        expect(d[0]).toBeCloseTo(5);
        expect(d[1]).toBeCloseTo(5);
    });
});

describe("Context — status", () => {
    it("returns SUCCESS for valid context", () => {
        const ctx = createTestContext();
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("reports a positive reference count", () => {
        const ctx = createTestContext();
        expect(ctx.getReferenceCount()).toBeGreaterThan(0);
    });
});

describe("Pattern — createLinear", () => {
    it("creates a linear gradient pattern", () => {
        const pattern = Pattern.createLinear(0, 0, 100, 100);
        expect(pattern).not.toBeNull();
        expect(pattern).toBeInstanceOf(Pattern);
    });

    it("reports its linear points", () => {
        const pattern = Pattern.createLinear(1, 2, 30, 40);
        const points = pattern.getLinearPoints();
        expect(points.x0).toBeCloseTo(1);
        expect(points.y0).toBeCloseTo(2);
        expect(points.x1).toBeCloseTo(30);
        expect(points.y1).toBeCloseTo(40);
    });
});

describe("Pattern — createRadial", () => {
    it("creates a radial gradient pattern", () => {
        const pattern = Pattern.createRadial({ cx0: 50, cy0: 50, radius0: 10, cx1: 50, cy1: 50, radius1: 50 });
        expect(pattern).not.toBeNull();
        expect(pattern).toBeInstanceOf(Pattern);
    });

    it("reports its circles", () => {
        const pattern = Pattern.createRadial({ cx0: 1, cy0: 2, radius0: 3, cx1: 4, cy1: 5, radius1: 6 });
        const circles = pattern.getRadialCircles();
        expect(circles.x0).toBeCloseTo(1);
        expect(circles.r0).toBeCloseTo(3);
        expect(circles.r1).toBeCloseTo(6);
    });
});

describe("Pattern — createForSurface", () => {
    it("creates a pattern from a surface", () => {
        const surface = createTestSurface();
        const pattern = Pattern.createForSurface(surface);
        expect(pattern).toBeInstanceOf(Pattern);
        expect(pattern.getType()).toBe(PatternType.SURFACE);
    });
});

describe("Pattern — createRgb", () => {
    it("creates a solid RGB pattern", () => {
        const pattern = Pattern.createRgb(1, 0, 0);
        expect(pattern).toBeInstanceOf(Pattern);
        expect(pattern.getType()).toBe(PatternType.SOLID);
    });

    it("reports its color", () => {
        const pattern = Pattern.createRgb(0.25, 0.5, 0.75);
        const rgba = pattern.getRgba();
        expect(rgba.red).toBeCloseTo(0.25);
        expect(rgba.green).toBeCloseTo(0.5);
        expect(rgba.blue).toBeCloseTo(0.75);
    });
});

describe("Pattern — createRgba", () => {
    it("creates a solid RGBA pattern", () => {
        const pattern = Pattern.createRgba(1, 0, 0, 0.5);
        expect(pattern).toBeInstanceOf(Pattern);
        expect(pattern.getType()).toBe(PatternType.SOLID);
    });
});

describe("Pattern — createMesh", () => {
    it("creates a mesh pattern", () => {
        const pattern = Pattern.createMesh();
        expect(pattern).toBeInstanceOf(MeshPattern);
    });

    it("records a patch", () => {
        const pattern = Pattern.createMesh();
        pattern.beginPatch();
        pattern.moveTo(0, 0);
        pattern.lineTo(10, 0);
        pattern.lineTo(10, 10);
        pattern.lineTo(0, 10);
        pattern.setCornerColorRgb(0, 1, 0, 0);
        pattern.endPatch();
        expect(pattern.getPatchCount()).toBe(1);
    });
});

describe("Pattern — addColorStopRgb", () => {
    it("adds an RGB color stop to a gradient", () => {
        const pattern = Pattern.createLinear(0, 0, 100, 0);
        pattern.addColorStopRgb(0, 1, 0, 0);
        expect(pattern.status()).toBe(Status.SUCCESS);
        expect(pattern.getColorStopCount()).toBe(1);
    });
});

describe("Pattern — addColorStopRgba", () => {
    it("adds an RGBA color stop to a gradient", () => {
        const pattern = Pattern.createLinear(0, 0, 100, 0);
        pattern.addColorStopRgba({ offset: 0.5, red: 0, green: 1, blue: 0, alpha: 0.5 });
        expect(pattern.status()).toBe(Status.SUCCESS);
        const stop = pattern.getColorStopRgba(0);
        expect(stop.offset).toBeCloseTo(0.5);
        expect(stop.green).toBeCloseTo(1);
    });
});

describe("Pattern — extend", () => {
    it("sets and gets extend mode", () => {
        const pattern = Pattern.createLinear(0, 0, 100, 0);
        pattern.setExtend(Extend.REPEAT);
        expect(pattern.getExtend()).toBe(Extend.REPEAT);
    });
});

describe("Pattern — filter", () => {
    it("sets and gets filter", () => {
        const pattern = Pattern.createLinear(0, 0, 100, 0);
        pattern.setFilter(Filter.NEAREST);
        expect(pattern.getFilter()).toBe(Filter.NEAREST);
    });
});

describe("Pattern — matrix", () => {
    it("sets and gets matrix", () => {
        const pattern = Pattern.createLinear(0, 0, 100, 0);
        const m = pattern.getMatrix();
        m.translate(5, 10);
        pattern.setMatrix(m);
        const got = pattern.getMatrix();
        const p = got.transformPoint(0, 0);
        expect(p[0]).toBeCloseTo(5);
        expect(p[1]).toBeCloseTo(10);
    });
});

describe("Pattern — getType", () => {
    it("returns LINEAR for linear pattern", () => {
        const pattern = Pattern.createLinear(0, 0, 100, 0);
        expect(pattern.getType()).toBe(PatternType.LINEAR);
    });

    it("returns RADIAL for radial pattern", () => {
        const pattern = Pattern.createRadial({ cx0: 50, cy0: 50, radius0: 10, cx1: 50, cy1: 50, radius1: 50 });
        expect(pattern.getType()).toBe(PatternType.RADIAL);
    });
});

describe("Pattern — getReferenceCount", () => {
    it("reports a positive reference count", () => {
        const pattern = Pattern.createLinear(0, 0, 100, 0);
        expect(pattern.getReferenceCount()).toBeGreaterThan(0);
    });
});

describe("FontOptions — create", () => {
    it("creates a new FontOptions instance", () => {
        const options = FontOptions.create();
        expect(options).not.toBeNull();
    });
});

describe("FontOptions — settings", () => {
    it("sets and gets hint style", () => {
        const options = FontOptions.create();
        options.setHintStyle(HintStyle.FULL);
        expect(options.getHintStyle()).toBe(HintStyle.FULL);
    });

    it("sets and gets antialias", () => {
        const options = FontOptions.create();
        options.setAntialias(1);
        expect(options.getAntialias()).toBe(1);
    });

    it("sets and gets hint metrics", () => {
        const options = FontOptions.create();
        options.setHintMetrics(HintMetrics.ON);
        expect(options.getHintMetrics()).toBe(HintMetrics.ON);
    });

    it("sets and gets subpixel order", () => {
        const options = FontOptions.create();
        options.setSubpixelOrder(SubpixelOrder.RGB);
        expect(options.getSubpixelOrder()).toBe(SubpixelOrder.RGB);
    });
});

describe("FontOptions — equal", () => {
    it("returns true for equal options", () => {
        const a = FontOptions.create();
        const b = FontOptions.create();
        a.setHintStyle(HintStyle.FULL);
        b.setHintStyle(HintStyle.FULL);
        expect(a.equal(b)).toBe(true);
    });

    it("returns false for different options", () => {
        const a = FontOptions.create();
        const b = FontOptions.create();
        a.setHintStyle(HintStyle.FULL);
        b.setHintStyle(HintStyle.NONE);
        expect(a.equal(b)).toBe(false);
    });
});

describe("FontOptions — merge", () => {
    it("merges another font options into this one", () => {
        const a = FontOptions.create();
        const b = FontOptions.create();
        b.setHintStyle(HintStyle.FULL);
        a.merge(b);
        expect(a.getHintStyle()).toBe(HintStyle.FULL);
    });
});

describe("FontOptions — hash", () => {
    it("returns equal hashes for equal options", () => {
        const a = FontOptions.create();
        const b = FontOptions.create();
        a.setHintStyle(HintStyle.SLIGHT);
        b.setHintStyle(HintStyle.SLIGHT);
        expect(a.hash()).toBe(b.hash());
    });
});

describe("Surface — createContext", () => {
    it("creates a context from a surface", () => {
        const surface = createTestSurface();
        const ctx = Context.create(surface);
        expect(ctx).not.toBeNull();
        expect(ctx).toBeInstanceOf(Context);
    });
});

describe("Surface — finish", () => {
    it("finishes a surface", () => {
        const surface = createTestSurface();
        expect(() => surface.finish()).not.toThrow();
    });
});

describe("Surface — createSimilar", () => {
    it("creates a similar surface", () => {
        const surface = createTestSurface();
        const similar = Surface.createSimilar(surface, Content.COLOR_ALPHA, 100, 100);
        expect(similar).not.toBeNull();
        expect(similar).toBeInstanceOf(Surface);
    });
});

describe("Surface — createForRectangle", () => {
    it("creates a sub-surface", () => {
        const surface = createTestSurface();
        const sub = Surface.createForRectangle(surface, { x: 10, y: 10, width: 50, height: 50 });
        expect(sub).toBeInstanceOf(Surface);
    });
});

describe("Surface — flush and markDirty", () => {
    it("flushes a surface", () => {
        const surface = createTestSurface();
        expect(() => surface.flush()).not.toThrow();
    });

    it("marks a surface dirty", () => {
        const surface = createTestSurface();
        expect(() => surface.markDirty()).not.toThrow();
    });
});

describe("Surface — writeToPng", () => {
    it("writes surface to PNG file", () => {
        const tmpPath = "/tmp/gtkx-test-cairo-write.png";
        try {
            const surface = ImageSurface.create(Format.ARGB32, 10, 10);
            const ctx = Context.create(surface);
            ctx.setSourceRgb(1, 0, 0);
            ctx.paint();
            surface.writeToPng(tmpPath);
            expect(existsSync(tmpPath)).toBe(true);
        } finally {
            if (existsSync(tmpPath)) unlinkSync(tmpPath);
        }
    });
});

describe("Surface — getType", () => {
    it("returns IMAGE type for ImageSurface", () => {
        const surface = ImageSurface.create(Format.ARGB32, 10, 10);
        expect(surface.getType()).toBe(SurfaceType.IMAGE);
    });
});

describe("Surface — getContent", () => {
    it("returns content type", () => {
        const surface = ImageSurface.create(Format.ARGB32, 10, 10);
        expect(surface.getContent()).toBe(Content.COLOR_ALPHA);
    });
});

describe("Surface — getFontOptions", () => {
    it("returns a FontOptions instance", () => {
        const surface = createTestSurface();
        const options = surface.getFontOptions();
        expect(options).toBeInstanceOf(FontOptions);
    });
});

describe("Surface — getReferenceCount", () => {
    it("reports a positive reference count", () => {
        const surface = createTestSurface();
        expect(surface.getReferenceCount()).toBeGreaterThan(0);
    });
});

describe("ImageSurface", () => {
    it("creates an image surface", () => {
        const surface = ImageSurface.create(Format.ARGB32, 100, 50);
        expect(surface).toBeInstanceOf(Surface);
        expect(surface).toBeInstanceOf(ImageSurface);
    });

    it("gets width", () => {
        const surface = ImageSurface.create(Format.ARGB32, 100, 50);
        expect(surface.getWidth()).toBe(100);
    });

    it("gets height", () => {
        const surface = ImageSurface.create(Format.ARGB32, 100, 50);
        expect(surface.getHeight()).toBe(50);
    });

    it("gets format", () => {
        const surface = ImageSurface.create(Format.RGB24, 10, 10);
        expect(surface.getFormat()).toBe(Format.RGB24);
    });

    it("gets stride", () => {
        const surface = ImageSurface.create(Format.ARGB32, 10, 10);
        expect(surface.getStride()).toBeGreaterThanOrEqual(40);
    });

    describe("getData", () => {
        it("returns data with correct length", () => {
            const surface = ImageSurface.create(Format.ARGB32, 10, 10);
            const data = surface.getData();
            expect(data.length).toBe(surface.getStride() * surface.getHeight());
        });

        it("contains painted pixel values", () => {
            const surface = ImageSurface.create(Format.ARGB32, 2, 2);
            const ctx = Context.create(surface);
            ctx.setSourceRgba(0, 0, 1, 1);
            ctx.paint();
            const data = surface.getData();
            expect(data[0]).toBe(255);
            expect(data[1]).toBe(0);
            expect(data[2]).toBe(0);
            expect(data[3]).toBe(255);
        });

        it("returns empty array for zero-size surface", () => {
            const surface = ImageSurface.create(Format.ARGB32, 0, 0);
            const data = surface.getData();
            expect(data.length).toBe(0);
        });
    });
});

describe("Surface.createSimilarImage", () => {
    it("returns a Surface instance", () => {
        const surface = ImageSurface.create(Format.ARGB32, 100, 100);
        const similar = Surface.createSimilarImage(surface, Format.ARGB32, 50, 30);
        expect(similar).toBeInstanceOf(Surface);
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

describe("Region", () => {
    it("creates a rectangle region", () => {
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
