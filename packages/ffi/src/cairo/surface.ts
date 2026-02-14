import { createRef, type NativeHandle } from "@gtkx/native";
import { Device } from "../generated/cairo/device.js";
import type { Content, Format, Status, SurfaceType } from "../generated/cairo/enums.js";
import type { RectangleInt } from "../generated/cairo/rectangle-int.js";
import { Surface } from "../generated/cairo/surface.js";
import { alloc, call, read, write } from "../native.js";
import { getNativeObject } from "../registry.js";
import { DEVICE_T, DOUBLE_TYPE, INT_TYPE, LIB, RECT_INT_T, SURFACE_T, SURFACE_T_NONE, ULONG_TYPE } from "./common.js";
import { ImageSurface } from "./image-surface.js";

declare module "../generated/cairo/surface.js" {
    interface Surface {
        finish(): void;
        createSimilar(content: "COLOR" | "ALPHA" | "COLOR_ALPHA", width: number, height: number): Surface;
        flush(): void;
        markDirty(): void;
        writeToPng(filename: string): void;
        getType(): SurfaceType;
        getContent(): Content;
    }
}

Surface.prototype.finish = function (): void {
    call(LIB, "cairo_surface_finish", [{ type: SURFACE_T_NONE, value: this.handle }], { type: "undefined" });
};

const CONTENT_MAP = {
    COLOR: 0x1000,
    ALPHA: 0x2000,
    COLOR_ALPHA: 0x3000,
} as const;

Surface.prototype.createSimilar = function (
    content: "COLOR" | "ALPHA" | "COLOR_ALPHA",
    width: number,
    height: number,
): Surface {
    const ptr = call(
        LIB,
        "cairo_surface_create_similar",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: CONTENT_MAP[content] },
            { type: INT_TYPE, value: width },
            { type: INT_TYPE, value: height },
        ],
        SURFACE_T,
    ) as NativeHandle;
    return getNativeObject(ptr, Surface) as Surface;
};

Surface.prototype.flush = function (): void {
    call(LIB, "cairo_surface_flush", [{ type: SURFACE_T_NONE, value: this.handle }], { type: "undefined" });
};

Surface.prototype.markDirty = function (): void {
    call(LIB, "cairo_surface_mark_dirty", [{ type: SURFACE_T_NONE, value: this.handle }], { type: "undefined" });
};

Surface.prototype.writeToPng = function (filename: string): void {
    call(
        LIB,
        "cairo_surface_write_to_png",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: filename },
        ],
        INT_TYPE,
    );
};

Surface.prototype.getType = function (): SurfaceType {
    return call(LIB, "cairo_surface_get_type", [{ type: SURFACE_T_NONE, value: this.handle }], INT_TYPE) as SurfaceType;
};

Surface.prototype.getContent = function (): Content {
    return call(LIB, "cairo_surface_get_content", [{ type: SURFACE_T_NONE, value: this.handle }], INT_TYPE) as Content;
};

declare module "../generated/cairo/surface.js" {
    interface Surface {
        status(): Status;
        createSimilarImage(format: Format, width: number, height: number): ImageSurface;
        createForRectangle(x: number, y: number, width: number, height: number): Surface;
        setDeviceOffset(xOffset: number, yOffset: number): void;
        getDeviceOffset(): { x: number; y: number };
        setDeviceScale(xScale: number, yScale: number): void;
        getDeviceScale(): { x: number; y: number };
        setFallbackResolution(xPpi: number, yPpi: number): void;
        getFallbackResolution(): { x: number; y: number };
        markDirtyRectangle(x: number, y: number, width: number, height: number): void;
        copyPage(): void;
        showPage(): void;
        hasShowTextGlyphs(): boolean;
    }
}

Surface.prototype.status = function (): Status {
    return call(LIB, "cairo_surface_status", [{ type: SURFACE_T_NONE, value: this.handle }], INT_TYPE) as Status;
};

Surface.prototype.createSimilarImage = function (format: Format, width: number, height: number): ImageSurface {
    const ptr = call(
        LIB,
        "cairo_surface_create_similar_image",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: format },
            { type: INT_TYPE, value: width },
            { type: INT_TYPE, value: height },
        ],
        SURFACE_T,
    ) as NativeHandle;
    const surface = Object.create(ImageSurface.prototype) as ImageSurface;
    surface.handle = ptr;
    return surface;
};

