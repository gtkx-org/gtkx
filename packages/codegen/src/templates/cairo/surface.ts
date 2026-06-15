import { getHandle, setHandle, t, wrapHandle } from "@gtkx/ffi";
import type { NativeHandle } from "@gtkx/native";
import type { Content, Format, RectangleInt, Status, SurfaceType } from "../cairo.js";
import { Surface } from "../cairo.js";
import { FontOptions } from "./font-options.js";
import { ImageSurface } from "./image-surface.js";

const { bind } = t;
const DEVICE_T_NONE = t.boxed("CairoDevice", "borrowed", "libcairo.so.2");

declare module "../cairo.js" {
    interface Surface {
        writeToPng(filename: string): Status;
        status(): Status;
        finish(): void;
        flush(): void;
        getDevice(): NativeHandle | null;
        getFontOptions(): FontOptions;
        getContent(): Content;
        markDirty(): void;
        markDirtyRectangle(x: number, y: number, width: number, height: number): void;
        setDeviceOffset(xOffset: number, yOffset: number): void;
        getDeviceOffset(): { xOffset: number; yOffset: number };
        getDeviceScale(): { xScale: number; yScale: number };
        setDeviceScale(xScale: number, yScale: number): void;
        setFallbackResolution(xPixelsPerInch: number, yPixelsPerInch: number): void;
        getFallbackResolution(): { xPixelsPerInch: number; yPixelsPerInch: number };
        getType(): SurfaceType;
        getReferenceCount(): number;
        copyPage(): void;
        showPage(): void;
        hasShowTextGlyphs(): boolean;
        supportsMimeType(mimeType: string): boolean;
        mapToImage(extents: RectangleInt): Surface;
        unmapImage(image: Surface): void;
    }

    namespace Surface {
        function createSimilar(other: Surface, content: Content, width: number, height: number): Surface;
        function createSimilarImage(other: Surface, format: Format, width: number, height: number): Surface;
        function createForRectangle(target: Surface, x: number, y: number, width: number, height: number): Surface;
    }
}

type SurfaceStatic = {
    createSimilar(other: Surface, content: Content, width: number, height: number): Surface;
    createSimilarImage(other: Surface, format: Format, width: number, height: number): Surface;
    createForRectangle(target: Surface, x: number, y: number, width: number, height: number): Surface;
};

const SurfaceWithStatics = Surface as typeof Surface & SurfaceStatic;

