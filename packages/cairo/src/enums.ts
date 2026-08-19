/** One of the `Status` codes a cairo object or operation reports. */
type Status = (typeof Status)[keyof typeof Status];
/** One of the `Content` kinds a surface holds. */
type Content = (typeof Content)[keyof typeof Content];
/** One of the `Operator` compositing modes. */
type Operator = (typeof Operator)[keyof typeof Operator];
/** One of the `Antialias` modes for rendering shapes and text. */
type Antialias = (typeof Antialias)[keyof typeof Antialias];
/** One of the `FillRule` modes deciding which areas a path fills. */
type FillRule = (typeof FillRule)[keyof typeof FillRule];
/** One of the `LineCap` styles for the ends of a stroked line. */
type LineCap = (typeof LineCap)[keyof typeof LineCap];
/** One of the `LineJoin` styles for the corners of a stroked path. */
type LineJoin = (typeof LineJoin)[keyof typeof LineJoin];
/** One of the `TextClusterFlags` values describing a cluster mapping. */
type TextClusterFlags = (typeof TextClusterFlags)[keyof typeof TextClusterFlags];
/** One of the `FontSlant` values for a toy font face. */
type FontSlant = (typeof FontSlant)[keyof typeof FontSlant];
/** One of the `FontWeight` values for a toy font face. */
type FontWeight = (typeof FontWeight)[keyof typeof FontWeight];
/** One of the `SubpixelOrder` values for subpixel antialiasing. */
type SubpixelOrder = (typeof SubpixelOrder)[keyof typeof SubpixelOrder];
/** One of the `HintStyle` values for font outline hinting. */
type HintStyle = (typeof HintStyle)[keyof typeof HintStyle];
/** One of the `HintMetrics` values for font metric quantization. */
type HintMetrics = (typeof HintMetrics)[keyof typeof HintMetrics];
/** One of the `FontType` backends a font face or scaled font uses. */
type FontType = (typeof FontType)[keyof typeof FontType];
/** One of the `PathDataType` segment kinds in a copied path. */
type PathDataType = (typeof PathDataType)[keyof typeof PathDataType];
/** One of the `DeviceType` backends a device belongs to. */
type DeviceType = (typeof DeviceType)[keyof typeof DeviceType];
/** One of the `SurfaceType` backends a surface belongs to. */
type SurfaceType = (typeof SurfaceType)[keyof typeof SurfaceType];
/** One of the `Format` pixel layouts of an image surface. */
type Format = (typeof Format)[keyof typeof Format];
/** One of the `PatternType` kinds a pattern can be. */
type PatternType = (typeof PatternType)[keyof typeof PatternType];
/** One of the `Extend` modes for drawing outside a pattern's natural area. */
type Extend = (typeof Extend)[keyof typeof Extend];
/** One of the `Filter` modes for resizing a pattern. */
type Filter = (typeof Filter)[keyof typeof Filter];
/** One of the `RegionOverlap` results of a region containment test. */
type RegionOverlap = (typeof RegionOverlap)[keyof typeof RegionOverlap];

/**
 * The result a cairo object or operation reports; anything but `SUCCESS` marks the object as errored.
 * @enum
 */
