import {
    Context,
    FontFace,
    FontOptions,
    FontSlant,
    FontWeight,
    Format,
    HintStyle,
    ImageSurface,
    Matrix,
    ScaledFont,
    Status,
    ToyFontFace,
} from "@gtkx/cairo";
import { describe, expect, it } from "vitest";

const createContext = (): Context => Context.create(new ImageSurface(Format.ARGB32, 16, 16));
const createToyFace = (): ToyFontFace => FontFace.create("Sans", FontSlant.NORMAL, FontWeight.NORMAL);

const createScaledFont = (fontMatrix = Matrix.initScale(12, 12)): ScaledFont =>
    ScaledFont.create(createToyFace(), fontMatrix, Matrix.initIdentity(), FontOptions.create());

const asToyFontFace = (face: FontFace): ToyFontFace => {
    if (face instanceof ToyFontFace) {
        return face;
    }

    throw new TypeError("Expected a ToyFontFace");
};

describe("FontFace", () => {
    it("creates a toy font face with its family, slant and weight", () => {
        const face = createToyFace();
        expect(face).toBeInstanceOf(ToyFontFace);
        expect(face).toBeInstanceOf(FontFace);
        expect(face.status()).toBe(Status.SUCCESS);
        expect(face.getFamily()).toBe("Sans");
        expect(face.getSlant()).toBe(FontSlant.NORMAL);
        expect(face.getWeight()).toBe(FontWeight.NORMAL);
    });

    it("wraps the face selected on a context as a toy font face", () => {
        const ctx = createContext();
        ctx.selectFontFace("Sans", FontSlant.NORMAL, FontWeight.NORMAL);
        const face = ctx.getFontFace();
        expect(face).toBeInstanceOf(ToyFontFace);
        expect(asToyFontFace(face).getFamily()).toBe("Sans");
    });

    it("rejects a non-string family", () => {
        expect(() => FontFace.create(123 as never, FontSlant.NORMAL, FontWeight.NORMAL)).toThrow();
    });
});

describe("ScaledFont", () => {
    it("creates a scaled font and reports its matrices", () => {
        const font = createScaledFont();
        expect(font).toBeInstanceOf(ScaledFont);
        expect(font.status()).toBe(Status.SUCCESS);
        expect(font.getFontMatrix().transformDistance(1, 0).dx).toBe(12);
        expect(font.getCtm().transformDistance(1, 0).dx).toBe(1);
        expect(font.getScaleMatrix().transformDistance(1, 0).dx).toBe(12);
    });

    it("wraps its font face as a toy font face", () => {
        const face = createScaledFont().getFontFace();
        expect(face).toBeInstanceOf(ToyFontFace);
        expect(asToyFontFace(face).getFamily()).toBe("Sans");
    });

    it("returns the scaled font a context uses", () => {
        const ctx = createContext();
        ctx.setFontSize(12);
        expect(ctx.getScaledFont()).toBeInstanceOf(ScaledFont);
    });

    it("measures text, glyphs and the font itself", () => {
        const font = createScaledFont();
        expect(font.textExtents("ab").width).toBeGreaterThan(0);
        expect(font.glyphExtents([{ index: 0, x: 0, y: 0 }]).width).toBeGreaterThan(0);
        expect(font.extents().ascent).toBeGreaterThan(0);
    });

    it("draws glyphs with a forward text-cluster mapping", () => {
        const surface = new ImageSurface(Format.ARGB32, 16, 16);
        const ctx = Context.create(surface);
        ctx.setFontSize(12);
        ctx.showTextGlyphs("A", [{ index: 0, x: 0, y: 12 }], [{ numBytes: 1, numGlyphs: 1 }], 0);
        expect(ctx.status()).toBe(Status.SUCCESS);
        expect(surface.getData().some((byte) => byte !== 0)).toBe(true);
        ctx.showTextGlyphs("", [], [], 0);
        expect(ctx.status()).toBe(Status.SUCCESS);
    });

    it("reports a mismatched text-cluster mapping", () => {
        const ctx = createContext();
        ctx.showTextGlyphs("A", [], [], 0);
        expect(ctx.status()).toBe(Status.INVALID_CLUSTERS);
    });

    it("returns a copy of its font options", () => {
        const options = createScaledFont().getFontOptions();
        expect(options).toBeInstanceOf(FontOptions);
        expect(options.status()).toBe(Status.SUCCESS);
    });

    it("still reports a status with a degenerate font matrix", () => {
        const status = createScaledFont(Matrix.initScale(0, 0)).status();
        expect(Object.values(Status)).toContain(status);
    });

    it("rejects a scaled font with a singular device transformation", () => {
        const face = createToyFace();
        const fontMatrix = Matrix.initScale(12, 12);
        const ctm = new Matrix(1, 1, 1, 1, 0, 0);
        const options = FontOptions.create();
        expect(() => ScaledFont.create(face, fontMatrix, ctm, options)).toThrow();
        expect(() => new ScaledFont(face, fontMatrix, ctm, options)).toThrow();
    });

    it("rejects a missing font face", () => {
        const identity = Matrix.initIdentity();
        expect(() => ScaledFont.create(undefined as never, identity, identity, FontOptions.create())).toThrow();
        expect(() => new ScaledFont(undefined as never, identity, identity, FontOptions.create())).toThrow();
    });
});

describe("FontOptions", () => {
    it("sets, copies and clears font variations", () => {
        const options = FontOptions.create();
        expect(options.getVariations()).toBeNull();
        options.setVariations("wght=700");
        const copy = new FontOptions(options);
        expect(copy.getVariations()).toBe("wght=700");
        options.setVariations(null);
        expect(options.getVariations()).toBeNull();
        expect(copy.getVariations()).toBe("wght=700");
        expect(copy.equal(options)).toBe(false);
    });
    it("copies another set of options and compares equal to it", () => {
        const options = FontOptions.create();
        options.setHintStyle(HintStyle.FULL);
        const copy = new FontOptions(options);
        expect(copy.equal(options)).toBe(true);
        expect(copy.getHintStyle()).toBe(HintStyle.FULL);
        expect(copy.hash()).toBe(options.hash());
    });

    it("merges the non-default settings of another set", () => {
        const options = FontOptions.create();
        const other = FontOptions.create();
        other.setHintStyle(HintStyle.SLIGHT);
        options.merge(other);
        expect(options.getHintStyle()).toBe(HintStyle.SLIGHT);
    });

    it("rejects a missing source when copying", () => {
        expect(() => new FontOptions(null as never)).toThrow();
    });
});
