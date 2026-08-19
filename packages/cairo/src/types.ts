/** One glyph to draw: its index in the font and its position in user space. */
type CairoGlyph = {
    /** Index of the glyph in the font. */
    index: number;
    /** Horizontal position of the glyph origin. */
    x: number;
    /** Vertical position of the glyph origin. */
    y: number;
};

/** One text cluster: how many bytes of text map to how many glyphs. */
type CairoTextCluster = {
    /** Number of UTF-8 bytes the cluster covers. */
    numBytes: number;
    /** Number of glyphs the cluster covers. */
    numGlyphs: number;
};

/** Extents of a run of text or glyphs in user space. */
type TextExtents = {
    /** Horizontal distance from the origin to the leftmost part of the glyphs. */
    xBearing: number;
    /** Vertical distance from the origin to the topmost part of the glyphs. */
    yBearing: number;
    /** Width of the glyphs as drawn. */
    width: number;
    /** Height of the glyphs as drawn. */
    height: number;
    /** Horizontal distance to advance after drawing the glyphs. */
    xAdvance: number;
    /** Vertical distance to advance after drawing the glyphs. */
    yAdvance: number;
};

/** Metrics of a font in user space. */
type FontExtents = {
    /** Distance the font extends above the baseline. */
    ascent: number;
    /** Distance the font extends below the baseline. */
    descent: number;
    /** Recommended vertical distance between baselines. */
    height: number;
    /** Maximum horizontal advance of any glyph in the font. */
    maxXAdvance: number;
    /** Maximum vertical advance of any glyph in the font. */
    maxYAdvance: number;
};

/** A path segment starting a new sub-path at a point. */
type MoveToSegment = {
    /** Tag of the segment. */
    type: "moveTo";
    /** Horizontal position of the point. */
    x: number;
    /** Vertical position of the point. */
    y: number;
};

/** A path segment drawing a straight line to a point. */
type LineToSegment = {
    /** Tag of the segment. */
    type: "lineTo";
    /** Horizontal position of the end point. */
    x: number;
    /** Vertical position of the end point. */
    y: number;
};

/** A path segment drawing a cubic Bézier curve through two control points to an end point. */
type CurveToSegment = {
    /** Tag of the segment. */
    type: "curveTo";
    /** Horizontal position of the first control point. */
    x1: number;
    /** Vertical position of the first control point. */
    y1: number;
    /** Horizontal position of the second control point. */
    x2: number;
    /** Vertical position of the second control point. */
    y2: number;
    /** Horizontal position of the end point. */
    x3: number;
    /** Vertical position of the end point. */
    y3: number;
};

/** A path segment closing the current sub-path. */
type ClosePathSegment = {
    /** Tag of the segment. */
    type: "closePath";
};

/** One segment of a path copied out of a context or a mesh pattern. */
type PathData = MoveToSegment | LineToSegment | CurveToSegment | ClosePathSegment;

/** A position in user or device space. */
type Point = {
    /** Horizontal coordinate. */
    x: number;
    /** Vertical coordinate. */
    y: number;
};

/** A displacement in user or device space, unaffected by translation. */
type Distance = {
    /** Horizontal component. */
    dx: number;
    /** Vertical component. */
    dy: number;
};

/** A bounding box given by its two opposite corners in user space. */
type Extents = {
    /** Left edge. */
    x1: number;
    /** Top edge. */
    y1: number;
    /** Right edge. */
    x2: number;
    /** Bottom edge. */
    y2: number;
};

/** A dash pattern as a context reports it: alternating on and off lengths and the offset into them. */
type DashPattern = {
    /** Alternating on and off lengths in user space; empty for a solid line. */
    dashes: number[];
    /** Offset into the pattern at which the stroke starts. */
    offset: number;
};

/** A rectangle as plain data, for the calls that take or return many at once. */
type RectangleData = {
    /** Horizontal position of the left edge. */
    x: number;
    /** Vertical position of the top edge. */
    y: number;
    /** Width of the rectangle. */
    width: number;
    /** Height of the rectangle. */
    height: number;
};

/** A color with straight (non-premultiplied) components in the 0 to 1 range. */
type RgbaColor = {
    /** Red component. */
    red: number;
    /** Green component. */
    green: number;
    /** Blue component. */
    blue: number;
    /** Alpha component. */
    alpha: number;
};

/** @deprecated Since 1.3. Props of the generated stub constructor that `@gtkx/cairo` replaced; removed in v2. */
type ContextConstructorProps = Record<string, never>;
/** @deprecated Since 1.3. Props of the generated stub constructor that `@gtkx/cairo` replaced; removed in v2. */
type DeviceConstructorProps = Record<string, never>;
/** @deprecated Since 1.3. Props of the generated stub constructor that `@gtkx/cairo` replaced; removed in v2. */
type SurfaceConstructorProps = Record<string, never>;
/** @deprecated Since 1.3. Props of the generated stub constructor that `@gtkx/cairo` replaced; removed in v2. */
type PatternConstructorProps = Record<string, never>;
/** @deprecated Since 1.3. Props of the generated stub constructor that `@gtkx/cairo` replaced; removed in v2. */
type RegionConstructorProps = Record<string, never>;
/** @deprecated Since 1.3. Props of the generated stub constructor that `@gtkx/cairo` replaced; removed in v2. */
type FontOptionsConstructorProps = Record<string, never>;
/** @deprecated Since 1.3. Props of the generated stub constructor that `@gtkx/cairo` replaced; removed in v2. */
type FontFaceConstructorProps = Record<string, never>;
/** @deprecated Since 1.3. Props of the generated stub constructor that `@gtkx/cairo` replaced; removed in v2. */
type ScaledFontConstructorProps = Record<string, never>;

export type {
    CairoGlyph,
    CairoTextCluster,
    ClosePathSegment,
    /** @deprecated Since 1.3. Removed in v2. */
    ContextConstructorProps,
    CurveToSegment,
    DashPattern,
    /** @deprecated Since 1.3. Removed in v2. */
    DeviceConstructorProps,
    Distance,
    Extents,
    FontExtents,
    /** @deprecated Since 1.3. Removed in v2. */
    FontFaceConstructorProps,
    /** @deprecated Since 1.3. Removed in v2. */
    FontOptionsConstructorProps,
    LineToSegment,
    MoveToSegment,
    PathData,
    /** @deprecated Since 1.3. Removed in v2. */
    PatternConstructorProps,
    Point,
    RectangleData,
    /** @deprecated Since 1.3. Removed in v2. */
    RegionConstructorProps,
    RgbaColor,
    /** @deprecated Since 1.3. Removed in v2. */
    ScaledFontConstructorProps,
    /** @deprecated Since 1.3. Removed in v2. */
    SurfaceConstructorProps,
    TextExtents,
};