const Status = {
    /** No error has occurred. */
    SUCCESS: 0,
    /** Out of memory. */
    NO_MEMORY: 1,
    /** `restore` was called without a matching `save`. */
    INVALID_RESTORE: 2,
    /** `popGroup` was called without a matching `pushGroup`. */
    INVALID_POP_GROUP: 3,
    /** No current point is defined. */
    NO_CURRENT_POINT: 4,
    /** The matrix is invalid, such as one that is not invertible. */
    INVALID_MATRIX: 5,
    /** The status value is invalid. */
    INVALID_STATUS: 6,
    /** A null pointer was passed. */
    NULL_POINTER: 7,
    /** The string is invalid, such as malformed UTF-8. */
    INVALID_STRING: 8,
    /** The path data is not valid. */
    INVALID_PATH_DATA: 9,
    /** An error occurred while reading from an input stream. */
    READ_ERROR: 10,
    /** An error occurred while writing to an output stream. */
    WRITE_ERROR: 11,
    /** The target surface has been finished. */
    SURFACE_FINISHED: 12,
    /** The surface type is not appropriate for the operation. */
    SURFACE_TYPE_MISMATCH: 13,
    /** The pattern type is not appropriate for the operation. */
    PATTERN_TYPE_MISMATCH: 14,
    /** The content value is invalid. */
    INVALID_CONTENT: 15,
    /** The format value is invalid. */
    INVALID_FORMAT: 16,
    /** The visual value is invalid. */
    INVALID_VISUAL: 17,
    /** The file was not found. */
    FILE_NOT_FOUND: 18,
    /** The dash setting is invalid. */
    INVALID_DASH: 19,
    /** The DSC comment is invalid. */
    INVALID_DSC_COMMENT: 20,
    /** The index passed to a getter is out of range. */
    INVALID_INDEX: 21,
    /** The clip region is not representable in the desired format. */
    CLIP_NOT_REPRESENTABLE: 22,
    /** An error occurred while creating a temporary file. */
    TEMP_FILE_ERROR: 23,
    /** The stride value is invalid. */
    INVALID_STRIDE: 24,
    /** The font type is not appropriate for the operation. */
    FONT_TYPE_MISMATCH: 25,
    /** The user font is immutable. */
    USER_FONT_IMMUTABLE: 26,
    /** An error occurred in a user font callback. */
    USER_FONT_ERROR: 27,
    /** A negative number was used where it is not allowed. */
    NEGATIVE_COUNT: 28,
    /** The input clusters do not represent the accompanying text and glyph arrays. */
    INVALID_CLUSTERS: 29,
    /** The font slant value is invalid. */
    INVALID_SLANT: 30,
    /** The font weight value is invalid. */
    INVALID_WEIGHT: 31,
    /** The size value, such as a negative width, is invalid. */
    INVALID_SIZE: 32,
    /** The user font method is not implemented. */
    USER_FONT_NOT_IMPLEMENTED: 33,
    /** The device type is not appropriate for the operation. */
    DEVICE_TYPE_MISMATCH: 34,
    /** An operation on the device caused an unspecified error. */
    DEVICE_ERROR: 35,
    /** A mesh pattern construction operation was used outside a `beginPatch`/`endPatch` pair. */
    INVALID_MESH_CONSTRUCTION: 36,
    /** The target device has been finished. */
    DEVICE_FINISHED: 37,
    /** A JBIG2 global data stream was attached without its global identifier. */
    JBIG2_GLOBAL_MISSING: 38,
} as const;

/**
 * What a surface holds: color, alpha coverage, or both.
 * @enum
 */
const Content = {
    /** The surface holds color content only. */
    COLOR: 4096,
    /** The surface holds alpha content only. */
    ALPHA: 8192,
    /** The surface holds color and alpha content. */
    COLOR_ALPHA: 12_288,
} as const;

/**
 * How a drawing operation composites its source onto the destination.
 * @enum
 */
