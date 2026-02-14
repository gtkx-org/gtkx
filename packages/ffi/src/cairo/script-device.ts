import type { NativeHandle } from "@gtkx/native";
import { Device } from "../generated/cairo/device.js";
import type { Content } from "../generated/cairo/enums.js";
import { Surface } from "../generated/cairo/surface.js";
import { call } from "../native.js";
import { getNativeObject } from "../registry.js";
import { DEVICE_T, DEVICE_T_FULL, DOUBLE_TYPE, INT_TYPE, LIB, SURFACE_T, SURFACE_T_NONE } from "./common.js";

export enum ScriptMode {
    ASCII = 0,
    BINARY = 1,
}

export class ScriptDevice extends Device {
    constructor(filename: string) {
        super();
        this.handle = call(
            LIB,
            "cairo_script_create",
            [{ type: { type: "string", ownership: "full" }, value: filename }],
            DEVICE_T_FULL,
        ) as NativeHandle;
    }

    setMode(mode: ScriptMode): void {
        call(
            LIB,
            "cairo_script_set_mode",
            [
                { type: DEVICE_T, value: this.handle },
                { type: INT_TYPE, value: mode },
            ],
            { type: "undefined" },
        );
    }

    getMode(): ScriptMode {
        return call(LIB, "cairo_script_get_mode", [{ type: DEVICE_T, value: this.handle }], INT_TYPE) as ScriptMode;
    }

    writeComment(comment: string): void {
        const encoder = new TextEncoder();
        const utf8 = encoder.encode(comment);
        call(
            LIB,
            "cairo_script_write_comment",
            [
                { type: DEVICE_T, value: this.handle },
                { type: { type: "string", ownership: "full" }, value: comment },
                { type: INT_TYPE, value: utf8.length },
            ],
            { type: "undefined" },
        );
    }

    createScriptSurface(content: Content, width: number, height: number): Surface {
        const ptr = call(
            LIB,
            "cairo_script_surface_create",
            [
                { type: DEVICE_T, value: this.handle },
                { type: INT_TYPE, value: content },
                { type: DOUBLE_TYPE, value: width },
                { type: DOUBLE_TYPE, value: height },
            ],
            SURFACE_T,
        ) as NativeHandle;
        return getNativeObject(ptr, Surface) as Surface;
    }

    createScriptSurfaceForTarget(target: Surface): Surface {
        const ptr = call(
            LIB,
            "cairo_script_surface_create_for_target",
            [
                { type: DEVICE_T, value: this.handle },
                { type: SURFACE_T_NONE, value: target.handle },
            ],
            SURFACE_T,
        ) as NativeHandle;
        return getNativeObject(ptr, Surface) as Surface;
    }
}
