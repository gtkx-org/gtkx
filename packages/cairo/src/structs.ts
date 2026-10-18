import {
    alloc,
    type ExternalObject,
    getHandle,
    type Handle,
    registerWrapperClass,
    resolveType,
    setHandle,
    type StridedField,
    t,
} from "@gtkx/runtime";

/** Initial field values for a `Rectangle`; a field left out or set to null keeps zero. */
type RectangleConstructorProps = {
    /** Horizontal position of the left edge. */
    x?: number | null;
    /** Vertical position of the top edge. */
    y?: number | null;
    /** Width of the rectangle. */
    width?: number | null;
    /** Height of the rectangle. */
    height?: number | null;
};

/** Initial field values for a `RectangleInt`; a field left out or set to null keeps zero. */
type RectangleIntConstructorProps = {
    /** Horizontal position of the left edge. */
    x?: number | null;
    /** Vertical position of the top edge. */
    y?: number | null;
    /** Width of the rectangle. */
    width?: number | null;
    /** Height of the rectangle. */
    height?: number | null;
};

/** Initial field values for a `Glyph`; a field left out or set to null keeps zero. */
type GlyphConstructorProps = {
    /** Index of the glyph in the font. */
    index?: bigint | null;
    /** Horizontal position of the glyph origin. */
    x?: number | null;
    /** Vertical position of the glyph origin. */
    y?: number | null;
};

/** Initial field values for a `TextCluster`; a field left out or set to null keeps zero. */
type TextClusterConstructorProps = {
    /** Number of UTF-8 bytes the cluster covers. */
    numBytes?: number | null;
    /** Number of glyphs the cluster covers. */
    numGlyphs?: number | null;
};

const CAIRO_GOBJECT_LIBRARY = "libcairo-gobject.so.2";
const RECTANGLE_TYPE = resolveType(CAIRO_GOBJECT_LIBRARY, "cairo_gobject_rectangle_get_type");
const RECTANGLE_INT_TYPE = resolveType(CAIRO_GOBJECT_LIBRARY, "cairo_gobject_rectangle_int_get_type");
const GLYPH_TYPE = resolveType(CAIRO_GOBJECT_LIBRARY, "cairo_gobject_glyph_get_type");
const TEXT_CLUSTER_TYPE = resolveType(CAIRO_GOBJECT_LIBRARY, "cairo_gobject_text_cluster_get_type");
const RECTANGLE_SIZE = 32;
const RECTANGLE_INT_SIZE = 16;
const GLYPH_SIZE = 24;
const TEXT_CLUSTER_SIZE = 8;
const DOUBLE = t.fieldAt(t.float64);
const INT = t.fieldAt(t.int32);
const ULONG = t.fieldAt(t.biguint64);

const writeInitial = (handle: ExternalObject<Handle>, field: StridedField, offset: number, value: unknown): void => {
    if (value != null) {
        field.write(handle, offset, value);
    }
};

/** A rectangle with double-precision edges, as `copyClipRectangleList` and recording surfaces report. */
class Rectangle {
    static {
        registerWrapperClass(this, RECTANGLE_TYPE);
    }

    /** GType of `CairoRectangle`, the boxed type this struct is registered under. */
    declare __type__: bigint;

    /** Allocates a rectangle, writing the given fields and leaving the others at zero. */
    constructor(props: RectangleConstructorProps = {}) {
        const handle = alloc(RECTANGLE_SIZE, RECTANGLE_TYPE);
        writeInitial(handle, DOUBLE, 0, props.x);
        writeInitial(handle, DOUBLE, 8, props.y);
        writeInitial(handle, DOUBLE, 16, props.width);
        writeInitial(handle, DOUBLE, 24, props.height);
        setHandle(this, handle);
    }

    /** Horizontal position of the left edge. */
    get x(): number {
        return DOUBLE.read(getHandle(this), 0) as number;
    }

    /** Horizontal position of the left edge. */
    set x(value: number) {
        DOUBLE.write(getHandle(this), 0, value);
    }

    /** Vertical position of the top edge. */
    get y(): number {
        return DOUBLE.read(getHandle(this), 8) as number;
    }

    /** Vertical position of the top edge. */
    set y(value: number) {
        DOUBLE.write(getHandle(this), 8, value);
    }

    /** Width of the rectangle. */
    get width(): number {
        return DOUBLE.read(getHandle(this), 16) as number;
    }

    /** Width of the rectangle. */
    set width(value: number) {
        DOUBLE.write(getHandle(this), 16, value);
    }

    /** Height of the rectangle. */
    get height(): number {
        return DOUBLE.read(getHandle(this), 24) as number;
    }

    /** Height of the rectangle. */
    set height(value: number) {
        DOUBLE.write(getHandle(this), 24, value);
    }
}

