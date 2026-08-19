import { type ExternalObject, getHandle, type Handle, setHandle, t } from "@gtkx/runtime";
import type { Antialias, HintMetrics, HintStyle, Status, SubpixelOrder } from "../enums.js";
import { FontOptions } from "../base.js";

const { bind } = t;
const FONT_OPTIONS_T = t.boxed("CairoFontOptions", {
    ownership: "borrowed",
    sharedLibrary: "libcairo-gobject.so.2",
    getTypeFnName: "cairo_gobject_font_options_get_type",
});

declare module "../base.js" {
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

const cairoFontOptionsCreate = bind(
    "libcairo.so.2",
    "cairo_font_options_create",
    [],
    t.boxed("CairoFontOptions", {
        ownership: "full",
        sharedLibrary: "libcairo-gobject.so.2",
        getTypeFnName: "cairo_gobject_font_options_get_type",
    }),
);
const cairoFontOptionsCopy = bind(
    "libcairo.so.2",
    "cairo_font_options_copy",
    [FONT_OPTIONS_T],
    t.boxed("CairoFontOptions", {
        ownership: "full",
        sharedLibrary: "libcairo-gobject.so.2",
        getTypeFnName: "cairo_gobject_font_options_get_type",
    }),
);

class FontOptionsImpl extends FontOptions {
    constructor(other?: FontOptions) {
        super();
        const handle = other === undefined ? cairoFontOptionsCreate() : cairoFontOptionsCopy(getHandle(other));
        setHandle(this, handle as ExternalObject<Handle>);
    }

    static create(): FontOptionsImpl {
        return new FontOptionsImpl();
    }
}

export { FontOptionsImpl as FontOptions };

const cairoFontOptionsSetHintStyle = bind(
    "libcairo.so.2",
    "cairo_font_options_set_hint_style",
    [FONT_OPTIONS_T, t.int32],
    t.void,
);
FontOptions.prototype.setHintStyle = function (hintStyle: HintStyle): void {
    cairoFontOptionsSetHintStyle(getHandle(this), hintStyle);
};

const cairoFontOptionsGetHintStyle = bind(
    "libcairo.so.2",
    "cairo_font_options_get_hint_style",
    [FONT_OPTIONS_T],
    t.int32,
);
FontOptions.prototype.getHintStyle = function (): HintStyle {
    return cairoFontOptionsGetHintStyle(getHandle(this)) as HintStyle;
};

const cairoFontOptionsSetAntialias = bind(
    "libcairo.so.2",
    "cairo_font_options_set_antialias",
    [FONT_OPTIONS_T, t.int32],
    t.void,
);
FontOptions.prototype.setAntialias = function (antialias: Antialias): void {
    cairoFontOptionsSetAntialias(getHandle(this), antialias);
};

const cairoFontOptionsGetAntialias = bind(
    "libcairo.so.2",
    "cairo_font_options_get_antialias",
    [FONT_OPTIONS_T],
    t.int32,
);
FontOptions.prototype.getAntialias = function (): Antialias {
    return cairoFontOptionsGetAntialias(getHandle(this)) as Antialias;
};

const cairoFontOptionsSetHintMetrics = bind(
    "libcairo.so.2",
    "cairo_font_options_set_hint_metrics",
    [FONT_OPTIONS_T, t.int32],
    t.void,
);
FontOptions.prototype.setHintMetrics = function (hintMetrics: HintMetrics): void {
    cairoFontOptionsSetHintMetrics(getHandle(this), hintMetrics);
};

const cairoFontOptionsGetHintMetrics = bind(
    "libcairo.so.2",
    "cairo_font_options_get_hint_metrics",
    [FONT_OPTIONS_T],
    t.int32,
);
FontOptions.prototype.getHintMetrics = function (): HintMetrics {
    return cairoFontOptionsGetHintMetrics(getHandle(this)) as HintMetrics;
};

const cairoFontOptionsSetSubpixelOrder = bind(
    "libcairo.so.2",
    "cairo_font_options_set_subpixel_order",
    [FONT_OPTIONS_T, t.int32],
    t.void,
);
FontOptions.prototype.setSubpixelOrder = function (subpixelOrder: SubpixelOrder): void {
    cairoFontOptionsSetSubpixelOrder(getHandle(this), subpixelOrder);
};

const cairoFontOptionsGetSubpixelOrder = bind(
    "libcairo.so.2",
    "cairo_font_options_get_subpixel_order",
    [FONT_OPTIONS_T],
    t.int32,
);
FontOptions.prototype.getSubpixelOrder = function (): SubpixelOrder {
    return cairoFontOptionsGetSubpixelOrder(getHandle(this)) as SubpixelOrder;
};

const cairoFontOptionsEqual = bind(
    "libcairo.so.2",
    "cairo_font_options_equal",
    [FONT_OPTIONS_T, FONT_OPTIONS_T],
    t.boolean,
);
FontOptions.prototype.equal = function (other: FontOptions): boolean {
    return cairoFontOptionsEqual(getHandle(this), getHandle(other)) as boolean;
};

const cairoFontOptionsMerge = bind(
    "libcairo.so.2",
    "cairo_font_options_merge",
    [FONT_OPTIONS_T, FONT_OPTIONS_T],
    t.void,
);
FontOptions.prototype.merge = function (other: FontOptions): void {
    cairoFontOptionsMerge(getHandle(this), getHandle(other));
};

declare module "../base.js" {
    interface FontOptions {
        status(): Status;
        hash(): number;
        setVariations(variations: string): void;
        getVariations(): string;
    }
}

const cairoFontOptionsStatus = bind("libcairo.so.2", "cairo_font_options_status", [FONT_OPTIONS_T], t.int32);
FontOptions.prototype.status = function (): Status {
    return cairoFontOptionsStatus(getHandle(this)) as Status;
};

const cairoFontOptionsHash = bind("libcairo.so.2", "cairo_font_options_hash", [FONT_OPTIONS_T], t.uint64);
FontOptions.prototype.hash = function (): number {
    return cairoFontOptionsHash(getHandle(this)) as number;
};

const cairoFontOptionsSetVariations = bind(
    "libcairo.so.2",
    "cairo_font_options_set_variations",
    [FONT_OPTIONS_T, t.string("full")],
    t.void,
);
FontOptions.prototype.setVariations = function (variations: string): void {
    cairoFontOptionsSetVariations(getHandle(this), variations);
};

const cairoFontOptionsGetVariations = bind(
    "libcairo.so.2",
    "cairo_font_options_get_variations",
    [FONT_OPTIONS_T],
    t.string("borrowed"),
);
FontOptions.prototype.getVariations = function (): string {
    return cairoFontOptionsGetVariations(getHandle(this)) as string;
};
