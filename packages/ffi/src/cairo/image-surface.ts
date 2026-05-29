import type { NativeHandle } from "@gtkx/native";
import type { Format } from "../generated/cairo/cairo.js";
import { Surface } from "../generated/cairo/cairo.js";
import { getHandle, setHandle } from "../handles.js";
import { call, read, t } from "../native.js";
import { wrapHandle } from "../registry.js";
import { INT_TYPE, LIB, STRING_FULL, SURFACE_T, SURFACE_T_NONE } from "./common.js";

const { fn } = t;

const cairo_image_surface_create = fn(
    LIB,
    "cairo_image_surface_create",
    [{ type: INT_TYPE }, { type: INT_TYPE }, { type: INT_TYPE }],
    SURFACE_T,
);
const cairo_image_surface_create_from_png = fn(
    LIB,
    "cairo_image_surface_create_from_png",
    [{ type: STRING_FULL }],
    SURFACE_T,
);
const cairo_image_surface_get_width = fn(LIB, "cairo_image_surface_get_width", [{ type: SURFACE_T_NONE }], INT_TYPE);
const cairo_image_surface_get_height = fn(LIB, "cairo_image_surface_get_height", [{ type: SURFACE_T_NONE }], INT_TYPE);
const cairo_image_surface_get_format = fn(LIB, "cairo_image_surface_get_format", [{ type: SURFACE_T_NONE }], INT_TYPE);
const cairo_image_surface_get_stride = fn(LIB, "cairo_image_surface_get_stride", [{ type: SURFACE_T_NONE }], INT_TYPE);

export class ImageSurface extends Surface {
    static create(format: Format, width: number, height: number): ImageSurface {
        return wrapHandle(ImageSurface, cairo_image_surface_create(format, width, height) as NativeHandle);
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
            LIB,
            "cairo_image_surface_get_data",
            [{ type: SURFACE_T_NONE, value: getHandle(this) }],
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
