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
    Matrix,
    MeshPattern,
    Operator,
    Pattern,
    PatternType,
    RecordingSurface,
    RectangleInt,
    Region,
    Status,
    SubpixelOrder,
    Surface,
    SurfaceType,
} from "@gtkx/cairo";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const createTestSurface = (): Surface => {
    return ImageSurface.create(Format.ARGB32, 200, 200);
};

const createTestContext = (): Context => {
    return Context.create(createTestSurface());
};

const createTextContext = (): Context => {
    const ctx = createTestContext();
    ctx.selectFontFace("Sans", 0, 0);
    ctx.setFontSize(14);

    return ctx;
};

const createIdentityMatrix = (): Matrix => Pattern.createLinear(0, 0, 1, 1).getMatrix();
const createGradientPattern = (): Pattern => Pattern.createLinear(0, 0, 100, 0);

const createHintedOptions = (style: HintStyle): FontOptions => {
    const options = FontOptions.create();
    options.setHintStyle(style);

    return options;
};

const expectStatusSuccess = (draw: (ctx: Context) => void): void => {
    const ctx = createTestContext();
    draw(ctx);
    expect(ctx.status()).toBe(Status.SUCCESS);
};

const expectCurveEndsAt30 = (curve: (ctx: Context) => void): void => {
    const ctx = createTestContext();
    ctx.moveTo(0, 0);
    curve(ctx);
    const point = ctx.getCurrentPoint();
    expect(point?.x).toBeCloseTo(30);
    expect(point?.y).toBeCloseTo(30);
};

describe("Matrix (1)", () => {
    it("constructs from explicit components", () => {
        const m = new Matrix(1, 0, 0, 1, 5, 7);
        const p = m.transformPoint(0, 0);
        expect(p.x).toBeCloseTo(5);
        expect(p.y).toBeCloseTo(7);
    });

    it("creates an identity matrix", () => {
        const m = createIdentityMatrix();
        const p = m.transformPoint(5, 7);
        expect(p.x).toBeCloseTo(5);
        expect(p.y).toBeCloseTo(7);
    });

    it("creates a translation matrix", () => {
        const m = createIdentityMatrix();
        m.translate(5, 10);
        const p = m.transformPoint(0, 0);
        expect(p.x).toBeCloseTo(5);
        expect(p.y).toBeCloseTo(10);
    });

    it("creates a scale matrix", () => {
        const m = createIdentityMatrix();
        m.scale(2, 3);
        const d = m.transformDistance(1, 1);
        expect(d.dx).toBeCloseTo(2);
        expect(d.dy).toBeCloseTo(3);
    });
});

describe("Matrix (2)", () => {
    it("creates a rotation matrix", () => {
        const m = createIdentityMatrix();
        m.rotate(Math.PI / 2);
        const d = m.transformDistance(1, 0);
        expect(d.dx).toBeCloseTo(0, 5);
        expect(d.dy).toBeCloseTo(1, 5);
    });

    it("inverts", () => {
        const m = createIdentityMatrix();
        m.scale(2, 4);
        m.invert();
        const d = m.transformDistance(2, 4);
        expect(d.dx).toBeCloseTo(1);
        expect(d.dy).toBeCloseTo(1);
    });

    it("transforms a point", () => {
        const m = createIdentityMatrix();
        m.translate(10, 20);
        const p = m.transformPoint(5, 5);
        expect(p.x).toBeCloseTo(15);
        expect(p.y).toBeCloseTo(25);
    });

    it("transforms a distance", () => {
        const m = createIdentityMatrix();
        m.scale(3, 4);
        const d = m.transformDistance(2, 3);
        expect(d.dx).toBeCloseTo(6);
        expect(d.dy).toBeCloseTo(12);
    });
});

describe("Context — path operations: basic moves and lines", () => {
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
});

