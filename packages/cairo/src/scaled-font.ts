import {
    type ExternalObject,
    getHandle,
    type Handle,
    registerWrapperClass,
    setHandle,
    t,
    wrapHandle,
} from "@gtkx/runtime";
import type { FontType, Status, TextClusterFlags } from "./enums.js";
import type { CairoGlyph, CairoTextCluster, FontExtents, TextExtents } from "./types.js";
import { FontFace } from "./font-face.js";
import { FontOptions } from "./font-options.js";
import {
    bindCairo,
    type BoundFunction,
    cairoGType,
    FONT_EXTENTS_T,
    FONT_FACE_T,
    FONT_OPTIONS_T,
    GLYPH_RESOURCE,
    GLYPH_T,
    MATRIX_T,
    SCALED_FONT_FULL_T,
    SCALED_FONT_T,
    TEXT_CLUSTER_RESOURCE,
    TEXT_CLUSTER_T,
    TEXT_EXTENTS_T,
} from "./lib.js";
import { allocMatrix, Matrix } from "./matrix.js";
import { checkStatus } from "./status.js";
import { allocFontExtents, allocGlyphBuffer, allocTextExtents, readFontExtents, readTextExtents } from "./text.js";

const SCALED_FONT_TYPE = cairoGType("cairo_gobject_scaled_font_get_type");
const GLYPH_SIZE = 24;
const CLUSTER_SIZE = 8;
const DOUBLE = t.fieldAt(t.float64);
const UINT64 = t.fieldAt(t.uint64);
const INT = t.fieldAt(t.int32);
const cairoScaledFontStatus = bindCairo("cairo_scaled_font_status", [SCALED_FONT_T], t.int32);
const cairoScaledFontExtents = bindCairo("cairo_scaled_font_extents", [SCALED_FONT_T, FONT_EXTENTS_T], t.void);
const cairoScaledFontGetFontFace = bindCairo("cairo_scaled_font_get_font_face", [SCALED_FONT_T], FONT_FACE_T);
const cairoScaledFontGetFontMatrix = bindCairo("cairo_scaled_font_get_font_matrix", [SCALED_FONT_T, MATRIX_T], t.void);
const cairoScaledFontGetCtm = bindCairo("cairo_scaled_font_get_ctm", [SCALED_FONT_T, MATRIX_T], t.void);
const cairoScaledFontGetType = bindCairo("cairo_scaled_font_get_type", [SCALED_FONT_T], t.int32);
const cairoGlyphFree = bindCairo("cairo_glyph_free", [GLYPH_RESOURCE.end(GLYPH_T)], t.void);

const cairoTextClusterFree = bindCairo(
    "cairo_text_cluster_free",
    [TEXT_CLUSTER_RESOURCE.end(TEXT_CLUSTER_T)],
    t.void,
);

const cairoScaledFontCreate = bindCairo(
    "cairo_scaled_font_create",
    [FONT_FACE_T, MATRIX_T, MATRIX_T, FONT_OPTIONS_T],
    SCALED_FONT_FULL_T,
);

const cairoScaledFontTextExtents = bindCairo(
    "cairo_scaled_font_text_extents",
    [SCALED_FONT_T, t.string("full"), TEXT_EXTENTS_T],
    t.void,
);

const cairoScaledFontGlyphExtents = bindCairo(
    "cairo_scaled_font_glyph_extents",
    [SCALED_FONT_T, GLYPH_T, t.int32, TEXT_EXTENTS_T],
    t.void,
);

const cairoScaledFontGetFontOptions = bindCairo(
    "cairo_scaled_font_get_font_options",
    [SCALED_FONT_T, FONT_OPTIONS_T],
    t.void,
);

const cairoScaledFontGetScaleMatrix = bindCairo(
    "cairo_scaled_font_get_scale_matrix",
    [SCALED_FONT_T, MATRIX_T],
    t.void,
);

const cairoScaledFontGetReferenceCount = bindCairo(
    "cairo_scaled_font_get_reference_count",
    [SCALED_FONT_T],
    t.int32,
);

const cairoScaledFontTextToGlyphs = bindCairo(
    "cairo_scaled_font_text_to_glyphs",
    [
        SCALED_FONT_T,
        t.float64,
        t.float64,
        t.string("full"),
        t.int32,
        t.ref(GLYPH_RESOURCE.result(GLYPH_T)),
        t.ref(t.int32),
        t.ref(TEXT_CLUSTER_RESOURCE.result(TEXT_CLUSTER_T)),
        t.ref(t.int32),
        t.ref(t.int32),
    ],
    t.int32,
);

const readMatrixVia = (self: ScaledFont, boundFn: BoundFunction): Matrix => {
    const { handle, matrix } = allocMatrix();
    boundFn(getHandle(self), handle);

    return matrix;
};

const readGlyphs = (buffer: ExternalObject<Handle> | null, count: number): CairoGlyph[] => {
    if (buffer === null) {
        return [];
    }

    return Array.from({ length: count }, (_, index) => {
        const offset = index * GLYPH_SIZE;

        return {
            index: UINT64.read(buffer, offset) as number,
            x: DOUBLE.read(buffer, offset + 8) as number,
            y: DOUBLE.read(buffer, offset + 16) as number,
        };
    });
};

const readClusters = (buffer: ExternalObject<Handle> | null, count: number): CairoTextCluster[] => {
    if (buffer === null) {
        return [];
    }

    return Array.from({ length: count }, (_, index) => {
        const offset = index * CLUSTER_SIZE;

        return {
            numBytes: INT.read(buffer, offset) as number,
            numGlyphs: INT.read(buffer, offset + 4) as number,
        };
    });
};

