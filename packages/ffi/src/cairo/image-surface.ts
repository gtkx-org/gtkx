import type { NativeHandle } from "@gtkx/native";
import type { Format } from "../generated/cairo/enums.js";
import { Surface } from "../generated/cairo/surface.js";
import { call, read } from "../native.js";
import { INT_TYPE, LIB, SURFACE_T, SURFACE_T_NONE } from "./common.js";

export class ImageSurface extends Surface {
    static override readonly glibTypeName: string = "CairoSurface";

    constructor(format: Format, width: number, height: number) {
        super();
        this.handle = call(
            LIB,
            "cairo_image_surface_create",
            [
                { type: INT_TYPE, value: format },
                { type: INT_TYPE, value: width },
                { type: INT_TYPE, value: height },
            ],
            SURFACE_T,
        ) as NativeHandle;
    }

    static createFromPng(filename: string): ImageSurface {
        const ptr = call(
            LIB,
            "cairo_image_surface_create_from_png",
            [{ type: { type: "string", ownership: "full" }, value: filename }],
            SURFACE_T,
        ) as NativeHandle;
        const surface = Object.create(ImageSurface.prototype) as ImageSurface;
        surface.handle = ptr;
        return surface;
    }

    static strideForWidth(format: Format, width: number): number {
        return call(
            LIB,
            "cairo_format_stride_for_width",
            [
                { type: INT_TYPE, value: format },
                { type: INT_TYPE, value: width },
            ],
            INT_TYPE,
        ) as number;
    }

    getWidth(): number {
        return call(
            LIB,
            "cairo_image_surface_get_width",
            [{ type: SURFACE_T_NONE, value: this.handle }],
            INT_TYPE,
        ) as number;
    }

    getHeight(): number {
        return call(
            LIB,
            "cairo_image_surface_get_height",
            [{ type: SURFACE_T_NONE, value: this.handle }],
            INT_TYPE,
        ) as number;
    }

    getFormat(): Format {
        return call(
            LIB,
            "cairo_image_surface_get_format",
            [{ type: SURFACE_T_NONE, value: this.handle }],
            INT_TYPE,
        ) as Format;
    }

    getStride(): number {
        return call(
            LIB,
            "cairo_image_surface_get_stride",
            [{ type: SURFACE_T_NONE, value: this.handle }],
            INT_TYPE,
        ) as number;
    }

    getData(): Uint8Array {
        this.flush();
        const stride = this.getStride();
        const height = this.getHeight();
        const totalBytes = stride * height;
        if (totalBytes === 0) return new Uint8Array(0);
        const ptr = call(LIB, "cairo_image_surface_get_data", [{ type: SURFACE_T_NONE, value: this.handle }], {
            type: "struct",
            innerType: "guint8*",
            ownership: "borrowed",
        });
        if (ptr === null) return new Uint8Array(0);
        const result = new Uint8Array(totalBytes);
        for (let i = 0; i < totalBytes; i++) {
            result[i] = read(ptr, { type: "int", size: 8, unsigned: true }, i) as number;
        }
        return result;
    }
}
