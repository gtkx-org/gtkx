import {
    alloc,
    type ExternalObject,
    getHandle,
    type Handle,
    read,
    registerWrapperClass,
    registerWrapperClassResolver,
    setHandle,
    t,
    wrapHandle,
    type WrapperClassResolver,
    write,
} from "@gtkx/runtime";
import type { RectangleInt } from "./structs.js";
import type { DeviceOffset, DeviceScale, FallbackResolution, InkExtents, RectangleData } from "./types.js";
import { type Content, type Format, type Status, SurfaceType } from "./enums.js";
import { FontOptions } from "./font-options.js";
import {
    bindCairo,
    type BoundFunction,
    cairoGType,
    DEVICE_T,
    FONT_OPTIONS_T,
    RECTANGLE_INT_T,
    RECTANGLE_T,
    SURFACE_FULL_T,
    SURFACE_T,
} from "./lib.js";
import { checkSurface } from "./status.js";

const SURFACE_TYPE = cairoGType("cairo_gobject_surface_get_type");
const RECTANGLE_SIZE = 32;
const DEVICE_PAIR_ARGS = [SURFACE_T, t.float64, t.float64];
const DEVICE_PAIR_OUT_ARGS = [SURFACE_T, t.ref(t.float64), t.ref(t.float64)];
const SIMILAR_ARGS = [SURFACE_T, t.int32, t.int32, t.int32];
const cairoSurfaceCreateSimilar = bindCairo("cairo_surface_create_similar", SIMILAR_ARGS, SURFACE_FULL_T);
const cairoSurfaceCreateSimilarImage = bindCairo("cairo_surface_create_similar_image", SIMILAR_ARGS, SURFACE_FULL_T);

const cairoSurfaceCreateForRectangle = bindCairo(
    "cairo_surface_create_for_rectangle",
    [SURFACE_T, t.float64, t.float64, t.float64, t.float64],
    SURFACE_FULL_T,
);

const cairoSurfaceWriteToPng = bindCairo("cairo_surface_write_to_png", [SURFACE_T, t.string("full")], t.int32);
const cairoSurfaceStatus = bindCairo("cairo_surface_status", [SURFACE_T], t.int32);
const cairoSurfaceFinish = bindCairo("cairo_surface_finish", [SURFACE_T], t.void);
const cairoSurfaceFlush = bindCairo("cairo_surface_flush", [SURFACE_T], t.void);
const cairoSurfaceGetDevice = bindCairo("cairo_surface_get_device", [SURFACE_T], DEVICE_T);
const cairoSurfaceGetFontOptions = bindCairo("cairo_surface_get_font_options", [SURFACE_T, FONT_OPTIONS_T], t.void);
const cairoSurfaceGetContent = bindCairo("cairo_surface_get_content", [SURFACE_T], t.int32);
const cairoSurfaceMarkDirty = bindCairo("cairo_surface_mark_dirty", [SURFACE_T], t.void);

const cairoSurfaceMarkDirtyRectangle = bindCairo(
    "cairo_surface_mark_dirty_rectangle",
    [SURFACE_T, t.int32, t.int32, t.int32, t.int32],
    t.void,
);

const cairoSurfaceSetDeviceOffset = bindCairo("cairo_surface_set_device_offset", DEVICE_PAIR_ARGS, t.void);
const cairoSurfaceGetDeviceOffset = bindCairo("cairo_surface_get_device_offset", DEVICE_PAIR_OUT_ARGS, t.void);
const cairoSurfaceGetDeviceScale = bindCairo("cairo_surface_get_device_scale", DEVICE_PAIR_OUT_ARGS, t.void);
const cairoSurfaceSetDeviceScale = bindCairo("cairo_surface_set_device_scale", DEVICE_PAIR_ARGS, t.void);
const cairoSurfaceSetFallbackResolution = bindCairo("cairo_surface_set_fallback_resolution", DEVICE_PAIR_ARGS, t.void);

const cairoSurfaceGetFallbackResolution = bindCairo(
    "cairo_surface_get_fallback_resolution",
    DEVICE_PAIR_OUT_ARGS,
    t.void,
);

const cairoSurfaceGetType = bindCairo("cairo_surface_get_type", [SURFACE_T], t.int32);
const cairoSurfaceGetReferenceCount = bindCairo("cairo_surface_get_reference_count", [SURFACE_T], t.int32);
const cairoSurfaceCopyPage = bindCairo("cairo_surface_copy_page", [SURFACE_T], t.void);
const cairoSurfaceShowPage = bindCairo("cairo_surface_show_page", [SURFACE_T], t.void);
const cairoSurfaceHasShowTextGlyphs = bindCairo("cairo_surface_has_show_text_glyphs", [SURFACE_T], t.boolean);