Surface.prototype.createForRectangle = function (x: number, y: number, width: number, height: number): Surface {
    const ptr = call(
        LIB,
        "cairo_surface_create_for_rectangle",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: x },
            { type: DOUBLE_TYPE, value: y },
            { type: DOUBLE_TYPE, value: width },
            { type: DOUBLE_TYPE, value: height },
        ],
        SURFACE_T,
    ) as NativeHandle;
    return getNativeObject(ptr, Surface) as Surface;
};

Surface.prototype.setDeviceOffset = function (xOffset: number, yOffset: number): void {
    call(
        LIB,
        "cairo_surface_set_device_offset",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: xOffset },
            { type: DOUBLE_TYPE, value: yOffset },
        ],
        { type: "undefined" },
    );
};

Surface.prototype.getDeviceOffset = function (): { x: number; y: number } {
    const xRef = createRef(0.0);
    const yRef = createRef(0.0);
    call(
        LIB,
        "cairo_surface_get_device_offset",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: xRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: yRef },
        ],
        { type: "undefined" },
    );
    return { x: xRef.value, y: yRef.value };
};

Surface.prototype.setDeviceScale = function (xScale: number, yScale: number): void {
    call(
        LIB,
        "cairo_surface_set_device_scale",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: xScale },
            { type: DOUBLE_TYPE, value: yScale },
        ],
        { type: "undefined" },
    );
};

Surface.prototype.getDeviceScale = function (): { x: number; y: number } {
    const xRef = createRef(0.0);
    const yRef = createRef(0.0);
    call(
        LIB,
        "cairo_surface_get_device_scale",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: xRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: yRef },
        ],
        { type: "undefined" },
    );
    return { x: xRef.value, y: yRef.value };
};

Surface.prototype.setFallbackResolution = function (xPpi: number, yPpi: number): void {
    call(
        LIB,
        "cairo_surface_set_fallback_resolution",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: DOUBLE_TYPE, value: xPpi },
            { type: DOUBLE_TYPE, value: yPpi },
        ],
        { type: "undefined" },
    );
};

Surface.prototype.getFallbackResolution = function (): { x: number; y: number } {
    const xRef = createRef(0.0);
    const yRef = createRef(0.0);
    call(
        LIB,
        "cairo_surface_get_fallback_resolution",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: xRef },
            { type: { type: "ref", innerType: DOUBLE_TYPE }, value: yRef },
        ],
        { type: "undefined" },
    );
    return { x: xRef.value, y: yRef.value };
};

Surface.prototype.markDirtyRectangle = function (x: number, y: number, width: number, height: number): void {
    call(
        LIB,
        "cairo_surface_mark_dirty_rectangle",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: INT_TYPE, value: x },
            { type: INT_TYPE, value: y },
            { type: INT_TYPE, value: width },
            { type: INT_TYPE, value: height },
        ],
        { type: "undefined" },
    );
};

Surface.prototype.copyPage = function (): void {
    call(LIB, "cairo_surface_copy_page", [{ type: SURFACE_T_NONE, value: this.handle }], { type: "undefined" });
};

Surface.prototype.showPage = function (): void {
    call(LIB, "cairo_surface_show_page", [{ type: SURFACE_T_NONE, value: this.handle }], { type: "undefined" });
};

Surface.prototype.hasShowTextGlyphs = function (): boolean {
    return call(LIB, "cairo_surface_has_show_text_glyphs", [{ type: SURFACE_T_NONE, value: this.handle }], {
        type: "boolean",
    }) as boolean;
};

declare module "../generated/cairo/surface.js" {
    interface Surface {
        setMimeData(mimeType: string, data: Uint8Array): void;
        getMimeData(mimeType: string): Uint8Array | null;
        supportsMimeType(mimeType: string): boolean;
        mapToImage(extents?: RectangleInt): ImageSurface;
        unmapImage(image: ImageSurface): void;
        getDevice(): Device | null;
    }
}

