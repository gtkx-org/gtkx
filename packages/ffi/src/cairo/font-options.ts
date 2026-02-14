import type { NativeHandle } from "@gtkx/native";
import type { Antialias, HintMetrics, HintStyle, Status, SubpixelOrder } from "../generated/cairo/enums.js";
import { FontOptions } from "../generated/cairo/font-options.js";
import { call } from "../native.js";
import { getNativeObject } from "../registry.js";
import { FONT_OPTIONS_T, FONT_OPTIONS_T_FULL, INT_TYPE, LIB } from "./common.js";

declare module "../generated/cairo/font-options.js" {
    interface FontOptions {
        setHintStyle(hintStyle: HintStyle): void;
        getHintStyle(): HintStyle;
        setAntialias(antialias: Antialias): void;
        getAntialias(): Antialias;
        setHintMetrics(hintMetrics: HintMetrics): void;
        getHintMetrics(): HintMetrics;
        setSubpixelOrder(subpixelOrder: SubpixelOrder): void;
        getSubpixelOrder(): SubpixelOrder;
        equal(other: FontOptions): boolean;
        merge(other: FontOptions): void;
        copy(): FontOptions;
    }
}

class FontOptionsImpl extends FontOptions {
    static override readonly glibTypeName: string = "CairoFontOptions";

    constructor() {
        super();
        this.handle = call(LIB, "cairo_font_options_create", [], FONT_OPTIONS_T_FULL) as NativeHandle;
    }
}

export { FontOptionsImpl as FontOptions };

FontOptions.prototype.setHintStyle = function (hintStyle: HintStyle): void {
    call(
        LIB,
        "cairo_font_options_set_hint_style",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: INT_TYPE, value: hintStyle },
        ],
        { type: "undefined" },
    );
};

FontOptions.prototype.getHintStyle = function (): HintStyle {
    return call(
        LIB,
        "cairo_font_options_get_hint_style",
        [{ type: FONT_OPTIONS_T, value: this.handle }],
        INT_TYPE,
    ) as HintStyle;
};

FontOptions.prototype.setAntialias = function (antialias: Antialias): void {
    call(
        LIB,
        "cairo_font_options_set_antialias",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: INT_TYPE, value: antialias },
        ],
        { type: "undefined" },
    );
};

FontOptions.prototype.getAntialias = function (): Antialias {
    return call(
        LIB,
        "cairo_font_options_get_antialias",
        [{ type: FONT_OPTIONS_T, value: this.handle }],
        INT_TYPE,
    ) as Antialias;
};

FontOptions.prototype.setHintMetrics = function (hintMetrics: HintMetrics): void {
    call(
        LIB,
        "cairo_font_options_set_hint_metrics",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: INT_TYPE, value: hintMetrics },
        ],
        { type: "undefined" },
    );
};

FontOptions.prototype.getHintMetrics = function (): HintMetrics {
    return call(
        LIB,
        "cairo_font_options_get_hint_metrics",
        [{ type: FONT_OPTIONS_T, value: this.handle }],
        INT_TYPE,
    ) as HintMetrics;
};

FontOptions.prototype.setSubpixelOrder = function (subpixelOrder: SubpixelOrder): void {
    call(
        LIB,
        "cairo_font_options_set_subpixel_order",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: INT_TYPE, value: subpixelOrder },
        ],
        { type: "undefined" },
    );
};

FontOptions.prototype.getSubpixelOrder = function (): SubpixelOrder {
    return call(
        LIB,
        "cairo_font_options_get_subpixel_order",
        [{ type: FONT_OPTIONS_T, value: this.handle }],
        INT_TYPE,
    ) as SubpixelOrder;
};

FontOptions.prototype.equal = function (other: FontOptions): boolean {
    return call(
        LIB,
        "cairo_font_options_equal",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: FONT_OPTIONS_T, value: other.handle },
        ],
        { type: "boolean" },
    ) as boolean;
};

FontOptions.prototype.merge = function (other: FontOptions): void {
    call(
        LIB,
        "cairo_font_options_merge",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: FONT_OPTIONS_T, value: other.handle },
        ],
        { type: "undefined" },
    );
};

FontOptions.prototype.copy = function (): FontOptions {
    const ptr = call(
        LIB,
        "cairo_font_options_copy",
        [{ type: FONT_OPTIONS_T, value: this.handle }],
        FONT_OPTIONS_T_FULL,
    ) as NativeHandle;
    return getNativeObject(ptr, FontOptions);
};

declare module "../generated/cairo/font-options.js" {
    interface FontOptions {
        status(): Status;
        hash(): number;
        setVariations(variations: string): void;
        getVariations(): string;
    }
}

FontOptions.prototype.status = function (): Status {
    return call(LIB, "cairo_font_options_status", [{ type: FONT_OPTIONS_T, value: this.handle }], INT_TYPE) as Status;
};

FontOptions.prototype.hash = function (): number {
    return call(LIB, "cairo_font_options_hash", [{ type: FONT_OPTIONS_T, value: this.handle }], {
        type: "int",
        size: 64,
        unsigned: true,
    }) as number;
};

FontOptions.prototype.setVariations = function (variations: string): void {
    call(
        LIB,
        "cairo_font_options_set_variations",
        [
            { type: FONT_OPTIONS_T, value: this.handle },
            { type: { type: "string", ownership: "full" }, value: variations },
        ],
        { type: "undefined" },
    );
};

FontOptions.prototype.getVariations = function (): string {
    return call(LIB, "cairo_font_options_get_variations", [{ type: FONT_OPTIONS_T, value: this.handle }], {
        type: "string",
        ownership: "borrowed",
    }) as string;
};
