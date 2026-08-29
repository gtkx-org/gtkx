import * as cairo from "@gtkx/cairo";
import { describe, expect, it } from "vitest";

type ValueExport = keyof typeof cairo;
type AnyClass = abstract new (...args: never[]) => unknown;

const GET_FONT_OPTIONS = "getFontOptions";
const GET_REFERENCE_COUNT = "getReferenceCount";

const EXPECTED_VALUE_EXPORTS: ValueExport[] = [
    "Antialias",
    "Content",
    "Context",
    "Device",
    "DeviceType",
    "Extend",
    "FillRule",
    "Filter",
    "FontFace",
    "FontOptions",
    "FontSlant",
    "FontType",
    "FontWeight",
    "Format",
    "FtFontFace",
    "FtSynthesize",
    "Glyph",
    "HintMetrics",
    "HintStyle",
    "ImageSurface",
    "LineCap",
    "LineJoin",
    "LinearPattern",
    "Matrix",
    "MeshPattern",
    "Operator",
    "Path",
    "PathDataType",
    "Pattern",
    "PatternType",
    "RadialPattern",
    "RecordingSurface",
    "Rectangle",
    "RectangleInt",
    "Region",
    "RegionOverlap",
    "ScaledFont",
    "Status",
    "SubpixelOrder",
    "Surface",
    "SurfaceType",
    "TextCluster",
    "TextClusterFlags",
    "ToyFontFace",
    "statusToString",
    "version",
    "versionString",
];

const EXPECTED_STATICS: readonly [AnyClass, string[]][] = [
    [cairo.Context, ["create"]],
    [cairo.Surface, ["createSimilar", "createSimilarImage", "createForRectangle"]],
    [cairo.ImageSurface, ["create", "createFromPng"]],
    [cairo.RecordingSurface, ["create"]],
    [cairo.Pattern, ["createRgb", "createRgba", "createLinear", "createRadial", "createMesh", "createForSurface"]],
    [cairo.Region, ["empty", "copy", "forRectangle", "createRectangles"]],
    [cairo.FontOptions, ["create"]],
    [cairo.FontFace, ["create"]],
    [cairo.ScaledFont, ["create"]],
    [cairo.Matrix, ["initIdentity", "initTranslate", "initScale", "initRotate", "multiply"]],
];

const CONTEXT_METHODS = [
    "moveTo",
    "lineTo",
    "relMoveTo",
    "relLineTo",
    "relCurveTo",
    "curveTo",
    "arc",
    "arcNegative",
    "rectangle",
    "closePath",
    "newPath",
    "newSubPath",
    "stroke",
    "strokePreserve",
    "fill",
    "fillPreserve",
    "paint",
    "paintWithAlpha",
    "clip",
    "clipPreserve",
    "resetClip",
    "setSourceRgb",
    "setSourceRgba",
    "setSource",
    "setLineWidth",
    "getLineWidth",
    "setLineCap",
    "getLineCap",
    "setLineJoin",
    "getLineJoin",
    "setDash",
    "getDashCount",
    "getDash",
    "setMiterLimit",
    "getMiterLimit",
    "setTolerance",
    "getTolerance",
    "setFillRule",
    "getFillRule",
    "save",
    "restore",
    "translate",
    "scale",
    "rotate",
    "setOperator",
    "getOperator",
    "selectFontFace",
    "setFontSize",
    "showText",
    "textPath",
    "textExtents",
    "fontExtents",
    "setFontOptions",
    GET_FONT_OPTIONS,
    "setAntialias",
    "getAntialias",
    "showPage",
    "copyPage",
    "getTarget",
    "setSourceSurface",
    "hasCurrentPoint",
    "getCurrentPoint",
    "getSource",
    "strokeExtents",
    "fillExtents",
    "clipExtents",
    "pathExtents",
    "inStroke",
    "inFill",
    "inClip",
    "copyClipRectangleList",
    "mask",
    "maskSurface",
    "setMatrix",
    "getMatrix",
    "transform",
    "identityMatrix",
    "userToDevice",
    "userToDeviceDistance",
    "deviceToUser",
    "deviceToUserDistance",
    "status",
    GET_REFERENCE_COUNT,
    "pushGroup",
    "pushGroupWithContent",
    "popGroup",
    "popGroupToSource",
    "getGroupTarget",
    "setFontFace",
    "getFontFace",
    "setFontMatrix",
    "getFontMatrix",
    "setScaledFont",
    "getScaledFont",
    "showGlyphs",
    "glyphPath",
    "glyphExtents",
    "copyPath",
    "copyPathFlat",
    "appendPath",
    "tagBegin",
    "tagEnd",
    "showTextGlyphs",
];

const SURFACE_METHODS = [
    "writeToPng",
    "status",
    "finish",
    "flush",
    "getDevice",
    GET_FONT_OPTIONS,
    "getContent",
    "markDirty",
    "markDirtyRectangle",
    "setDeviceOffset",
    "getDeviceOffset",
    "getDeviceScale",
    "setDeviceScale",
    "setFallbackResolution",
    "getFallbackResolution",
    "getType",
    GET_REFERENCE_COUNT,
    "copyPage",
    "showPage",
    "hasShowTextGlyphs",
    "supportsMimeType",
];