const cairoSurfaceSupportsMimeType = bindCairo(
    "cairo_surface_supports_mime_type",
    [SURFACE_T, t.string("full")],
    t.boolean,
);

const cairoSurfaceMapToImage = bindCairo("cairo_surface_map_to_image", [SURFACE_T, RECTANGLE_INT_T], SURFACE_T);
const cairoSurfaceUnmapImage = bindCairo("cairo_surface_unmap_image", [SURFACE_T, SURFACE_T], t.void);
const cairoImageSurfaceCreate = bindCairo("cairo_image_surface_create", [t.int32, t.int32, t.int32], SURFACE_FULL_T);

const cairoImageSurfaceCreateFromPng = bindCairo(
    "cairo_image_surface_create_from_png",
    [t.string("full")],
    SURFACE_FULL_T,
);

const cairoImageSurfaceGetWidth = bindCairo("cairo_image_surface_get_width", [SURFACE_T], t.int32);
const cairoImageSurfaceGetHeight = bindCairo("cairo_image_surface_get_height", [SURFACE_T], t.int32);
const cairoImageSurfaceGetFormat = bindCairo("cairo_image_surface_get_format", [SURFACE_T], t.int32);
const cairoImageSurfaceGetStride = bindCairo("cairo_image_surface_get_stride", [SURFACE_T], t.int32);
const cairoRecordingSurfaceCreate = bindCairo("cairo_recording_surface_create", [t.int32, RECTANGLE_T], SURFACE_FULL_T);

const cairoRecordingSurfaceCreateUnbounded = bindCairo(
    "cairo_recording_surface_create",
    [t.int32, t.uint64],
    SURFACE_FULL_T,
);

const cairoRecordingSurfaceInkExtents = bindCairo(
    "cairo_recording_surface_ink_extents",
    [SURFACE_T, t.ref(t.float64), t.ref(t.float64), t.ref(t.float64), t.ref(t.float64)],
    t.void,
);

const cairoRecordingSurfaceGetExtents = bindCairo(
    "cairo_recording_surface_get_extents",
    [SURFACE_T, RECTANGLE_T],
    t.boolean,
);

const wrapSurface = (handle: unknown): Surface => wrapHandle(handle as ExternalObject<Handle>, Surface);

const readPair = <T>(boundFn: BoundFunction, self: object, build: (first: number, second: number) => T): T => {
    const first = { value: 0 };
    const second = { value: 0 };
    boundFn(getHandle(self), first, second);

    return build(first.value, second.value);
};

const allocRectangle = (rect: RectangleData): ExternalObject<Handle> => {
    const buffer = alloc(RECTANGLE_SIZE);
    write(buffer, t.float64, 0, rect.x);
    write(buffer, t.float64, 8, rect.y);
    write(buffer, t.float64, 16, rect.width);
    write(buffer, t.float64, 24, rect.height);

    return buffer;
};

const readRectangle = (buffer: ExternalObject<Handle>): RectangleData => ({
    x: read(buffer, t.float64, 0) as number,
    y: read(buffer, t.float64, 8) as number,
    width: read(buffer, t.float64, 16) as number,
    height: read(buffer, t.float64, 24) as number,
});

const createRecordingSurface = (content: Content, extents?: RectangleData): ExternalObject<Handle> =>
    (extents === undefined
        ? cairoRecordingSurfaceCreateUnbounded(content, 0)
        : cairoRecordingSurfaceCreate(content, allocRectangle(extents))) as ExternalObject<Handle>;

const surfaceClassFor: WrapperClassResolver = (handle) => {
    const type = cairoSurfaceGetType(handle) as SurfaceType;

    if (type === SurfaceType.IMAGE) {
        return ImageSurface;
    }

    if (type === SurfaceType.RECORDING) {
        return RecordingSurface;
    }

    return Surface;
};

/**
 * A cairo surface (`cairo_surface_t`): the target a context draws onto. Surfaces come from the `create*`
 * statics, from `ImageSurface` and `RecordingSurface`, or from GTK, and wrap as the concrete class their
 * backend reports (`instanceof ImageSurface` for an image surface).
 */
abstract class Surface {
    static {
        registerWrapperClass(this, SURFACE_TYPE);
        registerWrapperClassResolver(this, surfaceClassFor);
    }

    /** Creates a surface of the given `content` and size as compatible as possible with `other`. */
    static createSimilar(other: Surface, content: Content, width: number, height: number): Surface {
        const handle = cairoSurfaceCreateSimilar(getHandle(other), content, width, height) as ExternalObject<Handle>;

        return wrapSurface(checkSurface(handle));
    }

