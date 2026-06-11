import { getHandle, setHandle, t, wrapHandle } from "@gtkx/ffi";
import type { NativeHandle } from "@gtkx/ffi/cairo";
import {
    DOUBLE_REF,
    DOUBLE_TYPE,
    FONT_OPTIONS_T,
    INT_TYPE,
    LIB,
    RECT_INT_T,
    STRING_FULL,
    SURFACE_T,
    SURFACE_T_NONE,
} from "@gtkx/ffi/cairo";
import type { Content, Format, RectangleInt, Status, SurfaceType } from "@gtkx/gi/cairo/cairo.js";
import { Surface } from "@gtkx/gi/cairo/cairo.js";
import { FontOptions } from "./font-options.js";
import { ImageSurface } from "./image-surface.js";

const { fn } = t;
const DEVICE_T_NONE = t.boxed("CairoDevice", "borrowed", LIB);

declare module "@gtkx/gi/cairo/cairo.js" {
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
        function createForRectangle(target: Surface, rectangle: SubSurfaceRectangle): Surface;
    }
}

/**
 * Offset and size in user-space units used by {@link Surface.createForRectangle}.
 */
export type SubSurfaceRectangle = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type SurfaceStatic = {
    createSimilar(other: Surface, content: Content, width: number, height: number): Surface;
    createSimilarImage(other: Surface, format: Format, width: number, height: number): Surface;
    createForRectangle(target: Surface, rectangle: SubSurfaceRectangle): Surface;
};

const SurfaceWithStatics = Surface as typeof Surface & SurfaceStatic;

const cairo_surface_create_similar = fn(
    LIB,
    "cairo_surface_create_similar",
    [{ type: SURFACE_T_NONE }, { type: INT_TYPE }, { type: INT_TYPE }, { type: INT_TYPE }],
    SURFACE_T,
);
SurfaceWithStatics.createSimilar = (other: Surface, content: Content, width: number, height: number): Surface => {
    return wrapHandle(Surface, cairo_surface_create_similar(getHandle(other), content, width, height) as NativeHandle);
};

const cairo_surface_create_similar_image = fn(
    LIB,
    "cairo_surface_create_similar_image",
    [{ type: SURFACE_T_NONE }, { type: INT_TYPE }, { type: INT_TYPE }, { type: INT_TYPE }],
    SURFACE_T,
);
SurfaceWithStatics.createSimilarImage = (other: Surface, format: Format, width: number, height: number): Surface => {
    return wrapHandle(
        Surface,
        cairo_surface_create_similar_image(getHandle(other), format, width, height) as NativeHandle,
    );
};