const releaseShapingBuffers = (
    glyphs: ExternalObject<Handle> | null,
    clusters: ExternalObject<Handle> | null,
): void => {
    let releaseError: { value: unknown } | undefined;

    try {
        if (glyphs !== null) {
            cairoGlyphFree(glyphs);
        }
    } catch (error) {
        releaseError = { value: error };
    }

    try {
        if (clusters !== null) {
            cairoTextClusterFree(clusters);
        }
    } catch (error) {
        releaseError ??= { value: error };
    }

    if (releaseError !== undefined) {
        throw releaseError.value;
    }
};

const tryReleaseShapingBuffers = (
    glyphs: ExternalObject<Handle> | null,
    clusters: ExternalObject<Handle> | null,
): void => {
    try {
        releaseShapingBuffers(glyphs, clusters);
    } catch {
        return;
    }
};

/**
 * A cairo scaled font (`cairo_scaled_font_t`): a font face frozen at a given font matrix, transformation and
 * set of font options, ready to measure and shape text.
 */
class ScaledFont {
    static {
        registerWrapperClass(this, SCALED_FONT_TYPE);
    }

    /** Creates a scaled font, the same as `new ScaledFont(fontFace, fontMatrix, ctm, options)`. */
    static create(fontFace: FontFace, fontMatrix: Matrix, ctm: Matrix, options: FontOptions): ScaledFont {
        return new ScaledFont(fontFace, fontMatrix, ctm, options);
    }

    /** GType of `CairoScaledFont`, the boxed type this class is registered under. */
    declare __type__: bigint;

    /** Creates a scaled font from a font face, a font matrix, a user-to-device transformation and font options. */
    constructor(fontFace: FontFace, fontMatrix: Matrix, ctm: Matrix, options: FontOptions) {
        const handle = cairoScaledFontCreate(
            getHandle(fontFace),
            getHandle(fontMatrix),
            getHandle(ctm),
            getHandle(options),
        ) as ExternalObject<Handle>;

        setHandle(this, handle);
    }

    /** Returns the error status of the scaled font, `Status.SUCCESS` when it is usable. */
    status(): Status {
        return cairoScaledFontStatus(getHandle(this)) as Status;
    }

    /** Returns the metrics of the font. */
    extents(): FontExtents {
        const ext = allocFontExtents();
        cairoScaledFontExtents(getHandle(this), ext);

        return readFontExtents(ext);
    }

    /** Measures `text` with the font. */
    textExtents(text: string): TextExtents {
        const ext = allocTextExtents();
        cairoScaledFontTextExtents(getHandle(this), text, ext);

        return readTextExtents(ext);
    }

    /** Measures positioned glyphs with the font. */
    glyphExtents(glyphs: CairoGlyph[]): TextExtents {
        const buf = allocGlyphBuffer(glyphs);
        const ext = allocTextExtents();
        cairoScaledFontGlyphExtents(getHandle(this), buf, glyphs.length, ext);

        return readTextExtents(ext);
    }

    /** Returns the font face the scaled font was created from, wrapped as its concrete class. */
    getFontFace(): FontFace {
        return wrapHandle(cairoScaledFontGetFontFace(getHandle(this)) as ExternalObject<Handle>, FontFace);
    }

    /** Returns a copy of the font options the scaled font was created with. */
    getFontOptions(): FontOptions {
        const options = FontOptions.create();
        cairoScaledFontGetFontOptions(getHandle(this), getHandle(options));

        return options;
    }

    /** Returns the font matrix the scaled font was created with. */
    getFontMatrix(): Matrix {
        return readMatrixVia(this, cairoScaledFontGetFontMatrix);
    }

    /** Returns the user-to-device transformation the scaled font was created with. */
    getCtm(): Matrix {
        return readMatrixVia(this, cairoScaledFontGetCtm);
    }

    /** Returns the scale matrix: the font matrix multiplied by the transformation, without translation. */
    getScaleMatrix(): Matrix {
        return readMatrixVia(this, cairoScaledFontGetScaleMatrix);
    }

    /** Returns the backend the scaled font belongs to. */
    getType(): FontType {
        return cairoScaledFontGetType(getHandle(this)) as FontType;
    }

    /** Returns the reference count of the scaled font. */
    getReferenceCount(): number {
        return cairoScaledFontGetReferenceCount(getHandle(this)) as number;
    }

    /** Shapes `text` starting at `(x, y)` into glyphs, clusters and their ordering flags, or throws on failure. */
    textToGlyphs(x: number, y: number, text: string): [CairoGlyph[], CairoTextCluster[], TextClusterFlags] {
        const glyphsRef: { value: ExternalObject<Handle> | null } = { value: null };
        const numGlyphsRef = { value: 0 };
        const clustersRef: { value: ExternalObject<Handle> | null } = { value: null };
        const numClustersRef = { value: 0 };
        const clusterFlagsRef = { value: 0 };
        let result: [CairoGlyph[], CairoTextCluster[], TextClusterFlags];

        try {
            const status = cairoScaledFontTextToGlyphs(
                getHandle(this),
                x,
                y,
                text,
                -1,
                glyphsRef,
                numGlyphsRef,
                clustersRef,
                numClustersRef,
                clusterFlagsRef,
            ) as Status;

            checkStatus(status, "scaled font");
            const glyphs = readGlyphs(glyphsRef.value, numGlyphsRef.value);
            const clusters = readClusters(clustersRef.value, numClustersRef.value);
            result = [glyphs, clusters, clusterFlagsRef.value as TextClusterFlags];
        } catch (error) {
            tryReleaseShapingBuffers(glyphsRef.value, clustersRef.value);
            throw error;
        }

        releaseShapingBuffers(glyphsRef.value, clustersRef.value);

        return result;
    }
}

export { ScaledFont };
