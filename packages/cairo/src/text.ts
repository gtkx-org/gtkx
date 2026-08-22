import { alloc, type ExternalObject, type Handle, t } from "@gtkx/runtime";
import type { CairoGlyph, CairoTextCluster, FontExtents, TextExtents } from "./types.js";

const GLYPH_SIZE = 24;
const CLUSTER_SIZE = 8;
const TEXT_EXTENTS_SIZE = 48;
const FONT_EXTENTS_SIZE = 40;
const DOUBLE = t.fieldAt(t.float64);
const UINT64 = t.fieldAt(t.uint64);
const INT = t.fieldAt(t.int32);

const allocGlyphBuffer = (glyphs: CairoGlyph[]): ExternalObject<Handle> => {
    const buffer = alloc(glyphs.length * GLYPH_SIZE);
    let offset = 0;

    for (const glyph of glyphs) {
        UINT64.write(buffer, offset, glyph.index);
        DOUBLE.write(buffer, offset + 8, glyph.x);
        DOUBLE.write(buffer, offset + 16, glyph.y);
        offset += GLYPH_SIZE;
    }

    return buffer;
};

const allocClusterBuffer = (clusters: CairoTextCluster[]): ExternalObject<Handle> => {
    const buffer = alloc(clusters.length * CLUSTER_SIZE);
    let offset = 0;

    for (const cluster of clusters) {
        INT.write(buffer, offset, cluster.numBytes);
        INT.write(buffer, offset + 4, cluster.numGlyphs);
        offset += CLUSTER_SIZE;
    }

    return buffer;
};

const allocTextExtents = (): ExternalObject<Handle> => alloc(TEXT_EXTENTS_SIZE);
const allocFontExtents = (): ExternalObject<Handle> => alloc(FONT_EXTENTS_SIZE);

const readTextExtents = (handle: ExternalObject<Handle>): TextExtents => ({
    xBearing: DOUBLE.read(handle, 0) as number,
    yBearing: DOUBLE.read(handle, 8) as number,
    width: DOUBLE.read(handle, 16) as number,
    height: DOUBLE.read(handle, 24) as number,
    xAdvance: DOUBLE.read(handle, 32) as number,
    yAdvance: DOUBLE.read(handle, 40) as number,
});

const readFontExtents = (handle: ExternalObject<Handle>): FontExtents => ({
    ascent: DOUBLE.read(handle, 0) as number,
    descent: DOUBLE.read(handle, 8) as number,
    height: DOUBLE.read(handle, 16) as number,
    maxXAdvance: DOUBLE.read(handle, 24) as number,
    maxYAdvance: DOUBLE.read(handle, 32) as number,
});

export { allocClusterBuffer, allocFontExtents, allocGlyphBuffer, allocTextExtents, readFontExtents, readTextExtents };