const REGION_METHODS = [
    "copy",
    "status",
    "getExtents",
    "numRectangles",
    "getRectangle",
    "isEmpty",
    "containsPoint",
    "containsRectangle",
    "equal",
    "translate",
    "intersect",
    "intersectRectangle",
    "subtract",
    "subtractRectangle",
    "union",
    "unionRectangle",
    "xor",
    "xorRectangle",
];

const MESH_PATTERN_METHODS = [
    "beginPatch",
    "endPatch",
    "moveTo",
    "lineTo",
    "curveTo",
    "setControlPoint",
    "setCornerColorRgb",
    "setCornerColorRgba",
    "getPatchCount",
    "getPath",
    "getControlPoint",
    "getCornerColorRgba",
];

const FONT_OPTIONS_METHODS = [
    "setHintStyle",
    "getHintStyle",
    "setAntialias",
    "getAntialias",
    "setHintMetrics",
    "getHintMetrics",
    "setSubpixelOrder",
    "getSubpixelOrder",
    "equal",
    "merge",
    "status",
    "hash",
    "setVariations",
    "getVariations",
];

const SCALED_FONT_METHODS = [
    "status",
    "extents",
    "textExtents",
    "glyphExtents",
    "getFontFace",
    GET_FONT_OPTIONS,
    "getFontMatrix",
    "getCtm",
    "getScaleMatrix",
    "getType",
    GET_REFERENCE_COUNT,
];

const OMITTED_STATICS: readonly [AnyClass, string[]][] = [
    [cairo.FontFace, ["createForFtFace", "createForPattern"]],
];

const OMITTED_METHODS: readonly [AnyClass, string[]][] = [
    [cairo.Surface, ["mapToImage", "unmapImage"]],
    [cairo.ScaledFont, ["textToGlyphs"]],
];

const EXPECTED_METHODS: readonly [AnyClass, string[]][] = [
    [cairo.Context, CONTEXT_METHODS],
    [cairo.Surface, SURFACE_METHODS],
    [cairo.ImageSurface, ["getWidth", "getHeight", "getFormat", "getStride", "getData"]],
    [cairo.RecordingSurface, ["inkExtents", "getExtents"]],
    [
        cairo.Pattern,
        [
            "addColorStopRgb",
            "addColorStopRgba",
            "getColorStopCount",
            "getColorStopRgba",
            "getRgba",
            "status",
            "setExtend",
            "getExtend",
            "setFilter",
            "getFilter",
            "setMatrix",
            "getMatrix",
            "getType",
            GET_REFERENCE_COUNT,
        ],
    ],
    [cairo.LinearPattern, ["getLinearPoints"]],
    [cairo.RadialPattern, ["getRadialCircles"]],
    [cairo.MeshPattern, MESH_PATTERN_METHODS],
    [cairo.Region, REGION_METHODS],
    [cairo.FontOptions, FONT_OPTIONS_METHODS],
    [cairo.FontFace, ["status", "getType", GET_REFERENCE_COUNT]],
    [cairo.ToyFontFace, ["getFamily", "getSlant", "getWeight"]],
    [cairo.FtFontFace, ["getSynthesize", "setSynthesize", "unsetSynthesize"]],
    [cairo.ScaledFont, SCALED_FONT_METHODS],
    [cairo.Matrix, ["translate", "scale", "rotate", "invert", "transformPoint", "transformDistance"]],
    [cairo.Path, ["toData"]],
    [cairo.Device, ["status", "getType", "finish", "flush", GET_REFERENCE_COUNT]],
];

const ENUM_SAMPLES: [
    cairo.Antialias,
    cairo.Content,
    cairo.DeviceType,
    cairo.Extend,
    cairo.FillRule,
    cairo.Filter,
    cairo.FontSlant,
    cairo.FontType,
    cairo.FontWeight,
    cairo.Format,
    cairo.FtSynthesize,
    cairo.HintMetrics,
    cairo.HintStyle,
    cairo.LineCap,
    cairo.LineJoin,
    cairo.Operator,
    cairo.PathDataType,
    cairo.PatternType,
    cairo.RegionOverlap,
    cairo.Status,
    cairo.SubpixelOrder,
    cairo.SurfaceType,
    cairo.TextClusterFlags,
] = [
    cairo.Antialias.DEFAULT,
    cairo.Content.COLOR,
    cairo.DeviceType.DRM,
    cairo.Extend.NONE,
    cairo.FillRule.WINDING,
    cairo.Filter.FAST,
    cairo.FontSlant.NORMAL,
    cairo.FontType.TOY,
    cairo.FontWeight.NORMAL,
    cairo.Format.INVALID,
    cairo.FtSynthesize.BOLD,
    cairo.HintMetrics.DEFAULT,
    cairo.HintStyle.DEFAULT,
    cairo.LineCap.BUTT,
    cairo.LineJoin.MITER,
    cairo.Operator.CLEAR,
    cairo.PathDataType.MOVE_TO,
    cairo.PatternType.SOLID,
    cairo.RegionOverlap.IN,
    cairo.Status.SUCCESS,
    cairo.SubpixelOrder.DEFAULT,
    cairo.SurfaceType.IMAGE,
    cairo.TextClusterFlags.BACKWARD,
];

