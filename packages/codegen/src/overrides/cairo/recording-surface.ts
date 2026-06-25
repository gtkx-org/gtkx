import { getHandle, setHandle, t } from "@gtkx/ffi";
import { alloc, type Handle, read, write } from "@gtkx/native";
import type { Content } from "../cairo.js";
import { Surface } from "../cairo.js";

const { bind } = t;
const RECT_T = t.boxed("cairo_rectangle_t", { ownership: "borrowed", library: "libcairo.so.2" });

const cairoRecordingSurfaceCreateExtents = bind(
    "libcairo.so.2",
    "cairo_recording_surface_create",
    [t.int32, RECT_T],
    t.boxed("CairoSurface", {
        ownership: "full",
        library: "libcairo-gobject.so.2",
        getTypeFn: "cairo_gobject_surface_get_type",
    }),
);
const cairoRecordingSurfaceCreateUnbounded = bind(
    "libcairo.so.2",
    "cairo_recording_surface_create",
    [t.int32, t.uint64],
    t.boxed("CairoSurface", {
        ownership: "full",
        library: "libcairo-gobject.so.2",
        getTypeFn: "cairo_gobject_surface_get_type",
    }),
);
const cairoRecordingSurfaceInkExtents = bind(
    "libcairo.so.2",
    "cairo_recording_surface_ink_extents",
    [
        t.boxed("CairoSurface", {
            ownership: "borrowed",
            library: "libcairo-gobject.so.2",
            getTypeFn: "cairo_gobject_surface_get_type",
        }),
        t.ref(t.float64),
        t.ref(t.float64),
        t.ref(t.float64),
        t.ref(t.float64),
    ],
    t.void,
);
const cairoRecordingSurfaceGetExtents = bind(
    "libcairo.so.2",
    "cairo_recording_surface_get_extents",
    [
        t.boxed("CairoSurface", {
            ownership: "borrowed",
            library: "libcairo-gobject.so.2",
            getTypeFn: "cairo_gobject_surface_get_type",
        }),
        RECT_T,
    ],
    t.boolean,
);

export class RecordingSurface extends Surface {
    constructor(content: Content, extents?: { x: number; y: number; width: number; height: number }) {
        super();
        let handle: Handle;
        if (extents) {
            const rect = alloc(32, "cairo_rectangle_t");
            write(rect, t.float64, 0, extents.x);
            write(rect, t.float64, 8, extents.y);
            write(rect, t.float64, 16, extents.width);
            write(rect, t.float64, 24, extents.height);
            handle = cairoRecordingSurfaceCreateExtents(content, rect) as Handle;
        } else {
            handle = cairoRecordingSurfaceCreateUnbounded(content, 0) as Handle;
        }
        setHandle(this, handle);
    }

    static create(
        content: Content,
        extents?: { x: number; y: number; width: number; height: number },
    ): RecordingSurface {
        return new RecordingSurface(content, extents);
    }

    inkExtents(): { x0: number; y0: number; width: number; height: number } {
        const x0Ref = { value: 0 };
        const y0Ref = { value: 0 };
        const widthRef = { value: 0 };
        const heightRef = { value: 0 };
        cairoRecordingSurfaceInkExtents(getHandle(this), x0Ref, y0Ref, widthRef, heightRef);
        return { x0: x0Ref.value, y0: y0Ref.value, width: widthRef.value, height: heightRef.value };
    }

    getExtents(): { x: number; y: number; width: number; height: number } | null {
        const rect = alloc(32, "cairo_rectangle_t");
        const result = cairoRecordingSurfaceGetExtents(getHandle(this), rect) as boolean;
        if (!result) return null;
        return {
            x: read(rect, t.float64, 0) as number,
            y: read(rect, t.float64, 8) as number,
            width: read(rect, t.float64, 16) as number,
            height: read(rect, t.float64, 24) as number,
        };
    }
}