describe("Context — path operations: curves and arcs", () => {
    it("draws a curve", () => {
        expectCurveEndsAt30((ctx) => {
            ctx.curveTo(10, 10, 20, 20, 30, 30);
        });
    });

    it("draws a relative curve", () => {
        expectCurveEndsAt30((ctx) => {
            ctx.relCurveTo(10, 10, 20, 20, 30, 30);
        });
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

describe("Context — getCurrentPoint", () => {
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

describe("Context — drawing operations", () => {
    it("strokes the current path", () => {
        expectStatusSuccess((ctx) => {
            ctx.moveTo(0, 0);
            ctx.lineTo(100, 100);
            ctx.stroke();
        });
    });

    it("strokes preserving the path", () => {
        expectStatusSuccess((ctx) => {
            ctx.moveTo(0, 0);
            ctx.lineTo(100, 100);
            ctx.strokePreserve();
        });
    });

    it("fills the current path", () => {
        expectStatusSuccess((ctx) => {
            ctx.rectangle(0, 0, 100, 100);
            ctx.fill();
        });
    });

    it("fills preserving the path", () => {
        expectStatusSuccess((ctx) => {
            ctx.rectangle(0, 0, 100, 100);
            ctx.fillPreserve();
        });
    });

    it("paints the entire surface", () => {
        expectStatusSuccess((ctx) => {
            ctx.paint();
        });
    });

    it("paints with alpha", () => {
        expectStatusSuccess((ctx) => {
            ctx.paintWithAlpha(0.5);
        });
    });
});

describe("Context — clipping", () => {
    it("clips to the current path", () => {
        expectStatusSuccess((ctx) => {
            ctx.rectangle(10, 10, 80, 80);
            ctx.clip();
        });
    });

    it("clips preserving the path", () => {
        expectStatusSuccess((ctx) => {
            ctx.rectangle(10, 10, 80, 80);
            ctx.clipPreserve();
        });
    });

    it("resets the clip region", () => {
        expectStatusSuccess((ctx) => {
            ctx.resetClip();
        });
    });

    it("reports the clip as a rectangle list", () => {
        const ctx = createTestContext();
        ctx.rectangle(10, 20, 80, 40);
        ctx.clip();
        expect(ctx.copyClipRectangleList()).toEqual([{ x: 10, y: 20, width: 80, height: 40 }]);
    });

    it("reports every rectangle of a clip made of several", () => {
        const ctx = createTestContext();
        ctx.rectangle(0, 0, 10, 10);
        ctx.rectangle(50, 50, 20, 20);
        ctx.clip();

        expect(ctx.copyClipRectangleList()).toEqual([
            { x: 0, y: 0, width: 10, height: 10 },
            { x: 50, y: 50, width: 20, height: 20 },
        ]);
    });

    it("reports the whole surface when nothing is clipped", () => {
        expect(createTestContext().copyClipRectangleList()).toEqual([{ x: 0, y: 0, width: 200, height: 200 }]);
    });

    it("reports no rectangles for a clip that is not rectangular", () => {
        const ctx = createTestContext();
        ctx.arc(50, 50, 20, 0, Math.PI * 2);
        ctx.clip();
        expect(ctx.copyClipRectangleList()).toEqual([]);
    });
});

describe("Context — source color", () => {
    it("sets source RGB", () => {
        expectStatusSuccess((ctx) => {
            ctx.setSourceRgb(1, 0, 0);
        });
    });

    it("sets source RGBA", () => {
        expectStatusSuccess((ctx) => {
            ctx.setSourceRgba(1, 0, 0, 0.5);
        });
    });

    it("sets a pattern as source", () => {
        expectStatusSuccess((ctx) => {
            const pattern = Pattern.createLinear(0, 0, 100, 100);
            pattern.addColorStopRgb(0, 1, 0, 0);
            pattern.addColorStopRgb(1, 0, 0, 1);
            ctx.setSource(pattern);
        });
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
        expect(dash.dashes).toHaveLength(0);
        expect(dash.offset).toBe(0);
    });

    it("sets and reads back a dash pattern", () => {
        const ctx = createTestContext();
        ctx.setDash([5, 3], 1);
        expect(ctx.getDashCount()).toBe(2);
        const dash = ctx.getDash();
        expect(dash.dashes).toEqual([5, 3]);
        expect(dash.offset).toBeCloseTo(1);
    });

    it("sets and gets miter limit", () => {
        const ctx = createTestContext();
        ctx.setMiterLimit(5);
        expect(ctx.getMiterLimit()).toBeCloseTo(5);
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
        expect(point?.x).toBeCloseTo(0);
        expect(point?.y).toBeCloseTo(0);
    });

    it("translates the coordinate system", () => {
        expectStatusSuccess((ctx) => {
            ctx.translate(50, 50);
        });
    });

    it("scales the coordinate system", () => {
        expectStatusSuccess((ctx) => {
            ctx.scale(2, 2);
        });
    });

    it("rotates the coordinate system", () => {
        expectStatusSuccess((ctx) => {
            ctx.rotate(Math.PI / 4);
        });
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
        expectStatusSuccess((ctx) => {
            ctx.selectFontFace("Sans", 0, 0);
        });
    });

    it("sets font size", () => {
        expectStatusSuccess((ctx) => {
            ctx.setFontSize(14);
        });
    });

    it("shows text", () => {
        const ctx = createTextContext();
        ctx.moveTo(10, 50);
        ctx.showText("Hello");
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("adds text to path", () => {
        const ctx = createTextContext();
        ctx.moveTo(10, 50);
        ctx.textPath("Hello");
        expect(ctx.status()).toBe(Status.SUCCESS);
    });
});

describe("Context — text: extents", () => {
    it("measures text extents", () => {
        const ctx = createTextContext();
        const extents = ctx.textExtents("Hello");
        expect(ctx.textExtents("").width).toBe(0);
        expect(extents.width).toBeGreaterThan(0);
        expect(extents.height).toBeGreaterThan(0);
        expect(extents.xAdvance).toBeGreaterThanOrEqual(extents.width);
        expect(ctx.textExtents("HelloHello").width).toBeGreaterThan(extents.width);
    });

    it("gets font extents", () => {
        const ctx = createTextContext();
        const fe = ctx.fontExtents();
        expect(fe.ascent).toBeGreaterThan(0);
        expect(fe.descent).toBeGreaterThanOrEqual(0);
        expect(fe.height).toBeGreaterThanOrEqual(fe.ascent);
        expect(fe.maxXAdvance).toBeGreaterThanOrEqual(ctx.textExtents("H").xAdvance);
    });
});

describe("Context — font options", () => {
    it("sets and gets font options", () => {
        const ctx = createTestContext();
        ctx.setFontOptions(createHintedOptions(HintStyle.FULL));
        expect(ctx.getFontOptions().getHintStyle()).toBe(HintStyle.FULL);
        ctx.setFontOptions(createHintedOptions(HintStyle.NONE));
        expect(ctx.getFontOptions().getHintStyle()).toBe(HintStyle.NONE);
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
        expectStatusSuccess((ctx) => {
            ctx.showPage();
        });
    });

    it("copies a page", () => {
        expectStatusSuccess((ctx) => {
            ctx.copyPage();
        });
    });
});

describe("Context — surface interaction", () => {
    it("gets the target surface", () => {
        const target = Context.create(createTestSurface()).getTarget();
        expect(target.getType()).toBe(SurfaceType.IMAGE);
        expect(target.getContent()).toBe(Content.COLOR_ALPHA);
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
        expectStatusSuccess((ctx) => {
            ctx.setSourceRgb(1, 0, 0);
            const pattern = Pattern.createRgba(0, 0, 0, 0.5);
            ctx.mask(pattern);
        });
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
        expect(p.x).toBeCloseTo(10);
        expect(p.y).toBeCloseTo(20);
    });

    it("transforms with matrix", () => {
        const ctx = createTestContext();
        const m = ctx.getMatrix();
        m.scale(2, 2);
        ctx.transform(m);
        const d = ctx.getMatrix().transformDistance(1, 1);
        expect(d.dx).toBeCloseTo(2);
        expect(d.dy).toBeCloseTo(2);
    });

    it("resets to identity matrix", () => {
        const ctx = createTestContext();
        ctx.translate(50, 50);
        ctx.identityMatrix();
        const p = ctx.getMatrix().transformPoint(0, 0);
        expect(p.x).toBeCloseTo(0);
        expect(p.y).toBeCloseTo(0);
    });
});

describe("Context — matrix operations: coordinate conversion", () => {
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
    it("reports its circles", () => {
        const pattern = Pattern.createRadial(1, 2, 3, 4, 5, 6);
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
        expect(pattern.getType()).toBe(PatternType.SURFACE);
        expect(pattern.getExtend()).toBe(Extend.NONE);
    });
});

describe("Pattern — createRgb", () => {
    it("creates a solid RGB pattern", () => {
        const pattern = Pattern.createRgb(1, 0, 0);
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
        expect(pattern.getType()).toBe(PatternType.SOLID);
        expect(pattern.getRgba().alpha).toBeCloseTo(0.5);
    });
});

describe("Pattern — createMesh", () => {
    it("creates a mesh pattern", () => {
        const pattern = Pattern.createMesh();
        expect(pattern).toBeInstanceOf(MeshPattern);
        expect(pattern.getType()).toBe(PatternType.MESH);
        expect(pattern.getPatchCount()).toBe(0);
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
        const pattern = createGradientPattern();
        pattern.addColorStopRgb(0, 1, 0, 0);
        expect(pattern.status()).toBe(Status.SUCCESS);
        expect(pattern.getColorStopCount()).toBe(1);
    });
});

describe("Pattern — addColorStopRgba", () => {
    it("adds an RGBA color stop to a gradient", () => {
        const pattern = createGradientPattern();
        pattern.addColorStopRgba(0.5, 0, 1, 0, 0.5);
        expect(pattern.status()).toBe(Status.SUCCESS);
        const stop = pattern.getColorStopRgba(0);
        expect(stop.offset).toBeCloseTo(0.5);
        expect(stop.green).toBeCloseTo(1);
    });
});

describe("Pattern — extend", () => {
    it("sets and gets extend mode", () => {
        const pattern = createGradientPattern();
        pattern.setExtend(Extend.REPEAT);
        expect(pattern.getExtend()).toBe(Extend.REPEAT);
    });
});

describe("Pattern — filter", () => {
    it("sets and gets filter", () => {
        const pattern = createGradientPattern();
        pattern.setFilter(Filter.NEAREST);
        expect(pattern.getFilter()).toBe(Filter.NEAREST);
    });
});

describe("Pattern — matrix", () => {
    it("sets and gets matrix", () => {
        const pattern = createGradientPattern();
        const m = pattern.getMatrix();
        m.translate(5, 10);
        pattern.setMatrix(m);
        const got = pattern.getMatrix();
        const p = got.transformPoint(0, 0);
        expect(p.x).toBeCloseTo(5);
        expect(p.y).toBeCloseTo(10);
    });
});

describe("Pattern — getType", () => {
    it("returns LINEAR for linear pattern", () => {
        const pattern = createGradientPattern();
        expect(pattern.getType()).toBe(PatternType.LINEAR);
    });

    it("returns RADIAL for radial pattern", () => {
        const pattern = Pattern.createRadial(50, 50, 10, 50, 50, 50);
        expect(pattern.getType()).toBe(PatternType.RADIAL);
    });
});

describe("Pattern — getReferenceCount", () => {
    it("counts the reference a context takes when the pattern becomes its source", () => {
        const pattern = createGradientPattern();
        const before = pattern.getReferenceCount();
        createTestContext().setSource(pattern);
        expect(pattern.getReferenceCount()).toBe(before + 1);
    });
});

describe("FontOptions — create", () => {
    it("creates options carrying the cairo defaults", () => {
        const options = FontOptions.create();
        expect(options.getHintStyle()).toBe(HintStyle.DEFAULT);
        expect(options.getHintMetrics()).toBe(HintMetrics.DEFAULT);
        expect(options.getSubpixelOrder()).toBe(SubpixelOrder.DEFAULT);
    });

    it("constructs a fresh instance via new", () => {
        expect(new FontOptions().equal(FontOptions.create())).toBe(true);
    });

    it("copies an existing instance via new", () => {
        const original = new FontOptions();
        original.setHintStyle(HintStyle.FULL);
        const copy = new FontOptions(original);
        expect(copy.getHintStyle()).toBe(HintStyle.FULL);
        expect(copy.equal(original)).toBe(true);
    });
});

describe("FontOptions — settings", () => {
    it("sets and gets hint style", () => {
        expect(createHintedOptions(HintStyle.FULL).getHintStyle()).toBe(HintStyle.FULL);
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
        expect(createHintedOptions(HintStyle.FULL).equal(createHintedOptions(HintStyle.FULL))).toBe(true);
    });

    it("returns false for different options", () => {
        expect(createHintedOptions(HintStyle.FULL).equal(createHintedOptions(HintStyle.NONE))).toBe(false);
    });
});

describe("FontOptions — merge", () => {
    it("merges another font options into this one", () => {
        const a = FontOptions.create();
        a.merge(createHintedOptions(HintStyle.FULL));
        expect(a.getHintStyle()).toBe(HintStyle.FULL);
    });
});

describe("FontOptions — hash", () => {
    it("returns equal hashes for equal options", () => {
        const a = createHintedOptions(HintStyle.SLIGHT);
        const b = createHintedOptions(HintStyle.SLIGHT);
        expect(a.hash()).toBe(b.hash());
    });
});

describe("Surface — createContext", () => {
    it("creates a context that draws into the surface it was given", () => {
        const surface = ImageSurface.create(Format.ARGB32, 2, 2);
        const ctx = Context.create(surface);
        ctx.setSourceRgba(0, 1, 0, 1);
        ctx.paint();
        surface.flush();
        expect([...surface.getData().slice(0, 4)]).toEqual([0, 255, 0, 255]);
    });
});

describe("Surface — finish", () => {
    it("refuses further drawing once a surface is finished", () => {
        const surface = createTestSurface();
        surface.finish();
        expect(surface.status()).toBe(Status.SUCCESS);
        expect(() => Context.create(surface)).toThrow();
    });
});

describe("Surface — createSimilar", () => {
    it("creates a similar surface", () => {
        const surface = createTestSurface();
        const similar = Surface.createSimilar(surface, Content.COLOR_ALPHA, 100, 100);
        expect(similar.getType()).toBe(SurfaceType.IMAGE);
        expect(similar.getContent()).toBe(Content.COLOR_ALPHA);
        expect(similar.status()).toBe(Status.SUCCESS);
    });
});

describe("Surface — createForRectangle", () => {
    it("creates a sub-surface drawing into its slice of the target", () => {
        const surface = ImageSurface.create(Format.ARGB32, 4, 4);
        const sub = Surface.createForRectangle(surface, 2, 0, 2, 4);
        const ctx = Context.create(sub);
        ctx.setSourceRgba(0, 0, 1, 1);
        ctx.paint();
        sub.flush();
        surface.flush();

        expect([...surface.getData().slice(0, 16)]).toEqual([
            0, 0, 0, 0,
            0, 0, 0, 0,
            255, 0, 0, 255,
            255, 0, 0, 255,
        ]);
    });
});

describe("Surface — flush and markDirty", () => {
    it("carries drawing done through a context into the surface data", () => {
        const surface = ImageSurface.create(Format.ARGB32, 2, 2);
        const ctx = Context.create(surface);
        ctx.setSourceRgba(1, 0, 0, 1);
        ctx.paint();
        surface.flush();
        expect([...surface.getData().slice(0, 4)]).toEqual([0, 0, 255, 255]);
    });

    it("keeps a surface usable after its data is marked dirty", () => {
        const surface = ImageSurface.create(Format.ARGB32, 2, 2);
        surface.markDirty();
        const ctx = Context.create(surface);
        ctx.setSourceRgba(0, 0, 1, 1);
        ctx.paint();
        surface.markDirty();
        surface.flush();
        expect([...surface.getData().slice(0, 4)]).toEqual([255, 0, 0, 255]);
        expect(surface.status()).toBe(Status.SUCCESS);
    });
});

describe("Surface — writeToPng", () => {
    it("writes surface to PNG file", () => {
        const outputDir = mkdtempSync(join(tmpdir(), "gtkx-cairo-"));
        const tmpPath = join(outputDir, "write.png");

        try {
            const surface = ImageSurface.create(Format.ARGB32, 10, 10);
            const ctx = Context.create(surface);
            ctx.setSourceRgb(1, 0, 0);
            ctx.paint();
            surface.writeToPng(tmpPath);
            expect(existsSync(tmpPath)).toBe(true);
        } finally {
            rmSync(outputDir, { recursive: true, force: true });
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
    it("reports the options an image surface renders text with", () => {
        const options = createTestSurface().getFontOptions();
        expect(options.getHintStyle()).toBe(HintStyle.DEFAULT);
        expect(options.getHintMetrics()).toBe(HintMetrics.ON);
    });
});

describe("Surface — getReferenceCount", () => {
    it("counts the reference a context takes on its target", () => {
        const surface = createTestSurface();
        const before = surface.getReferenceCount();
        Context.create(surface);
        expect(surface.getReferenceCount()).toBeGreaterThan(before);
    });
});

describe("ImageSurface (1)", () => {
    it("creates an image surface", () => {
        const surface = ImageSurface.create(Format.ARGB32, 100, 50);
        expect(surface.getWidth()).toBe(100);
        expect(surface.getHeight()).toBe(50);
        expect(surface.getFormat()).toBe(Format.ARGB32);
    });

    it("constructs via new", () => {
        const surface = new ImageSurface(Format.ARGB32, 64, 32);
        expect(surface.getWidth()).toBe(64);
        expect(surface.getHeight()).toBe(32);
    });

    it("gets format", () => {
        const surface = ImageSurface.create(Format.RGB24, 10, 10);
        expect(surface.getFormat()).toBe(Format.RGB24);
    });

    it("gets stride", () => {
        const surface = ImageSurface.create(Format.ARGB32, 10, 10);
        expect(surface.getStride()).toBeGreaterThanOrEqual(40);
    });
});

describe("ImageSurface (2)", () => {
    describe("getData", () => {
        it("returns data with correct length", () => {
            const surface = ImageSurface.create(Format.ARGB32, 10, 10);
            const data = surface.getData();
            expect(data).toHaveLength(surface.getStride() * surface.getHeight());
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
            expect(data).toHaveLength(0);
        });
    });
});

describe("Surface.createSimilarImage", () => {
    it("returns an image surface with the content the given format carries", () => {
        const surface = ImageSurface.create(Format.ARGB32, 100, 100);
        expect(Surface.createSimilarImage(surface, Format.RGB24, 50, 30).getContent()).toBe(Content.COLOR);
        expect(Surface.createSimilarImage(surface, Format.ARGB32, 50, 30).getContent()).toBe(Content.COLOR_ALPHA);
        expect(Surface.createSimilarImage(surface, Format.ARGB32, 50, 30).getType()).toBe(SurfaceType.IMAGE);
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

    it("constructs from a rectangle via new", () => {
        const region = new Region(new RectangleInt({ x: 0, y: 0, width: 10, height: 10 }));
        expect(region.numRectangles()).toBe(1);
        expect(region.isEmpty()).toBe(false);
    });

    it("copies a region via the static copy", () => {
        const region = new Region(new RectangleInt({ x: 0, y: 0, width: 10, height: 10 }));
        const copy = Region.copy(region);
        expect(copy.numRectangles()).toBe(1);
        expect(copy.equal(region)).toBe(true);
    });
});

describe("RecordingSurface", () => {
    it("constructs an unbounded surface via new", () => {
        const surface = new RecordingSurface(Content.COLOR_ALPHA);
        expect(surface.getContent()).toBe(Content.COLOR_ALPHA);
        expect(surface.getExtents()).toBeNull();
        expect(surface.status()).toBe(Status.SUCCESS);
    });

    it("constructs a bounded surface and reports its extents", () => {
        const surface = new RecordingSurface(Content.COLOR_ALPHA, { x: 0, y: 0, width: 100, height: 50 });
        expect(surface.getExtents()).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    });
});

describe("Reference ownership", () => {
    it("creates a context holding the only reference", () => {
        const ctx = Context.create(createTestSurface());
        expect(ctx.getReferenceCount()).toBe(1);
    });

    it("creates a group pattern holding the only reference", () => {
        const ctx = createTestContext();
        ctx.pushGroup();
        expect(ctx.popGroup().getReferenceCount()).toBe(1);
    });

    it("creates similar surfaces holding the only reference", () => {
        const surface = createTestSurface();
        expect(Surface.createSimilar(surface, Content.COLOR_ALPHA, 10, 10).getReferenceCount()).toBe(1);
        expect(Surface.createSimilarImage(surface, Format.ARGB32, 10, 10).getReferenceCount()).toBe(1);
    });
});

describe("Pattern.getSurface", () => {
    it("returns the surface of a surface pattern as its concrete subclass", () => {
        const surface = ImageSurface.create(Format.ARGB32, 30, 10);
        const pattern = Pattern.createForSurface(surface);
        const retrieved = pattern.getSurface();
        expect(retrieved).toBeInstanceOf(ImageSurface);
        expect(retrieved instanceof ImageSurface ? retrieved.getWidth() : null).toBe(30);
    });

    it("returns a recording surface pattern's surface as a recording surface", () => {
        const pattern = Pattern.createForSurface(new RecordingSurface(Content.COLOR_ALPHA));
        expect(pattern.getSurface()).toBeInstanceOf(RecordingSurface);
    });

    it("throws for a gradient pattern", () => {
        expect(() => Pattern.createLinear(0, 0, 1, 1).getSurface()).toThrow();
    });

    it("throws for a solid pattern", () => {
        expect(() => Pattern.createRgb(1, 0, 0).getSurface()).toThrow();
    });
});

describe("Error statuses", () => {
    it("keeps successful factories silent", () => {
        expect(ImageSurface.create(Format.ARGB32, 1, 1).status()).toBe(Status.SUCCESS);
        expect(Pattern.createRgb(0, 0, 0).status()).toBe(Status.SUCCESS);
    });

    it("throws when creating an image surface with an invalid size", () => {
        expect(() => ImageSurface.create(Format.ARGB32, -5, -5)).toThrow();
        expect(() => new ImageSurface(Format.ARGB32, -5, -5)).toThrow();
    });

    it("throws when creating a similar surface with an invalid size", () => {
        expect(() => Surface.createSimilar(createTestSurface(), Content.COLOR_ALPHA, -1, -1)).toThrow();
    });
});
