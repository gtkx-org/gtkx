import type { NativeHandle } from "@gtkx/native";
import { Surface } from "../generated/cairo/surface.js";
import { call } from "../native.js";
import { LIB, SURFACE_T, SURFACE_T_NONE } from "./common.js";

export class TeeSurface extends Surface {
    static override readonly glibTypeName: string = "CairoSurface";

    constructor(primary: Surface) {
        super();
        this.handle = call(
            LIB,
            "cairo_tee_surface_create",
            [{ type: SURFACE_T_NONE, value: primary.handle }],
            SURFACE_T,
        ) as NativeHandle;
    }

    add(target: Surface): void {
        call(
            LIB,
            "cairo_tee_surface_add",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: SURFACE_T_NONE, value: target.handle },
            ],
            { type: "undefined" },
        );
    }

    remove(target: Surface): void {
        call(
            LIB,
            "cairo_tee_surface_remove",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: SURFACE_T_NONE, value: target.handle },
            ],
            { type: "undefined" },
        );
    }
}
