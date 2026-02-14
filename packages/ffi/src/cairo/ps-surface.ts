import type { NativeHandle } from "@gtkx/native";
import { Surface } from "../generated/cairo/surface.js";
import { call } from "../native.js";
import { DOUBLE_TYPE, INT_TYPE, LIB, SURFACE_T, SURFACE_T_NONE } from "./common.js";
import { enumToString, getEnumList } from "./enum-helpers.js";

export enum PsLevel {
    LEVEL_2 = 0,
    LEVEL_3 = 1,
}

export class PsSurface extends Surface {
    static override readonly glibTypeName: string = "CairoSurface";

    constructor(filename: string, widthInPoints: number, heightInPoints: number) {
        super();
        this.handle = call(
            LIB,
            "cairo_ps_surface_create",
            [
                { type: { type: "string", ownership: "full" }, value: filename },
                { type: DOUBLE_TYPE, value: widthInPoints },
                { type: DOUBLE_TYPE, value: heightInPoints },
            ],
            SURFACE_T,
        ) as NativeHandle;
    }

    setSize(widthInPoints: number, heightInPoints: number): void {
        call(
            LIB,
            "cairo_ps_surface_set_size",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: DOUBLE_TYPE, value: widthInPoints },
                { type: DOUBLE_TYPE, value: heightInPoints },
            ],
            { type: "undefined" },
        );
    }

    setEps(eps: boolean): void {
        call(
            LIB,
            "cairo_ps_surface_set_eps",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: { type: "boolean" }, value: eps },
            ],
            { type: "undefined" },
        );
    }

    getEps(): boolean {
        return call(LIB, "cairo_ps_surface_get_eps", [{ type: SURFACE_T_NONE, value: this.handle }], {
            type: "boolean",
        }) as boolean;
    }

    restrictToLevel(level: PsLevel): void {
        call(
            LIB,
            "cairo_ps_surface_restrict_to_level",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: INT_TYPE, value: level },
            ],
            { type: "undefined" },
        );
    }

    dscComment(comment: string): void {
        call(
            LIB,
            "cairo_ps_surface_dsc_comment",
            [
                { type: SURFACE_T_NONE, value: this.handle },
                { type: { type: "string", ownership: "full" }, value: comment },
            ],
            { type: "undefined" },
        );
    }

    dscBeginSetup(): void {
        call(LIB, "cairo_ps_surface_dsc_begin_setup", [{ type: SURFACE_T_NONE, value: this.handle }], {
            type: "undefined",
        });
    }

    dscBeginPageSetup(): void {
        call(LIB, "cairo_ps_surface_dsc_begin_page_setup", [{ type: SURFACE_T_NONE, value: this.handle }], {
            type: "undefined",
        });
    }

    static getLevels(): PsLevel[] {
        return getEnumList<PsLevel>("cairo_ps_get_levels");
    }

    static levelToString(level: PsLevel): string {
        return enumToString("cairo_ps_level_to_string", level);
    }
}