Surface.prototype.setMimeData = function (mimeType: string, data: Uint8Array): void {
    const buf = alloc(data.length, "mime_data", LIB);
    for (let i = 0; i < data.length; i++) {
        write(buf, { type: "int", size: 8, unsigned: true }, i, data[i]);
    }
    call(
        LIB,
        "cairo_surface_set_mime_data",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: mimeType },
            {
                type: { type: "boxed", innerType: "mime_data", library: LIB, ownership: "borrowed" },
                value: buf,
            },
            { type: ULONG_TYPE, value: data.length },
            { type: { type: "null" }, value: null },
            { type: { type: "null" }, value: null },
        ],
        INT_TYPE,
    );
};

Surface.prototype.getMimeData = function (mimeType: string): Uint8Array | null {
    const dataRef = createRef(null);
    const lengthRef = createRef(0);
    call(
        LIB,
        "cairo_surface_get_mime_data",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: mimeType },
            {
                type: {
                    type: "ref",
                    innerType: { type: "boxed", innerType: "guint8*", library: LIB, ownership: "borrowed" },
                },
                value: dataRef,
            },
            { type: { type: "ref", innerType: ULONG_TYPE }, value: lengthRef },
        ],
        { type: "undefined" },
    );
    const length = lengthRef.value;
    if (length === 0 || dataRef.value === null) return null;
    const result = new Uint8Array(length as number);
    for (let i = 0; i < (length as number); i++) {
        result[i] = read(dataRef.value, { type: "int", size: 8, unsigned: true }, i) as number;
    }
    return result;
};

Surface.prototype.supportsMimeType = function (mimeType: string): boolean {
    return call(
        LIB,
        "cairo_surface_supports_mime_type",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: mimeType },
        ],
        { type: "boolean" },
    ) as boolean;
};

Surface.prototype.mapToImage = function (extents?: RectangleInt): ImageSurface {
    const ptr = extents
        ? call(
              LIB,
              "cairo_surface_map_to_image",
              [
                  { type: SURFACE_T_NONE, value: this.handle },
                  { type: RECT_INT_T, value: extents.handle },
              ],
              SURFACE_T_NONE,
          )
        : call(
              LIB,
              "cairo_surface_map_to_image",
              [
                  { type: SURFACE_T_NONE, value: this.handle },
                  { type: { type: "null" } as const, value: null },
              ],
              SURFACE_T_NONE,
          );
    const surface = Object.create(ImageSurface.prototype) as ImageSurface;
    surface.handle = ptr as NativeHandle;
    return surface;
};

Surface.prototype.unmapImage = function (image: ImageSurface): void {
    call(
        LIB,
        "cairo_surface_unmap_image",
        [
            { type: SURFACE_T_NONE, value: this.handle },
            { type: SURFACE_T_NONE, value: image.handle },
        ],
        { type: "undefined" },
    );
};

Surface.prototype.getDevice = function (): Device | null {
    const ptr = call(
        LIB,
        "cairo_surface_get_device",
        [{ type: SURFACE_T_NONE, value: this.handle }],
        DEVICE_T,
    ) as NativeHandle | null;
    if (ptr === null) return null;
    return getNativeObject(ptr, Device) as Device;
};

export const imageCreateForData = (
    data: Uint8Array,
    format: Format,
    width: number,
    height: number,
    stride: number,
): ImageSurface => {
    const surface = new ImageSurface(format, width, height);
    surface.flush();
    const actualStride = surface.getStride();
    const ptr = call(LIB, "cairo_image_surface_get_data", [{ type: SURFACE_T_NONE, value: surface.handle }], {
        type: "struct",
        innerType: "guint8*",
        ownership: "borrowed",
    });
    const rowBytes = Math.min(stride, actualStride);
    const byteType = { type: "int", size: 8, unsigned: true } as const;
    for (let row = 0; row < height; row++) {
        const srcOffset = row * stride;
        const dstOffset = row * actualStride;
        for (let col = 0; col < rowBytes; col++) {
            if (srcOffset + col < data.length) {
                write(ptr, byteType, dstOffset + col, data[srcOffset + col] as number);
            }
        }
    }
    surface.markDirty();
    return surface;
};
