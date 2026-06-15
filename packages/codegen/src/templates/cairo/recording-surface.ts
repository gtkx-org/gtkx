import { getHandle, setHandle, t } from "@gtkx/ffi";
import { alloc, type NativeHandle, read, write } from "@gtkx/native";
import type { Content } from "../cairo.js";
import { Surface } from "../cairo.js";

const { bind } = t;
const RECT_T = t.boxed("cairo_rectangle_t", "borrowed", "libcairo.so.2");

const cairo_recording_surface_create_extents = bind(
    "libcairo.so.2",
    "cairo_recording_surface_create",
    [{ type: t.int32 }, { type: RECT_T }],
    t.boxed("CairoSurface", "full", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
const cairo_recording_surface_create_unbounded = bind(
    "libcairo.so.2",
    "cairo_recording_surface_create",
    [{ type: t.int32 }, { type: t.uint64 }],
    t.boxed("CairoSurface", "full", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type"),
);
const cairo_recording_surface_ink_extents = bind(
    "libcairo.so.2",
    "cairo_recording_surface_ink_extents",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
        { type: t.ref(t.float64) },
    ],
    t.void,
);
const cairo_recording_surface_get_extents = bind(
    "libcairo.so.2",
    "cairo_recording_surface_get_extents",
    [
        { type: t.boxed("CairoSurface", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_surface_get_type") },
        { type: RECT_T },
    ],
    t.boolean,
);

/**
 * Cairo recording surface, which captures drawing operations for later replay.
 */
export class RecordingSurface extends Surface {
    /**
     * Allocates a recording surface for the given content type, optionally
     * bounded by `extents`.
     *
     * @param content - The content type captured by the surface
     * @param extents - Optional bounding rectangle in user space; omit for an
     *   unbounded surface
     */
    constructor(content: Content, extents?: { x: number; y: number; width: number; height: number }) {
        super();
        let handle: NativeHandle;
        if (extents) {
            const rect = alloc(32, "cairo_rectangle_t");
            write(rect, t.float64, 0, extents.x);
            write(rect, t.float64, 8, extents.y);
            write(rect, t.float64, 16, extents.width);
            write(rect, t.float64, 24, extents.height);
            handle = cairo_recording_surface_create_extents(content, rect) as NativeHandle;
        } else {
            handle = cairo_recording_surface_create_unbounded(content, 0) as NativeHandle;
        }
        setHandle(this, handle);
    }

    /**
     * Allocates a recording surface for the given content type, optionally
     * bounded by `extents`.
     *
     * @param content - The content type captured by the surface
     * @param extents - Optional bounding rectangle in user space; omit for an
     *   unbounded surface
     */
    static create(
        content: Content,
        extents?: { x: number; y: number; width: number; height: number },
    ): RecordingSurface {
        return new RecordingSurface(content, extents);
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
        const rect = alloc(32, "cairo_rectangle_t");
        const result = cairo_recording_surface_get_extents(getHandle(this), rect) as boolean;
        if (!result) return null;
        return {
            x: read(rect, t.float64, 0) as number,
            y: read(rect, t.float64, 8) as number,
            width: read(rect, t.float64, 16) as number,
            height: read(rect, t.float64, 24) as number,
        };
    }
}