const Operator = {
    /** Clears the destination where the source is drawn. */
    CLEAR: 0,
    /** Replaces the destination with the source. */
    SOURCE: 1,
    /** Draws the source over the destination. */
    OVER: 2,
    /** Draws the source where there was destination content. */
    IN: 3,
    /** Draws the source where there was no destination content. */
    OUT: 4,
    /** Draws the source on top of the destination, limited to the destination's extents. */
    ATOP: 5,
    /** Ignores the source. */
    DEST: 6,
    /** Draws the destination on top of the source. */
    DEST_OVER: 7,
    /** Leaves the destination only where there was source content. */
    DEST_IN: 8,
    /** Leaves the destination only where there was no source content. */
    DEST_OUT: 9,
    /** Leaves the destination on top of the source, limited to the source's extents. */
    DEST_ATOP: 10,
    /** Shows the source and destination where there is only one of them. */
    XOR: 11,
    /** Accumulates the source and destination layers. */
    ADD: 12,
    /** Like `OVER`, but assumes the source and destination are disjoint geometries. */
    SATURATE: 13,
    /** Multiplies the source and destination colors, always darkening. */
    MULTIPLY: 14,
    /** Complements and multiplies the source and destination, always lightening. */
    SCREEN: 15,
    /** Multiplies or screens depending on the destination lightness. */
    OVERLAY: 16,
    /** Keeps the darker of the source and destination. */
    DARKEN: 17,
    /** Keeps the lighter of the source and destination. */
    LIGHTEN: 18,
    /** Brightens the destination to reflect the source. */
    COLOR_DODGE: 19,
    /** Darkens the destination to reflect the source. */
    COLOR_BURN: 20,
    /** Multiplies or screens depending on the source lightness. */
    HARD_LIGHT: 21,
    /** Darkens or lightens depending on the source lightness. */
    SOFT_LIGHT: 22,
    /** Takes the difference of the source and destination. */
    DIFFERENCE: 23,
    /** Like `DIFFERENCE` but with lower contrast. */
    EXCLUSION: 24,
    /** Takes the hue of the source and the saturation and luminosity of the destination. */
    HSL_HUE: 25,
    /** Takes the saturation of the source and the hue and luminosity of the destination. */
    HSL_SATURATION: 26,
    /** Takes the hue and saturation of the source and the luminosity of the destination. */
    HSL_COLOR: 27,
    /** Takes the luminosity of the source and the hue and saturation of the destination. */
    HSL_LUMINOSITY: 28,
} as const;

/**
 * How shapes and text are antialiased.
 * @enum
 */
const Antialias = {
    /** Uses the default antialiasing of the subsystem and target device. */
    DEFAULT: 0,
    /** Uses a bilevel alpha mask. */
    NONE: 1,
    /** Uses a single color for antialiasing. */
    GRAY: 2,
    /** Uses the subpixels of an LCD panel. */
    SUBPIXEL: 3,
    /** Prefers speed over quality. */
    FAST: 4,
    /** Balances quality against performance. */
    GOOD: 5,
    /** Renders at the highest quality, sacrificing speed. */
    BEST: 6,
} as const;

/**
 * Which areas inside a path a fill covers.
 * @enum
 */
const FillRule = {
    /** Fills where the winding number is non-zero. */
    WINDING: 0,
    /** Fills where a ray crosses the path an odd number of times. */
    EVEN_ODD: 1,
} as const;

/**
 * How the ends of a stroked line are rendered.
 * @enum
 */
const LineCap = {
    /** Starts and stops the line exactly at the start and end points. */
    BUTT: 0,
    /** Uses a round ending centered on the end point. */
    ROUND: 1,
    /** Uses a squared ending extending past the end point. */
    SQUARE: 2,
} as const;

/**
 * How the corners of a stroked path are rendered.
 * @enum
 */
const LineJoin = {
    /** Uses a sharp corner cut off at the miter limit. */
    MITER: 0,
    /** Uses a rounded join centered on the joint point. */
    ROUND: 1,
    /** Uses a cut-off join at half the line width from the joint point. */
    BEVEL: 2,
} as const;

/**
 * Properties of a text cluster mapping.
 * @enum
 */
const TextClusterFlags = {
    /** The clusters map to glyphs from the end of the glyph array backwards. */
    BACKWARD: 1,
} as const;

/**
 * The slant of a toy font face.
 * @enum
 */
const FontSlant = {
    /** Upright font style. */
    NORMAL: 0,
    /** Italic font style. */
    ITALIC: 1,
    /** Oblique font style. */
    OBLIQUE: 2,
} as const;

