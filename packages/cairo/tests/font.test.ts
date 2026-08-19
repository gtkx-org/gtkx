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

    it("shapes text into glyphs and clusters", () => {
        const [glyphs, clusters] = createScaledFont().textToGlyphs(0, 0, "ab");
        expect(glyphs).toHaveLength(2);
        expect(clusters).toHaveLength(2);

        for (const glyph of glyphs) {
            expect(glyph.index).toBeGreaterThan(0);
        }
    });

    it("measures text, glyphs and the font itself", () => {
        const font = createScaledFont();
        const [glyphs] = font.textToGlyphs(0, 0, "ab");
        expect(font.textExtents("ab").width).toBeGreaterThan(0);
        expect(font.glyphExtents(glyphs).width).toBeGreaterThan(0);
        expect(font.extents().ascent).toBeGreaterThan(0);
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

    it("rejects a missing font face", () => {
        const identity = Matrix.initIdentity();
        expect(() => ScaledFont.create(undefined as never, identity, identity, FontOptions.create())).toThrow();
        expect(() => new ScaledFont(undefined as never, identity, identity, FontOptions.create())).toThrow();
    });
});

describe("FontOptions", () => {
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