const cairo_surface_create_similar = bind(
    "libcairo.so.2",
    "cairo_surface_create_similar",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.boxed("CairoSurface", "full", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
SurfaceWithStatics.createSimilar = (other: Surface, content: Content, width: number, height: number): Surface => {
    return wrapHandle(cairo_surface_create_similar(getHandle(other), content, width, height) as NativeHandle, Surface);
};

const cairo_surface_create_similar_image = bind(
    "libcairo.so.2",
    "cairo_surface_create_similar_image",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.boxed("CairoSurface", "full", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
SurfaceWithStatics.createSimilarImage = (other: Surface, format: Format, width: number, height: number): Surface => {
    return wrapHandle(
        cairo_surface_create_similar_image(getHandle(other), format, width, height) as NativeHandle,
        Surface,
    );
};

const cairo_surface_create_for_rectangle = bind(
    "libcairo.so.2",
    "cairo_surface_create_for_rectangle",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.boxed("CairoSurface", "full", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
SurfaceWithStatics.createForRectangle = (
    target: Surface,
    x: number,
    y: number,
    width: number,
    height: number,
): Surface => {
    return wrapHandle(
        cairo_surface_create_for_rectangle(getHandle(target), x, y, width, height) as NativeHandle,
        Surface,
    );
};

const cairo_surface_write_to_png = bind(
    "libcairo.so.2",
    "cairo_surface_write_to_png",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.string("full") },
    ],
    t.int32,
);
Surface.prototype.writeToPng = function (filename: string): Status {
    return cairo_surface_write_to_png(getHandle(this), filename) as Status;
};

const cairo_surface_status = bind(
    "libcairo.so.2",
    "cairo_surface_status",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
Surface.prototype.status = function (): Status {
    return cairo_surface_status(getHandle(this)) as Status;
};

const cairo_surface_finish = bind(
    "libcairo.so.2",
    "cairo_surface_finish",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.finish = function (): void {
    cairo_surface_finish(getHandle(this));
};

const cairo_surface_flush = bind(
    "libcairo.so.2",
    "cairo_surface_flush",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.flush = function (): void {
    cairo_surface_flush(getHandle(this));
};

const cairo_surface_get_device = bind(
    "libcairo.so.2",
    "cairo_surface_get_device",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    DEVICE_T_NONE,
);
Surface.prototype.getDevice = function (): NativeHandle | null {
    return cairo_surface_get_device(getHandle(this)) as NativeHandle | null;
};

const cairo_surface_get_font_options = bind(
    "libcairo.so.2",
    "cairo_surface_get_font_options",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
    ],
    t.void,
);
Surface.prototype.getFontOptions = function (): FontOptions {
    const options = FontOptions.create();
    cairo_surface_get_font_options(getHandle(this), getHandle(options));
    return options;
};

const cairo_surface_get_content = bind(
    "libcairo.so.2",
    "cairo_surface_get_content",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
Surface.prototype.getContent = function (): Content {
    return cairo_surface_get_content(getHandle(this)) as Content;
};

const cairo_surface_mark_dirty = bind(
    "libcairo.so.2",
    "cairo_surface_mark_dirty",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.markDirty = function (): void {
    cairo_surface_mark_dirty(getHandle(this));
};

const cairo_surface_mark_dirty_rectangle = bind(
    "libcairo.so.2",
    "cairo_surface_mark_dirty_rectangle",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
        { type: t.int32 },
    ],
    t.void,
);
Surface.prototype.markDirtyRectangle = function (x: number, y: number, width: number, height: number): void {
    cairo_surface_mark_dirty_rectangle(getHandle(this), x, y, width, height);
};

const cairo_surface_set_device_offset = bind(
    "libcairo.so.2",
    "cairo_surface_set_device_offset",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Surface.prototype.setDeviceOffset = function (xOffset: number, yOffset: number): void {
    cairo_surface_set_device_offset(getHandle(this), xOffset, yOffset);
};

const cairo_surface_get_device_offset = bind(
    "libcairo.so.2",
    "cairo_surface_get_device_offset",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.void,
);
Surface.prototype.getDeviceOffset = function (): { xOffset: number; yOffset: number } {
    const xRef = { value: 0 };
    const yRef = { value: 0 };
    cairo_surface_get_device_offset(getHandle(this), xRef, yRef);
    return { xOffset: xRef.value, yOffset: yRef.value };
};

const cairo_surface_get_device_scale = bind(
    "libcairo.so.2",
    "cairo_surface_get_device_scale",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.void,
);
Surface.prototype.getDeviceScale = function (): { xScale: number; yScale: number } {
    const xRef = { value: 0 };
    const yRef = { value: 0 };
    cairo_surface_get_device_scale(getHandle(this), xRef, yRef);
    return { xScale: xRef.value, yScale: yRef.value };
};

const cairo_surface_set_device_scale = bind(
    "libcairo.so.2",
    "cairo_surface_set_device_scale",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Surface.prototype.setDeviceScale = function (xScale: number, yScale: number): void {
    cairo_surface_set_device_scale(getHandle(this), xScale, yScale);
};

const cairo_surface_set_fallback_resolution = bind(
    "libcairo.so.2",
    "cairo_surface_set_fallback_resolution",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.float64 },
        { type: t.float64 },
    ],
    t.void,
);
Surface.prototype.setFallbackResolution = function (xPixelsPerInch: number, yPixelsPerInch: number): void {
    cairo_surface_set_fallback_resolution(getHandle(this), xPixelsPerInch, yPixelsPerInch);
};

const cairo_surface_get_fallback_resolution = bind(
    "libcairo.so.2",
    "cairo_surface_get_fallback_resolution",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.void,
);
Surface.prototype.getFallbackResolution = function (): { xPixelsPerInch: number; yPixelsPerInch: number } {
    const xRef = { value: 0 };
    const yRef = { value: 0 };
    cairo_surface_get_fallback_resolution(getHandle(this), xRef, yRef);
    return { xPixelsPerInch: xRef.value, yPixelsPerInch: yRef.value };
};

const cairo_surface_get_type = bind(
    "libcairo.so.2",
    "cairo_surface_get_type",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
Surface.prototype.getType = function (): SurfaceType {
    return cairo_surface_get_type(getHandle(this)) as SurfaceType;
};

const cairo_surface_get_reference_count = bind(
    "libcairo.so.2",
    "cairo_surface_get_reference_count",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
Surface.prototype.getReferenceCount = function (): number {
    return cairo_surface_get_reference_count(getHandle(this)) as number;
};

const cairo_surface_copy_page = bind(
    "libcairo.so.2",
    "cairo_surface_copy_page",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.copyPage = function (): void {
    cairo_surface_copy_page(getHandle(this));
};

const cairo_surface_show_page = bind(
    "libcairo.so.2",
    "cairo_surface_show_page",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.showPage = function (): void {
    cairo_surface_show_page(getHandle(this));
};

const cairo_surface_has_show_text_glyphs = bind(
    "libcairo.so.2",
    "cairo_surface_has_show_text_glyphs",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.boolean,
);
Surface.prototype.hasShowTextGlyphs = function (): boolean {
    return cairo_surface_has_show_text_glyphs(getHandle(this)) as boolean;
};

const cairo_surface_supports_mime_type = bind(
    "libcairo.so.2",
    "cairo_surface_supports_mime_type",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.string("full") },
    ],
    t.boolean,
);
Surface.prototype.supportsMimeType = function (mimeType: string): boolean {
    return cairo_surface_supports_mime_type(getHandle(this), mimeType) as boolean;
};

const cairo_surface_map_to_image = bind(
    "libcairo.so.2",
    "cairo_surface_map_to_image",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.boxed("cairo_rectangle_int_t", "borrowed", "libcairo.so.2") },
    ],
    t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
Surface.prototype.mapToImage = function (extents: RectangleInt): Surface {
    const ptr = cairo_surface_map_to_image(getHandle(this), getHandle(extents)) as NativeHandle;
    const surface = Object.create(ImageSurface.prototype) as ImageSurface;
    setHandle(surface, ptr);
    return surface;
};

const cairo_surface_unmap_image = bind(
    "libcairo.so.2",
    "cairo_surface_unmap_image",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
    ],
    t.void,
);
Surface.prototype.unmapImage = function (image: Surface): void {
    cairo_surface_unmap_image(getHandle(this), getHandle(image));
};