    /** Creates an image surface of the given `format` and size as compatible as possible with `other`. */
    static createSimilarImage(other: Surface, format: Format, width: number, height: number): ImageSurface {
        const handle =
            cairoSurfaceCreateSimilarImage(getHandle(other), format, width, height) as ExternalObject<Handle>;

        return wrapHandle(checkSurface(handle), ImageSurface);
    }

    /** Creates a surface that draws onto the given rectangle of `target`. */
    static createForRectangle(target: Surface, x: number, y: number, width: number, height: number): Surface {
        const handle =
            cairoSurfaceCreateForRectangle(getHandle(target), x, y, width, height) as ExternalObject<Handle>;

        return wrapSurface(checkSurface(handle));
    }

    /** GType of `CairoSurface`, the boxed type this class is registered under. */
    declare __type__: bigint;

    /** Writes the surface to a PNG file at `filename` and returns the resulting status. */
    writeToPng(filename: string): Status {
        return cairoSurfaceWriteToPng(getHandle(this), filename) as Status;
    }

    /** Returns the error status of the surface, `Status.SUCCESS` when it is usable. */
    status(): Status {
        return cairoSurfaceStatus(getHandle(this)) as Status;
    }

    /** Finishes the surface and drops its backend resources; further drawing reports an error. */
    finish(): void {
        cairoSurfaceFinish(getHandle(this));
    }

    /** Performs any pending drawing so the backend storage is up to date. */
    flush(): void {
        cairoSurfaceFlush(getHandle(this));
    }

    /** Returns the raw handle of the device behind the surface, or null when it has none. */
    getDevice(): ExternalObject<Handle> | null {
        return cairoSurfaceGetDevice(getHandle(this)) as ExternalObject<Handle> | null;
    }

    /** Returns the font options the surface's backend prefers for rendering text. */
    getFontOptions(): FontOptions {
        const options = FontOptions.create();
        cairoSurfaceGetFontOptions(getHandle(this), getHandle(options));

        return options;
    }

    /** Returns whether the surface holds color, alpha or both. */
    getContent(): Content {
        return cairoSurfaceGetContent(getHandle(this)) as Content;
    }

    /** Tells cairo the surface's storage was modified outside of cairo. */
    markDirty(): void {
        cairoSurfaceMarkDirty(getHandle(this));
    }

    /** Tells cairo the given rectangle of the surface's storage was modified outside of cairo. */
    markDirtyRectangle(x: number, y: number, width: number, height: number): void {
        cairoSurfaceMarkDirtyRectangle(getHandle(this), x, y, width, height);
    }

    /** Sets the offset added to device coordinates when drawing onto the surface. */
    setDeviceOffset(xOffset: number, yOffset: number): void {
        cairoSurfaceSetDeviceOffset(getHandle(this), xOffset, yOffset);
    }

    /** Returns the offset added to device coordinates when drawing onto the surface. */
    getDeviceOffset(): DeviceOffset {
        return readPair(cairoSurfaceGetDeviceOffset, this, (xOffset, yOffset) => ({ xOffset, yOffset }));
    }

    /** Returns the scale applied between user and device units. */
    getDeviceScale(): DeviceScale {
        return readPair(cairoSurfaceGetDeviceScale, this, (xScale, yScale) => ({ xScale, yScale }));
    }

    /** Sets the scale applied between user and device units. */
    setDeviceScale(xScale: number, yScale: number): void {
        cairoSurfaceSetDeviceScale(getHandle(this), xScale, yScale);
    }

    /** Sets the resolution used when vector content has to be rasterized. */
    setFallbackResolution(xPixelsPerInch: number, yPixelsPerInch: number): void {
        cairoSurfaceSetFallbackResolution(getHandle(this), xPixelsPerInch, yPixelsPerInch);
    }

    /** Returns the resolution used when vector content has to be rasterized. */
    getFallbackResolution(): FallbackResolution {
        return readPair(cairoSurfaceGetFallbackResolution, this, (xPixelsPerInch, yPixelsPerInch) => ({
            xPixelsPerInch,
            yPixelsPerInch,
        }));
    }

    /** Returns the backend type of the surface. */
    getType(): SurfaceType {
        return cairoSurfaceGetType(getHandle(this)) as SurfaceType;
    }

    /** Returns the reference count of the surface. */
    getReferenceCount(): number {
        return cairoSurfaceGetReferenceCount(getHandle(this)) as number;
    }

    /** Emits the current page and keeps its content for the next one, on paged backends. */
    copyPage(): void {
        cairoSurfaceCopyPage(getHandle(this));
    }

    /** Emits the current page and starts a blank one, on paged backends. */
    showPage(): void {
        cairoSurfaceShowPage(getHandle(this));
    }

