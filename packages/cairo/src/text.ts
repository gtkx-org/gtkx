import { alloc, type ExternalObject, type Handle, read, t, write } from "@gtkx/runtime";
import type { CairoGlyph, CairoTextCluster, FontExtents, TextExtents } from "./types.js";

const GLYPH_SIZE = 24;
const CLUSTER_SIZE = 8;
const TEXT_EXTENTS_SIZE = 48;
const FONT_EXTENTS_SIZE = 40;

const allocGlyphBuffer = (glyphs: CairoGlyph[]): ExternalObject<Handle> => {
    const buffer = alloc(glyphs.length * GLYPH_SIZE);
    let offset = 0;

    for (const glyph of glyphs) {
        write(buffer, t.uint64, offset, glyph.index);
        write(buffer, t.float64, offset + 8, glyph.x);
        write(buffer, t.float64, offset + 16, glyph.y);
        offset += GLYPH_SIZE;
    }

    return buffer;
};

const allocClusterBuffer = (clusters: CairoTextCluster[]): ExternalObject<Handle> => {
    const buffer = alloc(clusters.length * CLUSTER_SIZE);
    let offset = 0;

    for (const cluster of clusters) {
        write(buffer, t.int32, offset, cluster.numBytes);
        write(buffer, t.int32, offset + 4, cluster.numGlyphs);
        offset += CLUSTER_SIZE;
    }

    return buffer;
};

const allocTextExtents = (): ExternalObject<Handle> => alloc(TEXT_EXTENTS_SIZE);
const allocFontExtents = (): ExternalObject<Handle> => alloc(FONT_EXTENTS_SIZE);

const readTextExtents = (handle: ExternalObject<Handle>): TextExtents => ({
    xBearing: read(handle, t.float64, 0) as number,
    yBearing: read(handle, t.float64, 8) as number,
    width: read(handle, t.float64, 16) as number,
    height: read(handle, t.float64, 24) as number,
    xAdvance: read(handle, t.float64, 32) as number,
    yAdvance: read(handle, t.float64, 40) as number,
});

const readFontExtents = (handle: ExternalObject<Handle>): FontExtents => ({
    ascent: read(handle, t.float64, 0) as number,
    descent: read(handle, t.float64, 8) as number,
    height: read(handle, t.float64, 16) as number,
    maxXAdvance: read(handle, t.float64, 24) as number,
    maxYAdvance: read(handle, t.float64, 32) as number,
});

export { allocClusterBuffer, allocFontExtents, allocGlyphBuffer, allocTextExtents, readFontExtents, readTextExtents };
