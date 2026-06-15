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

const cairoSurfaceCreateSimilar = bind(
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
    return wrapHandle(cairoSurfaceCreateSimilar(getHandle(other), content, width, height) as NativeHandle, Surface);
};

const cairoSurfaceCreateSimilarImage = bind(
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
    return wrapHandle(cairoSurfaceCreateSimilarImage(getHandle(other), format, width, height) as NativeHandle, Surface);
};

const cairoSurfaceCreateForRectangle = bind(
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
    return wrapHandle(cairoSurfaceCreateForRectangle(getHandle(target), x, y, width, height) as NativeHandle, Surface);
};

const cairoSurfaceWriteToPng = bind(
    "libcairo.so.2",
    "cairo_surface_write_to_png",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.string("full") },
    ],
    t.int32,
);
Surface.prototype.writeToPng = function (filename: string): Status {
    return cairoSurfaceWriteToPng(getHandle(this), filename) as Status;
};

const cairoSurfaceStatus = bind(
    "libcairo.so.2",
    "cairo_surface_status",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
Surface.prototype.status = function (): Status {
    return cairoSurfaceStatus(getHandle(this)) as Status;
};

const cairoSurfaceFinish = bind(
    "libcairo.so.2",
    "cairo_surface_finish",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.finish = function (): void {
    cairoSurfaceFinish(getHandle(this));
};

const cairoSurfaceFlush = bind(
    "libcairo.so.2",
    "cairo_surface_flush",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.flush = function (): void {
    cairoSurfaceFlush(getHandle(this));
};

const cairoSurfaceGetDevice = bind(
    "libcairo.so.2",
    "cairo_surface_get_device",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    DEVICE_T_NONE,
);
Surface.prototype.getDevice = function (): NativeHandle | null {
    return cairoSurfaceGetDevice(getHandle(this)) as NativeHandle | null;
};

const cairoSurfaceGetFontOptions = bind(
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
    cairoSurfaceGetFontOptions(getHandle(this), getHandle(options));
    return options;
};

const cairoSurfaceGetContent = bind(
    "libcairo.so.2",
    "cairo_surface_get_content",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
Surface.prototype.getContent = function (): Content {
    return cairoSurfaceGetContent(getHandle(this)) as Content;
};

const cairoSurfaceMarkDirty = bind(
    "libcairo.so.2",
    "cairo_surface_mark_dirty",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.markDirty = function (): void {
    cairoSurfaceMarkDirty(getHandle(this));
};

const cairoSurfaceMarkDirtyRectangle = bind(
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
    cairoSurfaceMarkDirtyRectangle(getHandle(this), x, y, width, height);
};

const cairoSurfaceSetDeviceOffset = bind(
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
    cairoSurfaceSetDeviceOffset(getHandle(this), xOffset, yOffset);
};

const cairoSurfaceGetDeviceOffset = bind(
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
    cairoSurfaceGetDeviceOffset(getHandle(this), xRef, yRef);
    return { xOffset: xRef.value, yOffset: yRef.value };
};

const cairoSurfaceGetDeviceScale = bind(
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
    cairoSurfaceGetDeviceScale(getHandle(this), xRef, yRef);
    return { xScale: xRef.value, yScale: yRef.value };
};

const cairoSurfaceSetDeviceScale = bind(
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
    cairoSurfaceSetDeviceScale(getHandle(this), xScale, yScale);
};

const cairoSurfaceSetFallbackResolution = bind(
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
    cairoSurfaceSetFallbackResolution(getHandle(this), xPixelsPerInch, yPixelsPerInch);
};

const cairoSurfaceGetFallbackResolution = bind(
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
    cairoSurfaceGetFallbackResolution(getHandle(this), xRef, yRef);
    return { xPixelsPerInch: xRef.value, yPixelsPerInch: yRef.value };
};

const cairoSurfaceGetType = bind(
    "libcairo.so.2",
    "cairo_surface_get_type",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
Surface.prototype.getType = function (): SurfaceType {
    return cairoSurfaceGetType(getHandle(this)) as SurfaceType;
};

const cairoSurfaceGetReferenceCount = bind(
    "libcairo.so.2",
    "cairo_surface_get_reference_count",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
Surface.prototype.getReferenceCount = function (): number {
    return cairoSurfaceGetReferenceCount(getHandle(this)) as number;
};

const cairoSurfaceCopyPage = bind(
    "libcairo.so.2",
    "cairo_surface_copy_page",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.copyPage = function (): void {
    cairoSurfaceCopyPage(getHandle(this));
};

const cairoSurfaceShowPage = bind(
    "libcairo.so.2",
    "cairo_surface_show_page",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.void,
);
Surface.prototype.showPage = function (): void {
    cairoSurfaceShowPage(getHandle(this));
};

const cairoSurfaceHasShowTextGlyphs = bind(
    "libcairo.so.2",
    "cairo_surface_has_show_text_glyphs",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.boolean,
);
Surface.prototype.hasShowTextGlyphs = function (): boolean {
    return cairoSurfaceHasShowTextGlyphs(getHandle(this)) as boolean;
};

const cairoSurfaceSupportsMimeType = bind(
    "libcairo.so.2",
    "cairo_surface_supports_mime_type",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.string("full") },
    ],
    t.boolean,
);
Surface.prototype.supportsMimeType = function (mimeType: string): boolean {
    return cairoSurfaceSupportsMimeType(getHandle(this), mimeType) as boolean;
};

const cairoSurfaceMapToImage = bind(
    "libcairo.so.2",
    "cairo_surface_map_to_image",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.boxed("cairo_rectangle_int_t", "borrowed", "libcairo.so.2") },
    ],
    t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
Surface.prototype.mapToImage = function (extents: RectangleInt): Surface {
    const ptr = cairoSurfaceMapToImage(getHandle(this), getHandle(extents)) as NativeHandle;
    const surface = Object.create(ImageSurface.prototype) as ImageSurface;
    setHandle(surface, ptr);
    return surface;
};

const cairoSurfaceUnmapImage = bind(
    "libcairo.so.2",
    "cairo_surface_unmap_image",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
    ],
    t.void,
);
Surface.prototype.unmapImage = function (image: Surface): void {
    cairoSurfaceUnmapImage(getHandle(this), getHandle(image));
};