/**
 * The weight of a toy font face.
 * @enum
 */
const FontWeight = {
    /** Normal font weight. */
    NORMAL: 0,
    /** Bold font weight. */
    BOLD: 1,
} as const;

/**
 * The order of color elements within each pixel on a display, for subpixel antialiasing.
 * @enum
 */
const SubpixelOrder = {
    /** Uses the default subpixel order for the target device. */
    DEFAULT: 0,
    /** Subpixels are ordered red, green, blue horizontally. */
    RGB: 1,
    /** Subpixels are ordered blue, green, red horizontally. */
    BGR: 2,
    /** Subpixels are ordered red, green, blue vertically. */
    VRGB: 3,
    /** Subpixels are ordered blue, green, red vertically. */
    VBGR: 4,
} as const;

/**
 * How much font outlines are fitted to the pixel grid.
 * @enum
 */
const HintStyle = {
    /** Uses the default hint style of the font backend and target device. */
    DEFAULT: 0,
    /** Does not hint outlines. */
    NONE: 1,
    /** Hints outlines slightly, keeping contrast while preserving shape. */
    SLIGHT: 2,
    /** Hints outlines with medium strength. */
    MEDIUM: 3,
    /** Hints outlines to maximize contrast. */
    FULL: 4,
} as const;

/**
 * Whether font metrics are quantized to integer device units.
 * @enum
 */
const HintMetrics = {
    /** Uses the default metric hinting of the font backend and target device. */
    DEFAULT: 0,
    /** Does not hint metrics. */
    OFF: 1,
    /** Hints metrics to integer device units. */
    ON: 2,
} as const;

/**
 * The backend behind a font face or scaled font.
 * @enum
 */
const FontType = {
    /** A font created with the toy font API (`selectFontFace`). */
    TOY: 0,
    /** A font of type FreeType. */
    FT: 1,
    /** A font of type Win32. */
    WIN32: 2,
    /** A font of type Quartz. */
    QUARTZ: 3,
    /** A font created with the user font API. */
    USER: 4,
} as const;

/**
 * The kind of a segment in a copied path.
 * @enum
 */
const PathDataType = {
    /** Starts a new sub-path. */
    MOVE_TO: 0,
    /** Adds a straight line. */
    LINE_TO: 1,
    /** Adds a cubic Bézier curve. */
    CURVE_TO: 2,
    /** Closes the current sub-path. */
    CLOSE_PATH: 3,
} as const;

/**
 * The backend behind a device.
 * @enum
 */
const DeviceType = {
    /** A Direct Render Manager device. */
    DRM: 0,
    /** An OpenGL device. */
    GL: 1,
    /** A script recording device. */
    SCRIPT: 2,
    /** An XCB device. */
    XCB: 3,
    /** An Xlib device. */
    XLIB: 4,
    /** An XML recording device. */
    XML: 5,
    /** A Cogl device. */
    COGL: 6,
    /** A Win32 device. */
    WIN32: 7,
    /** An invalid device. */
    INVALID: -1,
} as const;

/**
 * The backend behind a surface.
 * @enum
 */