const cairo_surface_create_for_rectangle = fn(
    LIB,
    "cairo_surface_create_for_rectangle",
    [
        { type: SURFACE_T_NONE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
        { type: DOUBLE_TYPE },
    ],
    SURFACE_T,
);
SurfaceWithStatics.createForRectangle = (target: Surface, { x, y, width, height }: SubSurfaceRectangle): Surface => {
    return wrapHandle(
        Surface,
        cairo_surface_create_for_rectangle(getHandle(target), x, y, width, height) as NativeHandle,
    );
};

const cairo_surface_write_to_png = fn(
    LIB,
    "cairo_surface_write_to_png",
    [{ type: SURFACE_T_NONE }, { type: STRING_FULL }],
    INT_TYPE,
);
Surface.prototype.writeToPng = function (filename: string): Status {
    return cairo_surface_write_to_png(getHandle(this), filename) as Status;
};

const cairo_surface_status = fn(LIB, "cairo_surface_status", [{ type: SURFACE_T_NONE }], INT_TYPE);
Surface.prototype.status = function (): Status {
    return cairo_surface_status(getHandle(this)) as Status;
};

const cairo_surface_finish = fn(LIB, "cairo_surface_finish", [{ type: SURFACE_T_NONE }], t.void);
Surface.prototype.finish = function (): void {
    cairo_surface_finish(getHandle(this));
};

const cairo_surface_flush = fn(LIB, "cairo_surface_flush", [{ type: SURFACE_T_NONE }], t.void);
Surface.prototype.flush = function (): void {
    cairo_surface_flush(getHandle(this));
};

const cairo_surface_get_device = fn(LIB, "cairo_surface_get_device", [{ type: SURFACE_T_NONE }], DEVICE_T_NONE);
Surface.prototype.getDevice = function (): NativeHandle | null {
    return cairo_surface_get_device(getHandle(this)) as NativeHandle | null;
};

const cairo_surface_get_font_options = fn(
    LIB,
    "cairo_surface_get_font_options",
    [{ type: SURFACE_T_NONE }, { type: FONT_OPTIONS_T }],
    t.void,
);
Surface.prototype.getFontOptions = function (): FontOptions {
    const options = FontOptions.create();
    cairo_surface_get_font_options(getHandle(this), getHandle(options));
    return options;
};

const cairo_surface_get_content = fn(LIB, "cairo_surface_get_content", [{ type: SURFACE_T_NONE }], INT_TYPE);
Surface.prototype.getContent = function (): Content {
    return cairo_surface_get_content(getHandle(this)) as Content;
};

const cairo_surface_mark_dirty = fn(LIB, "cairo_surface_mark_dirty", [{ type: SURFACE_T_NONE }], t.void);
Surface.prototype.markDirty = function (): void {
    cairo_surface_mark_dirty(getHandle(this));
};

const cairo_surface_mark_dirty_rectangle = fn(
    LIB,
    "cairo_surface_mark_dirty_rectangle",
    [{ type: SURFACE_T_NONE }, { type: INT_TYPE }, { type: INT_TYPE }, { type: INT_TYPE }, { type: INT_TYPE }],
    t.void,
);
Surface.prototype.markDirtyRectangle = function (x: number, y: number, width: number, height: number): void {
    cairo_surface_mark_dirty_rectangle(getHandle(this), x, y, width, height);
};

const cairo_surface_set_device_offset = fn(
    LIB,
    "cairo_surface_set_device_offset",
    [{ type: SURFACE_T_NONE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Surface.prototype.setDeviceOffset = function (xOffset: number, yOffset: number): void {
    cairo_surface_set_device_offset(getHandle(this), xOffset, yOffset);
};

const cairo_surface_get_device_offset = fn(
    LIB,
    "cairo_surface_get_device_offset",
    [{ type: SURFACE_T_NONE }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    t.void,
);
Surface.prototype.getDeviceOffset = function (): { xOffset: number; yOffset: number } {
    const xRef = { value: 0 };
    const yRef = { value: 0 };
    cairo_surface_get_device_offset(getHandle(this), xRef, yRef);
    return { xOffset: xRef.value, yOffset: yRef.value };
};

const cairo_surface_get_device_scale = fn(
    LIB,
    "cairo_surface_get_device_scale",
    [{ type: SURFACE_T_NONE }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    t.void,
);
Surface.prototype.getDeviceScale = function (): { xScale: number; yScale: number } {
    const xRef = { value: 0 };
    const yRef = { value: 0 };
    cairo_surface_get_device_scale(getHandle(this), xRef, yRef);
    return { xScale: xRef.value, yScale: yRef.value };
};

const cairo_surface_set_device_scale = fn(
    LIB,
    "cairo_surface_set_device_scale",
    [{ type: SURFACE_T_NONE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Surface.prototype.setDeviceScale = function (xScale: number, yScale: number): void {
    cairo_surface_set_device_scale(getHandle(this), xScale, yScale);
};

const cairo_surface_set_fallback_resolution = fn(
    LIB,
    "cairo_surface_set_fallback_resolution",
    [{ type: SURFACE_T_NONE }, { type: DOUBLE_TYPE }, { type: DOUBLE_TYPE }],
    t.void,
);
Surface.prototype.setFallbackResolution = function (xPixelsPerInch: number, yPixelsPerInch: number): void {
    cairo_surface_set_fallback_resolution(getHandle(this), xPixelsPerInch, yPixelsPerInch);
};

const cairo_surface_get_fallback_resolution = fn(
    LIB,
    "cairo_surface_get_fallback_resolution",
    [{ type: SURFACE_T_NONE }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    t.void,
);
Surface.prototype.getFallbackResolution = function (): { xPixelsPerInch: number; yPixelsPerInch: number } {
    const xRef = { value: 0 };
    const yRef = { value: 0 };
    cairo_surface_get_fallback_resolution(getHandle(this), xRef, yRef);
    return { xPixelsPerInch: xRef.value, yPixelsPerInch: yRef.value };
};

const cairo_surface_get_type = fn(LIB, "cairo_surface_get_type", [{ type: SURFACE_T_NONE }], INT_TYPE);
Surface.prototype.getType = function (): SurfaceType {
    return cairo_surface_get_type(getHandle(this)) as SurfaceType;
};

const cairo_surface_get_reference_count = fn(
    LIB,
    "cairo_surface_get_reference_count",
    [{ type: SURFACE_T_NONE }],
    INT_TYPE,
);
Surface.prototype.getReferenceCount = function (): number {
    return cairo_surface_get_reference_count(getHandle(this)) as number;
};

const cairo_surface_copy_page = fn(LIB, "cairo_surface_copy_page", [{ type: SURFACE_T_NONE }], t.void);
Surface.prototype.copyPage = function (): void {
    cairo_surface_copy_page(getHandle(this));
};

const cairo_surface_show_page = fn(LIB, "cairo_surface_show_page", [{ type: SURFACE_T_NONE }], t.void);
Surface.prototype.showPage = function (): void {
    cairo_surface_show_page(getHandle(this));
};

const cairo_surface_has_show_text_glyphs = fn(
    LIB,
    "cairo_surface_has_show_text_glyphs",
    [{ type: SURFACE_T_NONE }],
    t.boolean,
);
Surface.prototype.hasShowTextGlyphs = function (): boolean {
    return cairo_surface_has_show_text_glyphs(getHandle(this)) as boolean;
};

const cairo_surface_supports_mime_type = fn(
    LIB,
    "cairo_surface_supports_mime_type",
    [{ type: SURFACE_T_NONE }, { type: STRING_FULL }],
    t.boolean,
);
Surface.prototype.supportsMimeType = function (mimeType: string): boolean {
    return cairo_surface_supports_mime_type(getHandle(this), mimeType) as boolean;
};

const cairo_surface_map_to_image = fn(
    LIB,
    "cairo_surface_map_to_image",
    [{ type: SURFACE_T_NONE }, { type: RECT_INT_T }],
    SURFACE_T_NONE,
);
Surface.prototype.mapToImage = function (extents: RectangleInt): Surface {
    const ptr = cairo_surface_map_to_image(getHandle(this), getHandle(extents)) as NativeHandle;
    const surface = Object.create(ImageSurface.prototype) as ImageSurface;
    setHandle(surface, ptr);
    return surface;
};

const cairo_surface_unmap_image = fn(
    LIB,
    "cairo_surface_unmap_image",
    [{ type: SURFACE_T_NONE }, { type: SURFACE_T_NONE }],
    t.void,
);
Surface.prototype.unmapImage = function (image: Surface): void {
    cairo_surface_unmap_image(getHandle(this), getHandle(image));
};
