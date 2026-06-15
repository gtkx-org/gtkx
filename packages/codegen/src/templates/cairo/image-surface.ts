import { getHandle, setHandle, t, wrapHandle } from "@gtkx/ffi";
import { call, type NativeHandle, read } from "@gtkx/native";
import type { Format } from "../cairo.js";
import { Surface } from "../cairo.js";

const { bind } = t;

const cairo_image_surface_create = bind(
    "libcairo.so.2",
    "cairo_image_surface_create",
    [{ type: t.int32 }, { type: t.int32 }, { type: t.int32 }],
    t.boxed("CairoSurface", "full", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
const cairo_image_surface_create_from_png = bind(
    "libcairo.so.2",
    "cairo_image_surface_create_from_png",
    [{ type: t.string("full") }],
    t.boxed("CairoSurface", "full", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
const cairo_image_surface_get_width = bind(
    "libcairo.so.2",
    "cairo_image_surface_get_width",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
const cairo_image_surface_get_height = bind(
    "libcairo.so.2",
    "cairo_image_surface_get_height",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
const cairo_image_surface_get_format = bind(
    "libcairo.so.2",
    "cairo_image_surface_get_format",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);
const cairo_image_surface_get_stride = bind(
    "libcairo.so.2",
    "cairo_image_surface_get_stride",
    [{ type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") }],
    t.int32,
);

export class ImageSurface extends Surface {
    /**
     * Allocates an image surface of the given pixel `format` and dimensions.
     *
     * @param format - The pixel format of the surface
     * @param width - Width of the surface in pixels
     * @param height - Height of the surface in pixels
     */
    constructor(format: Format, width: number, height: number) {
        super();
        setHandle(this, cairo_image_surface_create(format, width, height) as NativeHandle);
    }

    static create(format: Format, width: number, height: number): ImageSurface {
        return wrapHandle(cairo_image_surface_create(format, width, height) as NativeHandle, ImageSurface);
    }

    static createFromPng(filename: string): ImageSurface {
        const ptr = cairo_image_surface_create_from_png(filename) as NativeHandle;
        const surface = Object.create(ImageSurface.prototype) as ImageSurface;
        setHandle(surface, ptr);
        return surface;
    }

    getWidth(): number {
        return cairo_image_surface_get_width(getHandle(this)) as number;
    }

    getHeight(): number {
        return cairo_image_surface_get_height(getHandle(this)) as number;
    }

    getFormat(): Format {
        return cairo_image_surface_get_format(getHandle(this)) as Format;
    }

    getStride(): number {
        return cairo_image_surface_get_stride(getHandle(this)) as number;
    }

    getData(): Uint8Array {
        this.flush();
        const stride = this.getStride();
        const height = this.getHeight();
        const totalBytes = stride * height;
        if (totalBytes === 0) return new Uint8Array(0);
        const ptr = call(
            "libcairo.so.2",
            "cairo_image_surface_get_data",
            [
                {
                    type: t.boxed(
                        "CairoSurface",
                        "borrowed",
                        "libcairo-gobject.so.2",
                        "cairo_gobject_surface_get_type",
                    ),
                    value: getHandle(this),
                },
            ],
            t.struct("borrowed", totalBytes),
        ) as NativeHandle | null;
        if (ptr === null) return new Uint8Array(0);
        const result = new Uint8Array(totalBytes);
        for (let i = 0; i < totalBytes; i++) {
            result[i] = read(ptr, t.uint8, i) as number;
        }
        return result;
    }
}
