import { getHandle, setHandle, t, wrapHandle } from "@gtkx/ffi";
import { call, type Handle, read } from "@gtkx/native";
import type { Format } from "../cairo.js";
import { Surface } from "../cairo.js";

const { bind } = t;

const cairoImageSurfaceCreate = bind(
    "libcairo.so.2",
    "cairo_image_surface_create",
    [t.int32, t.int32, t.int32],
    t.boxed("CairoSurface", {
        ownership: "full",
        library: "libcairo-gobject.so.2",
        getTypeFn: "cairo_gobject_surface_get_type",
    }),
);
const cairoImageSurfaceCreateFromPng = bind(
    "libcairo.so.2",
    "cairo_image_surface_create_from_png",
    [t.string("full")],
    t.boxed("CairoSurface", {
        ownership: "full",
        library: "libcairo-gobject.so.2",
        getTypeFn: "cairo_gobject_surface_get_type",
    }),
);
const cairoImageSurfaceGetWidth = bind(
    "libcairo.so.2",
    "cairo_image_surface_get_width",
    [
        t.boxed("CairoSurface", {
            ownership: "borrowed",
            library: "libcairo-gobject.so.2",
            getTypeFn: "cairo_gobject_surface_get_type",
        }),
    ],
    t.int32,
);
const cairoImageSurfaceGetHeight = bind(
    "libcairo.so.2",
    "cairo_image_surface_get_height",
    [
        t.boxed("CairoSurface", {
            ownership: "borrowed",
            library: "libcairo-gobject.so.2",
            getTypeFn: "cairo_gobject_surface_get_type",
        }),
    ],
    t.int32,
);
const cairoImageSurfaceGetFormat = bind(
    "libcairo.so.2",
    "cairo_image_surface_get_format",
    [
        t.boxed("CairoSurface", {
            ownership: "borrowed",
            library: "libcairo-gobject.so.2",
            getTypeFn: "cairo_gobject_surface_get_type",
        }),
    ],
    t.int32,
);
const cairoImageSurfaceGetStride = bind(
    "libcairo.so.2",
    "cairo_image_surface_get_stride",
    [
        t.boxed("CairoSurface", {
            ownership: "borrowed",
            library: "libcairo-gobject.so.2",
            getTypeFn: "cairo_gobject_surface_get_type",
        }),
    ],
    t.int32,
);

export class ImageSurface extends Surface {
    constructor(format: Format, width: number, height: number) {
        super();
        setHandle(this, cairoImageSurfaceCreate(format, width, height) as Handle);
    }

    static create(format: Format, width: number, height: number): ImageSurface {
        return wrapHandle(cairoImageSurfaceCreate(format, width, height) as Handle, ImageSurface);
    }

    static createFromPng(filename: string): ImageSurface {
        return wrapHandle(cairoImageSurfaceCreateFromPng(filename) as Handle, ImageSurface);
    }

    getWidth(): number {
        return cairoImageSurfaceGetWidth(getHandle(this)) as number;
    }

    getHeight(): number {
        return cairoImageSurfaceGetHeight(getHandle(this)) as number;
    }

    getFormat(): Format {
        return cairoImageSurfaceGetFormat(getHandle(this)) as Format;
    }

    getStride(): number {
        return cairoImageSurfaceGetStride(getHandle(this)) as number;
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
                    type: t.boxed("CairoSurface", {
                        ownership: "borrowed",
                        library: "libcairo-gobject.so.2",
                        getTypeFn: "cairo_gobject_surface_get_type",
                    }),
                    value: getHandle(this),
                },
            ],
            t.struct("borrowed", { size: totalBytes }),
        ) as Handle | null;
        if (ptr === null) return new Uint8Array(0);
        const result = new Uint8Array(totalBytes);
        for (let i = 0; i < totalBytes; i++) {
            result[i] = read(ptr, t.uint8, i) as number;
        }
        return result;
    }
}