/** A rectangle with integer edges, as Cairo regions use. */
class RectangleInt {
    static {
        registerWrapperClass(this, RECTANGLE_INT_TYPE);
    }

    /** GType of `CairoRectangleInt`, the boxed type this struct is registered under. */
    declare __type__: bigint;

    /** Allocates a rectangle, writing the given fields and leaving the others at zero. */
    constructor(props: RectangleIntConstructorProps = {}) {
        const handle = alloc(RECTANGLE_INT_SIZE, RECTANGLE_INT_TYPE);
        writeInitial(handle, INT, 0, props.x);
        writeInitial(handle, INT, 4, props.y);
        writeInitial(handle, INT, 8, props.width);
        writeInitial(handle, INT, 12, props.height);
        setHandle(this, handle);
    }

    /** Horizontal position of the left edge. */
    get x(): number {
        return INT.read(getHandle(this), 0) as number;
    }

    /** Horizontal position of the left edge. */
    set x(value: number) {
        INT.write(getHandle(this), 0, value);
    }

    /** Vertical position of the top edge. */
    get y(): number {
        return INT.read(getHandle(this), 4) as number;
    }

    /** Vertical position of the top edge. */
    set y(value: number) {
        INT.write(getHandle(this), 4, value);
    }

    /** Width of the rectangle. */
    get width(): number {
        return INT.read(getHandle(this), 8) as number;
    }

    /** Width of the rectangle. */
    set width(value: number) {
        INT.write(getHandle(this), 8, value);
    }

    /** Height of the rectangle. */
    get height(): number {
        return INT.read(getHandle(this), 12) as number;
    }

    /** Height of the rectangle. */
    set height(value: number) {
        INT.write(getHandle(this), 12, value);
    }
}

/** A `cairo_glyph_t`: one glyph index and where to draw it. */
class Glyph {
    static {
        registerWrapperClass(this, GLYPH_TYPE);
    }

    /** GType of `CairoGlyph`, the boxed type this struct is registered under. */
    declare __type__: bigint;

    /** Allocates a glyph, writing the given fields and leaving the others at zero. */
    constructor(props: GlyphConstructorProps = {}) {
        const handle = alloc(GLYPH_SIZE, GLYPH_TYPE);
        writeInitial(handle, ULONG, 0, props.index);
        writeInitial(handle, DOUBLE, 8, props.x);
        writeInitial(handle, DOUBLE, 16, props.y);
        setHandle(this, handle);
    }

    /** Index of the glyph in the font. */
    get index(): bigint {
        return ULONG.read(getHandle(this), 0) as bigint;
    }

    /** Index of the glyph in the font. */
    set index(value: bigint) {
        ULONG.write(getHandle(this), 0, value);
    }

    /** Horizontal position of the glyph origin. */
    get x(): number {
        return DOUBLE.read(getHandle(this), 8) as number;
    }

    /** Horizontal position of the glyph origin. */
    set x(value: number) {
        DOUBLE.write(getHandle(this), 8, value);
    }

    /** Vertical position of the glyph origin. */
    get y(): number {
        return DOUBLE.read(getHandle(this), 16) as number;
    }

    /** Vertical position of the glyph origin. */
    set y(value: number) {
        DOUBLE.write(getHandle(this), 16, value);
    }
}

/** A `cairo_text_cluster_t`: how many bytes of text map to how many glyphs. */
class TextCluster {
    static {
        registerWrapperClass(this, TEXT_CLUSTER_TYPE);
    }

    /** GType of `CairoTextCluster`, the boxed type this struct is registered under. */
    declare __type__: bigint;

    /** Allocates a cluster, writing the given fields and leaving the others at zero. */
    constructor(props: TextClusterConstructorProps = {}) {
        const handle = alloc(TEXT_CLUSTER_SIZE, TEXT_CLUSTER_TYPE);
        writeInitial(handle, INT, 0, props.numBytes);
        writeInitial(handle, INT, 4, props.numGlyphs);
        setHandle(this, handle);
    }

    /** Number of UTF-8 bytes the cluster covers. */
    get numBytes(): number {
        return INT.read(getHandle(this), 0) as number;
    }

    /** Number of UTF-8 bytes the cluster covers. */
    set numBytes(value: number) {
        INT.write(getHandle(this), 0, value);
    }

    /** Number of glyphs the cluster covers. */
    get numGlyphs(): number {
        return INT.read(getHandle(this), 4) as number;
    }

    /** Number of glyphs the cluster covers. */
    set numGlyphs(value: number) {
        INT.write(getHandle(this), 4, value);
    }
}

export {
    Glyph,
    type GlyphConstructorProps,
    Rectangle,
    type RectangleConstructorProps,
    RectangleInt,
    type RectangleIntConstructorProps,
    TextCluster,
    type TextClusterConstructorProps,
};
