import { getHandle, t, wrapHandle } from "@gtkx/ffi";
import type { NativeHandle } from "@gtkx/ffi/cairo";
import { FONT_OPTIONS_T, FONT_OPTIONS_T_FULL, INT_TYPE, LIB, STRING_BORROWED, STRING_FULL } from "@gtkx/ffi/cairo";
import type { Antialias, HintMetrics, HintStyle, Status, SubpixelOrder } from "@gtkx/gi/cairo/cairo.js";
import { FontOptions } from "@gtkx/gi/cairo/cairo.js";

const { fn } = t;

declare module "@gtkx/gi/cairo/cairo.js" {
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
    }
}

const cairo_font_options_create = fn(LIB, "cairo_font_options_create", [], FONT_OPTIONS_T_FULL);

class FontOptionsImpl extends FontOptions {
    static create(): FontOptionsImpl {
        return wrapHandle(FontOptionsImpl, cairo_font_options_create() as NativeHandle);
    }
}

export { FontOptionsImpl as FontOptions };

const cairo_font_options_set_hint_style = fn(
    LIB,
    "cairo_font_options_set_hint_style",
    [{ type: FONT_OPTIONS_T }, { type: INT_TYPE }],
    t.void,
);
FontOptions.prototype.setHintStyle = function (hintStyle: HintStyle): void {
    cairo_font_options_set_hint_style(getHandle(this), hintStyle);
};

const cairo_font_options_get_hint_style = fn(
    LIB,
    "cairo_font_options_get_hint_style",
    [{ type: FONT_OPTIONS_T }],
    INT_TYPE,
);
FontOptions.prototype.getHintStyle = function (): HintStyle {
    return cairo_font_options_get_hint_style(getHandle(this)) as HintStyle;
};

const cairo_font_options_set_antialias = fn(
    LIB,
    "cairo_font_options_set_antialias",
    [{ type: FONT_OPTIONS_T }, { type: INT_TYPE }],
    t.void,
);
FontOptions.prototype.setAntialias = function (antialias: Antialias): void {
    cairo_font_options_set_antialias(getHandle(this), antialias);
};

const cairo_font_options_get_antialias = fn(
    LIB,
    "cairo_font_options_get_antialias",
    [{ type: FONT_OPTIONS_T }],
    INT_TYPE,
);
FontOptions.prototype.getAntialias = function (): Antialias {
    return cairo_font_options_get_antialias(getHandle(this)) as Antialias;
};

const cairo_font_options_set_hint_metrics = fn(
    LIB,
    "cairo_font_options_set_hint_metrics",
    [{ type: FONT_OPTIONS_T }, { type: INT_TYPE }],
    t.void,
);
FontOptions.prototype.setHintMetrics = function (hintMetrics: HintMetrics): void {
    cairo_font_options_set_hint_metrics(getHandle(this), hintMetrics);
};

const cairo_font_options_get_hint_metrics = fn(
    LIB,
    "cairo_font_options_get_hint_metrics",
    [{ type: FONT_OPTIONS_T }],
    INT_TYPE,
);
FontOptions.prototype.getHintMetrics = function (): HintMetrics {
    return cairo_font_options_get_hint_metrics(getHandle(this)) as HintMetrics;
};

const cairo_font_options_set_subpixel_order = fn(
    LIB,
    "cairo_font_options_set_subpixel_order",
    [{ type: FONT_OPTIONS_T }, { type: INT_TYPE }],
    t.void,
);
FontOptions.prototype.setSubpixelOrder = function (subpixelOrder: SubpixelOrder): void {
    cairo_font_options_set_subpixel_order(getHandle(this), subpixelOrder);
};

const cairo_font_options_get_subpixel_order = fn(
    LIB,
    "cairo_font_options_get_subpixel_order",
    [{ type: FONT_OPTIONS_T }],
    INT_TYPE,
);
FontOptions.prototype.getSubpixelOrder = function (): SubpixelOrder {
    return cairo_font_options_get_subpixel_order(getHandle(this)) as SubpixelOrder;
};

const cairo_font_options_equal = fn(
    LIB,
    "cairo_font_options_equal",
    [{ type: FONT_OPTIONS_T }, { type: FONT_OPTIONS_T }],
    t.boolean,
);
FontOptions.prototype.equal = function (other: FontOptions): boolean {
    return cairo_font_options_equal(getHandle(this), getHandle(other)) as boolean;
};

const cairo_font_options_merge = fn(
    LIB,
    "cairo_font_options_merge",
    [{ type: FONT_OPTIONS_T }, { type: FONT_OPTIONS_T }],
    t.void,
);
FontOptions.prototype.merge = function (other: FontOptions): void {
    cairo_font_options_merge(getHandle(this), getHandle(other));
};

declare module "@gtkx/gi/cairo/cairo.js" {
    interface FontOptions {
        status(): Status;
        hash(): number;
        setVariations(variations: string): void;
        getVariations(): string;
    }
}

const cairo_font_options_status = fn(LIB, "cairo_font_options_status", [{ type: FONT_OPTIONS_T }], INT_TYPE);
FontOptions.prototype.status = function (): Status {
    return cairo_font_options_status(getHandle(this)) as Status;
};

const cairo_font_options_hash = fn(LIB, "cairo_font_options_hash", [{ type: FONT_OPTIONS_T }], t.uint64);
FontOptions.prototype.hash = function (): number {
    return cairo_font_options_hash(getHandle(this)) as number;
};

const cairo_font_options_set_variations = fn(
    LIB,
    "cairo_font_options_set_variations",
    [{ type: FONT_OPTIONS_T }, { type: STRING_FULL }],
    t.void,
);
FontOptions.prototype.setVariations = function (variations: string): void {
    cairo_font_options_set_variations(getHandle(this), variations);
};

const cairo_font_options_get_variations = fn(
    LIB,
    "cairo_font_options_get_variations",
    [{ type: FONT_OPTIONS_T }],
    STRING_BORROWED,
);
FontOptions.prototype.getVariations = function (): string {
    return cairo_font_options_get_variations(getHandle(this)) as string;
};
