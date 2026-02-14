import { createRef, type NativeHandle } from "@gtkx/native";
import type { Content } from "../generated/cairo/enums.js";
import { Surface } from "../generated/cairo/surface.js";
import { alloc, call, read, write } from "../native.js";
import { DOUBLE_TYPE, INT_TYPE, LIB, SURFACE_T, SURFACE_T_NONE } from "./common.js";

export class RecordingSurface extends Surface {
    static override readonly glibTypeName: string = "CairoSurface";

    constructor(content: Content, extents?: { x: number; y: number; width: number; height: number }) {
        super();
        if (extents) {
            const rect = alloc(32, "cairo_rectangle_t", LIB);
            write(rect, DOUBLE_TYPE, 0, extents.x);
            write(rect, DOUBLE_TYPE, 8, extents.y);
            write(rect, DOUBLE_TYPE, 16, extents.width);
            write(rect, DOUBLE_TYPE, 24, extents.height);
            this.handle = call(
                LIB,
                "cairo_recording_surface_create",
                [
                    { type: INT_TYPE, value: content },
                    {
                        type: { type: "boxed", innerType: "cairo_rectangle_t", library: LIB, ownership: "borrowed" },
                        value: rect,
                    },
                ],
                SURFACE_T,
            ) as NativeHandle;
        } else {
            this.handle = call(
                LIB,
                "cairo_recording_surface_create",
                [
                    { type: INT_TYPE, value: content },
                    { type: { type: "null" }, value: null },
                ],
                SURFACE_T,
            ) as NativeHandle;
        }
    }

    inkExtents(): { x: number; y: number; width: number; height: number } {
        const xRef = createRef(0.0);
        const yRef = createRef(0.0);
        const wRef = createRef(0.0);
        const hRef = createRef(0.0);
        call(
            LIB,
            "cairo_recording_surface_ink_extents",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: { type: "ref", innerType: DOUBLE_TYPE }, value: xRef },
                { type: { type: "ref", innerType: DOUBLE_TYPE }, value: yRef },
                { type: { type: "ref", innerType: DOUBLE_TYPE }, value: wRef },
                { type: { type: "ref", innerType: DOUBLE_TYPE }, value: hRef },
            ],
            { type: "undefined" },
        );
        return { x: xRef.value, y: yRef.value, width: wRef.value, height: hRef.value };
    }

    getExtents(): { x: number; y: number; width: number; height: number } | null {
        const rect = alloc(32, "cairo_rectangle_t", LIB);
        const result = call(
            LIB,
            "cairo_recording_surface_get_extents",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                {
                    type: { type: "boxed", innerType: "cairo_rectangle_t", library: LIB, ownership: "borrowed" },
                    value: rect,
                },
            ],
            { type: "boolean" },
        ) as boolean;
        if (!result) return null;
        return {
            x: read(rect, DOUBLE_TYPE, 0) as number,
            y: read(rect, DOUBLE_TYPE, 8) as number,
            width: read(rect, DOUBLE_TYPE, 16) as number,
            height: read(rect, DOUBLE_TYPE, 24) as number,
        };
    }
}
