import type { NativeHandle } from "@gtkx/native";
import type { Content } from "../generated/cairo/cairo.js";
import { Surface } from "../generated/cairo/cairo.js";
import { getHandle } from "../handles.js";
import { alloc, read, t, write } from "../native.js";
import { wrapHandle } from "../registry.js";
import { DOUBLE_REF, DOUBLE_TYPE, INT_TYPE, LIB, SURFACE_T, SURFACE_T_NONE } from "./common.js";

const { fn } = t;
const RECT_T = t.boxed("cairo_rectangle_t", "borrowed", LIB);

const cairo_recording_surface_create_extents = fn(
    LIB,
    "cairo_recording_surface_create",
    [{ type: INT_TYPE }, { type: RECT_T }],
    SURFACE_T,
);
const cairo_recording_surface_create_unbounded = fn(
    LIB,
    "cairo_recording_surface_create",
    [{ type: INT_TYPE }, { type: t.uint64 }],
    SURFACE_T,
);
const cairo_recording_surface_ink_extents = fn(
    LIB,
    "cairo_recording_surface_ink_extents",
    [{ type: SURFACE_T_NONE }, { type: DOUBLE_REF }, { type: DOUBLE_REF }, { type: DOUBLE_REF }, { type: DOUBLE_REF }],
    t.void,
);
const cairo_recording_surface_get_extents = fn(
    LIB,
    "cairo_recording_surface_get_extents",
    [{ type: SURFACE_T_NONE }, { type: RECT_T }],
    t.boolean,
);

/**
 * Cairo recording surface, which captures drawing operations for later replay.
 */
export class RecordingSurface extends Surface {
    /**
     * Allocates a recording surface for the given content type, optionally
     * bounded by `extents`.
     */
    static create(
        content: Content,
        extents?: { x: number; y: number; width: number; height: number },
    ): RecordingSurface {
        let handle: NativeHandle;
        if (extents) {
            const rect = alloc(32, "cairo_rectangle_t", LIB);
            write(rect, DOUBLE_TYPE, 0, extents.x);
            write(rect, DOUBLE_TYPE, 8, extents.y);
            write(rect, DOUBLE_TYPE, 16, extents.width);
            write(rect, DOUBLE_TYPE, 24, extents.height);
            handle = cairo_recording_surface_create_extents(content, rect) as NativeHandle;
        } else {
            handle = cairo_recording_surface_create_unbounded(content, 0) as NativeHandle;
        }
        return wrapHandle(RecordingSurface, handle);
    }

    /**
     * Measures the extents of the operations recorded into the surface.
     */
    inkExtents(): { x0: number; y0: number; width: number; height: number } {
        const x0Ref = { value: 0 };
        const y0Ref = { value: 0 };
        const widthRef = { value: 0 };
        const heightRef = { value: 0 };
        cairo_recording_surface_ink_extents(getHandle(this), x0Ref, y0Ref, widthRef, heightRef);
        return { x0: x0Ref.value, y0: y0Ref.value, width: widthRef.value, height: heightRef.value };
    }

    /**
     * Returns the bounding rectangle the surface was created with, or `null`
     * when the surface is unbounded.
     */
    getExtents(): { x: number; y: number; width: number; height: number } | null {
        const rect = alloc(32, "cairo_rectangle_t", LIB);
        const result = cairo_recording_surface_get_extents(getHandle(this), rect) as boolean;
        if (!result) return null;
        return {
            x: read(rect, DOUBLE_TYPE, 0) as number,
            y: read(rect, DOUBLE_TYPE, 8) as number,
            width: read(rect, DOUBLE_TYPE, 16) as number,
            height: read(rect, DOUBLE_TYPE, 24) as number,
        };
    }
}