const SurfaceType = {
    /** An image surface backed by memory. */
    IMAGE: 0,
    /** A PDF surface. */
    PDF: 1,
    /** A PostScript surface. */
    PS: 2,
    /** An Xlib surface. */
    XLIB: 3,
    /** An XCB surface. */
    XCB: 4,
    /** A Glitz surface. */
    GLITZ: 5,
    /** A Quartz surface. */
    QUARTZ: 6,
    /** A Win32 surface. */
    WIN32: 7,
    /** A BeOS surface. */
    BEOS: 8,
    /** A DirectFB surface. */
    DIRECTFB: 9,
    /** An SVG surface. */
    SVG: 10,
    /** An OS/2 surface. */
    OS2: 11,
    /** A Win32 printing surface. */
    WIN32_PRINTING: 12,
    /** A Quartz image surface. */
    QUARTZ_IMAGE: 13,
    /** A script recording surface. */
    SCRIPT: 14,
    /** A Qt surface. */
    QT: 15,
    /** A recording surface that replays its drawing. */
    RECORDING: 16,
    /** An OpenVG surface. */
    VG: 17,
    /** An OpenGL surface. */
    GL: 18,
    /** A Direct Render Manager surface. */
    DRM: 19,
    /** A tee surface that forwards to several others. */
    TEE: 20,
    /** An XML recording surface. */
    XML: 21,
    /** A Skia surface. */
    SKIA: 22,
    /** A subsurface created with `Surface.createForRectangle`. */
    SUBSURFACE: 23,
    /** A Cogl surface. */
    COGL: 24,
} as const;

/**
 * The memory layout of the pixels of an image surface.
 * @enum
 */
const Format = {
    /** No such format exists or is supported. */
    INVALID: -1,
    /** 32 bits per pixel with premultiplied alpha in the upper 8 bits, then red, green, blue. */
    ARGB32: 0,
    /** 32 bits per pixel with the upper 8 bits unused, then red, green, blue. */
    RGB24: 1,
    /** 8 bits per pixel holding an alpha value. */
    A8: 2,
    /** 1 bit per pixel holding an alpha value. */
    A1: 3,
    /** 16 bits per pixel with 5 bits red, 6 bits green and 5 bits blue. */
    RGB16_565: 4,
    /** 30 bits per pixel with 10 bits per color channel. */
    RGB30: 5,
} as const;

/**
 * The kind of a pattern.
 * @enum
 */
const PatternType = {
    /** A single color. */
    SOLID: 0,
    /** A surface used as a source. */
    SURFACE: 1,
    /** A linear gradient. */
    LINEAR: 2,
    /** A radial gradient. */
    RADIAL: 3,
    /** A mesh gradient. */
    MESH: 4,
    /** A raster source pattern driven by callbacks. */
    RASTER_SOURCE: 5,
} as const;

/**
 * What a pattern draws outside its natural area.
 * @enum
 */
const Extend = {
    /** Draws transparent outside the pattern. */
    NONE: 0,
    /** Tiles the pattern by repeating it. */
    REPEAT: 1,
    /** Tiles the pattern by reflecting it at its edges. */
    REFLECT: 2,
    /** Extends the pattern's closest edge color outward. */
    PAD: 3,
} as const;

/**
 * How a pattern is sampled when it is scaled.
 * @enum
 */
const Filter = {
    /** A high-performance filter with a quality similar to `NEAREST`. */
    FAST: 0,
    /** A reasonable-performance filter with a quality similar to `BILINEAR`. */
    GOOD: 1,
    /** The highest-quality filter available. */
    BEST: 2,
    /** Nearest-neighbor filtering. */
    NEAREST: 3,
    /** Linear interpolation in two dimensions. */
    BILINEAR: 4,
    /** Gaussian interpolation in two dimensions. */
    GAUSSIAN: 5,
} as const;

/**
 * How a rectangle relates to a region.
 * @enum
 */
const RegionOverlap = {
    /** The rectangle is entirely inside the region. */
    IN: 0,
    /** The rectangle is entirely outside the region. */
    OUT: 1,
    /** The rectangle is partially inside and partially outside the region. */
    PART: 2,
} as const;

export {
    Antialias,
    Content,
    DeviceType,
    Extend,
    FillRule,
    Filter,
    FontSlant,
    FontType,
    FontWeight,
    Format,
    HintMetrics,
    HintStyle,
    LineCap,
    LineJoin,
    Operator,
    PathDataType,
    PatternType,
    RegionOverlap,
    Status,
    SubpixelOrder,
    SurfaceType,
    TextClusterFlags,
};