    /** Returns whether the surface supports `Context.showTextGlyphs` natively. */
    hasShowTextGlyphs(): boolean {
        return cairoSurfaceHasShowTextGlyphs(getHandle(this)) as boolean;
    }

    /** Returns whether the surface can embed data of the given MIME type. */
    supportsMimeType(mimeType: string): boolean {
        return cairoSurfaceSupportsMimeType(getHandle(this), mimeType) as boolean;
    }

    /** Returns an image surface giving direct access to the pixels of `extents`; release it with `unmapImage`. */
    mapToImage(extents: RectangleInt): Surface {
        return wrapSurface(cairoSurfaceMapToImage(getHandle(this), getHandle(extents)));
    }

    /** Uploads the pixels of `image`, obtained from `mapToImage`, back to the surface and releases it. */
    unmapImage(image: Surface): void {
        cairoSurfaceUnmapImage(getHandle(this), getHandle(image));
    }
}

/** A surface backed by an in-memory pixel buffer, the usual target for offscreen drawing. */
class ImageSurface extends Surface {
    /** Creates an image surface of the given pixel `format` and size, the same as `new ImageSurface(...)`. */
    static create(format: Format, width: number, height: number): ImageSurface {
        return wrapHandle(
            checkSurface(cairoImageSurfaceCreate(format, width, height) as ExternalObject<Handle>),
            this,
        );
    }

    /** Loads a PNG file into a new image surface; throws when the file is missing or invalid. */
    static createFromPng(filename: string): ImageSurface {
        return wrapHandle(checkSurface(cairoImageSurfaceCreateFromPng(filename) as ExternalObject<Handle>), this);
    }

    /** Creates an image surface of the given pixel `format` and size. */
    constructor(format: Format, width: number, height: number) {
        super();
        setHandle(this, checkSurface(cairoImageSurfaceCreate(format, width, height) as ExternalObject<Handle>));
    }

    /** Returns the width of the surface in pixels. */
    getWidth(): number {
        return cairoImageSurfaceGetWidth(getHandle(this)) as number;
    }

    /** Returns the height of the surface in pixels. */
    getHeight(): number {
        return cairoImageSurfaceGetHeight(getHandle(this)) as number;
    }

    /** Returns the pixel format of the surface. */
    getFormat(): Format {
        return cairoImageSurfaceGetFormat(getHandle(this)) as Format;
    }

    /** Returns the number of bytes between the starts of consecutive rows. */
    getStride(): number {
        return cairoImageSurfaceGetStride(getHandle(this)) as number;
    }

    /** Returns a copy of the pixel data, `getStride() * getHeight()` bytes in the surface's format. */
    getData(): Uint8Array {
        this.flush();
        const totalBytes = this.getStride() * this.getHeight();

        if (totalBytes === 0) {
            return new Uint8Array(0);
        }

        const getImageData = bindCairo(
            "cairo_image_surface_get_data",
            [SURFACE_T],
            t.struct("borrowed", { size: totalBytes }),
        );

        const data = getImageData(getHandle(this)) as ExternalObject<Handle> | null;

        if (data === null) {
            return new Uint8Array(0);
        }

        return Uint8Array.from({ length: totalBytes }, (_, index) => read(data, t.uint8, index) as number);
    }
}

/** A surface that records the drawing operations applied to it, for replaying them onto other surfaces. */
class RecordingSurface extends Surface {
    /** Creates a recording surface, the same as `new RecordingSurface(...)`. */
    static create(content: Content, extents?: RectangleData): RecordingSurface {
        return new RecordingSurface(content, extents);
    }

    /** Creates a recording surface of the given `content`, bounded to `extents` or unbounded when omitted. */
    constructor(content: Content, extents?: RectangleData) {
        super();
        setHandle(this, checkSurface(createRecordingSurface(content, extents)));
    }

    /** Returns the area that has been drawn on so far. */
    inkExtents(): InkExtents {
        const x0 = { value: 0 };
        const y0 = { value: 0 };
        const width = { value: 0 };
        const height = { value: 0 };
        cairoRecordingSurfaceInkExtents(getHandle(this), x0, y0, width, height);

        return { x0: x0.value, y0: y0.value, width: width.value, height: height.value };
    }

    /** Returns the extents the surface was created with, or null for an unbounded surface. */
    getExtents(): RectangleData | null {
        const buffer = alloc(RECTANGLE_SIZE);
        const isBounded = cairoRecordingSurfaceGetExtents(getHandle(this), buffer) as boolean;

        return isBounded ? readRectangle(buffer) : null;
    }
}

export { ImageSurface, RecordingSurface, Surface };
