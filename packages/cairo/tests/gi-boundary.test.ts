import {
    Context,
    FontFace,
    FontType,
    Format,
    FtFontFace,
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

    it("hands a Context to PangoCairo and receives a working layout", () => {
        const layout = PangoCairo.createLayout(snapshotContext());
        expect(layout).toBeInstanceOf(Pango.Layout);
        layout.setText("ab", -1);
        expect(layout.getCharacterCount()).toBe(2);
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