const SEGMENT_SAMPLES: [
    cairo.MoveToSegment,
    cairo.LineToSegment,
    cairo.CurveToSegment,
    cairo.ClosePathSegment,
    cairo.PathData,
] = [
    { type: "moveTo", x: 0, y: 0 },
    { type: "lineTo", x: 0, y: 0 },
    { type: "curveTo", x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0 },
    { type: "closePath" },
    { type: "closePath" },
];

const GEOMETRY_SAMPLES: [cairo.Point, cairo.Distance, cairo.Extents, cairo.RectangleData, cairo.DashPattern] = [
    { x: 0, y: 0 },
    { dx: 0, dy: 0 },
    { x1: 0, y1: 0, x2: 0, y2: 0 },
    { x: 0, y: 0, width: 0, height: 0 },
    { dashes: [], offset: 0 },
];

const FONT_SAMPLES: [cairo.CairoGlyph, cairo.CairoTextCluster, cairo.TextExtents, cairo.FontExtents] = [
    { index: 0, x: 0, y: 0 },
    { numBytes: 0, numGlyphs: 0 },
    { xBearing: 0, yBearing: 0, width: 0, height: 0, xAdvance: 0, yAdvance: 0 },
    { ascent: 0, descent: 0, height: 0, maxXAdvance: 0, maxYAdvance: 0 },
];

const PATTERN_SAMPLES: [cairo.RgbaColor, cairo.ColorStop, cairo.LinearPoints, cairo.RadialCircles] = [
    { red: 0, green: 0, blue: 0, alpha: 0 },
    { offset: 0, red: 0, green: 0, blue: 0, alpha: 0 },
    { x0: 0, y0: 0, x1: 0, y1: 0 },
    { x0: 0, y0: 0, r0: 0, x1: 0, y1: 0, r1: 0 },
];

const SURFACE_SAMPLES: [cairo.DeviceOffset, cairo.DeviceScale, cairo.FallbackResolution, cairo.InkExtents] = [
    { xOffset: 0, yOffset: 0 },
    { xScale: 0, yScale: 0 },
    { xPixelsPerInch: 0, yPixelsPerInch: 0 },
    { x0: 0, y0: 0, width: 0, height: 0 },
];

const STRUCT_PROPS_SAMPLES: [
    cairo.RectangleConstructorProps,
    cairo.RectangleIntConstructorProps,
    cairo.GlyphConstructorProps,
    cairo.TextClusterConstructorProps,
] = [{}, {}, {}, {}];

const byName = (a: string, b: string): number => a.localeCompare(b);

const missingMembers = (expected: readonly [AnyClass, string[]][], namesOf: (cls: AnyClass) => string[]): string[] =>
    expected.flatMap(([cls, members]) => {
        const names = new Set(namesOf(cls));

        return members.filter((member) => !names.has(member)).map((member) => `${cls.name}.${member}`);
    });

const presentMembers = (omitted: readonly [AnyClass, string[]][], namesOf: (cls: AnyClass) => string[]): string[] =>
    omitted.flatMap(([cls, members]) => {
        const names = new Set(namesOf(cls));

        return members.filter((member) => names.has(member)).map((member) => `${cls.name}.${member}`);
    });

describe("@gtkx/cairo exports", () => {
    it("exports exactly the expected value names", () => {
        expect(Object.keys(cairo).toSorted(byName)).toEqual(EXPECTED_VALUE_EXPORTS.toSorted(byName));
    });

    it("exports every supported static", () => {
        expect(missingMembers(EXPECTED_STATICS, (cls) => Object.getOwnPropertyNames(cls))).toEqual([]);
    });

    it("exports every supported instance method", () => {
        expect(missingMembers(EXPECTED_METHODS, (cls) => Object.getOwnPropertyNames(cls.prototype))).toEqual([]);
    });

    it("omits native APIs that do not fit ordinary wrapper ownership", () => {
        expect([
            ...presentMembers(OMITTED_STATICS, (cls) => Object.getOwnPropertyNames(cls)),
            ...presentMembers(OMITTED_METHODS, (cls) => Object.getOwnPropertyNames(cls.prototype)),
        ]).toEqual([]);
    });

    it("exports every enum both as a value and as a type", () => {
        expect(ENUM_SAMPLES).toHaveLength(23);
    });

    it("exports the path segment types", () => {
        expect(SEGMENT_SAMPLES).toHaveLength(5);
    });

    it("exports the geometry, font, pattern and surface data types", () => {
        expect([...GEOMETRY_SAMPLES, ...FONT_SAMPLES, ...PATTERN_SAMPLES, ...SURFACE_SAMPLES]).toHaveLength(17);
    });

    it("exports the struct constructor props types", () => {
        expect(STRUCT_PROPS_SAMPLES).toHaveLength(4);
    });
});
