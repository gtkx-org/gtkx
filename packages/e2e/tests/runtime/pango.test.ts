import * as Pango from "@gtkx/gi/pango";
import { describe, expect, it } from "vitest";

describe("Pango.GlyphString.glyphs", () => {
    it("round-trips the glyph array including nested geometry and bitfield attrs", () => {
        const glyphString = Pango.GlyphString.new();
        glyphString.setSize(2);
        expect(glyphString.numGlyphs).toBe(2);
        const glyphs = glyphString.glyphs;
        expect(glyphs).toHaveLength(2);
        const first = glyphs[0];
        const second = glyphs[1];
        expect(first).toBeDefined();
        expect(second).toBeDefined();

        if (!first || !second) {
            return;
        }

        first.glyph = 65;
        first.geometry = { width: 1024, xOffset: 8, yOffset: -4 };
        first.attr = { isClusterStart: 1, isColor: 0 };
        second.glyph = 66;
        second.geometry = { width: 2048, xOffset: -16, yOffset: 32 };
        second.attr = { isClusterStart: 0, isColor: 1 };
        glyphString.glyphs = glyphs;
        const readBack = glyphString.glyphs;
        expect(readBack[0]?.glyph).toBe(65);
        expect(readBack[0]?.geometry).toEqual({ width: 1024, xOffset: 8, yOffset: -4 });
        expect(readBack[0]?.attr).toEqual({ isClusterStart: 1, isColor: 0 });
        expect(readBack[1]?.glyph).toBe(66);
        expect(readBack[1]?.geometry).toEqual({ width: 2048, xOffset: -16, yOffset: 32 });
        expect(readBack[1]?.attr).toEqual({ isClusterStart: 0, isColor: 1 });
    });
});

describe("Pango.GlyphVisAttr", () => {
    it("packs bitfield members into a single storage unit", () => {
        const attr = new Pango.GlyphVisAttr();
        attr.isClusterStart = 1;
        attr.isColor = 1;
        expect(attr.isClusterStart).toBe(1);
        expect(attr.isColor).toBe(1);
        attr.isClusterStart = 0;
        expect(attr.isClusterStart).toBe(0);
        expect(attr.isColor).toBe(1);
    });
});
