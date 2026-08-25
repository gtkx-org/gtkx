import {
    Context,
    FontFace,
    FontOptions,
    FontType,
    Format,
    FtFontFace,
    HintStyle,
    ImageSurface,
    LinearPattern,
    Pattern,
    PatternType,
    RecordingSurface,
    Region,
    ScaledFont,
    Status,
    Surface,
    SurfaceType,
} from "@gtkx/cairo";
import * as Gdk from "@gtkx/gi/gdk";
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import * as PangoCairo from "@gtkx/gi/pangocairo";
import { describe, expect, it } from "vitest";

type SurfaceClass = abstract new (...args: never[]) => Surface;

const CONCRETE_SURFACE_CLASSES: Partial<Record<SurfaceType, SurfaceClass>> = {
    [SurfaceType.IMAGE]: ImageSurface,
    [SurfaceType.RECORDING]: RecordingSurface,
};

const snapshotContext = (): Context => new Gtk.Snapshot().appendCairo(new Graphene.Rect().init(0, 0, 8, 8));

const loadScaledFont = (): ScaledFont => {
    const fontMap = PangoCairo.FontMap.getDefault();
    const font = fontMap.createContext().loadFont(Pango.FontDescription.fromString("Sans 12"));

    if (!(font instanceof PangoCairo.Font)) {
        throw new TypeError("Expected the loaded font to implement PangoCairo.Font");
    }

    const scaledFont = font.getScaledFont();

    if (scaledFont === null) {
        throw new TypeError("Expected the loaded font to carry a scaled font");
    }

    return scaledFont;
};

describe("cairo values crossing the GI boundary", () => {
    it("wraps a snapshot's drawing context as Context and its target as the concrete surface class", () => {
        const cr = snapshotContext();
        expect(cr).toBeInstanceOf(Context);
        expect(cr.status()).toBe(Status.SUCCESS);
        const target = cr.getTarget();
        expect(target).toBeInstanceOf(Surface);
        expect(target).toBeInstanceOf(CONCRETE_SURFACE_CLASSES[target.getType()] ?? Surface);
    });

    it("wraps a region Gdk computes from a surface as Region", () => {
        const region = Gdk.cairoRegionCreateFromSurface(new ImageSurface(Format.ARGB32, 4, 4));
        expect(region).toBeInstanceOf(Region);
        expect(region.numRectangles()).toBeGreaterThanOrEqual(0);
    });

    it("wraps the source Gdk installs from a color as a solid pattern", () => {
        const cr = snapshotContext();
        Gdk.cairoSetSourceRgba(cr, new Gdk.RGBA({ red: 1, green: 0, blue: 0, alpha: 1 }));
        const source = cr.getSource();
        expect(source).toBeInstanceOf(Pattern);
        expect(source).not.toBeInstanceOf(LinearPattern);
        expect(source.getType()).toBe(PatternType.SOLID);
    });

    it("wraps a font loaded through PangoCairo as ScaledFont with a concrete font face", () => {
        const scaledFont = loadScaledFont();
        expect(scaledFont).toBeInstanceOf(ScaledFont);
        const expectedFaceClass = scaledFont.getType() === FontType.FT ? FtFontFace : FontFace;
        expect(scaledFont.getFontFace()).toBeInstanceOf(expectedFaceClass);
    });

    it("backs two wrappers of one native surface by the same object", () => {
        const cr = snapshotContext();
        const first = cr.getTarget();
        const second = cr.getTarget();
        expect(first).toBeInstanceOf(Surface);
        expect(second).toBeInstanceOf(Surface);
        first.setDeviceOffset(3, 4);
        expect(second.getDeviceOffset()).toEqual({ xOffset: 3, yOffset: 4 });
    });

    it("throws when Gdk receives no surface", () => {
        expect(() => Gdk.cairoRegionCreateFromSurface(undefined as never)).toThrow();
    });
});

describe("PangoCairo text layout", () => {
    it("shares FontOptions and renders text through a Cairo context", () => {
        const surface = new ImageSurface(Format.ARGB32, 96, 32);
        const cr = Context.create(surface);
        const layout = PangoCairo.createLayout(cr);
        const options = FontOptions.create();
        options.setHintStyle(HintStyle.FULL);
        PangoCairo.contextSetFontOptions(layout.getContext(), options);
        layout.setFontDescription(Pango.FontDescription.fromString("Sans 16"));
        layout.setText("GTKX", -1);
        cr.setSourceRgb(1, 1, 1);
        PangoCairo.showLayout(cr, layout);
        const appliedOptions = PangoCairo.contextGetFontOptions(layout.getContext());
        expect(layout).toBeInstanceOf(Pango.Layout);
        expect(appliedOptions).toBeInstanceOf(FontOptions);
        expect(appliedOptions?.getHintStyle()).toBe(HintStyle.FULL);
        expect(surface.getData().some((byte) => byte !== 0)).toBe(true);
    });

    it("leaves the target unchanged for an empty layout", () => {
        const surface = new ImageSurface(Format.ARGB32, 8, 8);
        const cr = Context.create(surface);
        const layout = PangoCairo.createLayout(cr);
        const before = surface.getData();
        layout.setText("", -1);
        PangoCairo.showLayout(cr, layout);
        expect(surface.getData()).toEqual(before);
    });

    it("rejects a missing Cairo context", () => {
        expect(() => PangoCairo.createLayout(undefined as never)).toThrow();
    });
});

describe("generated bindings returning cairo boxed values", () => {
    it("wraps a cairo node's draw context as Context and its surface as a recording surface", () => {
        const node = Gsk.CairoNode.new(new Graphene.Rect().init(0, 0, 10, 10));
        const cr = node.getDrawContext();
        expect(cr).toBeInstanceOf(Context);
        cr.setSourceRgb(1, 0, 0);
        cr.paint();
        expect(node.getSurface()).toBeInstanceOf(RecordingSurface);
    });
});
