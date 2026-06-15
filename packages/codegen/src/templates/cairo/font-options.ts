import { getHandle, setHandle, t } from "@gtkx/ffi";
import type { NativeHandle } from "@gtkx/native";
import type { Antialias, HintMetrics, HintStyle, Status, SubpixelOrder } from "../cairo.js";
import { FontOptions } from "../cairo.js";

const { bind } = t;

declare module "../cairo.js" {
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

const cairo_font_options_create = bind(
    "libcairo.so.2",
    "cairo_font_options_create",
    [],
    t.boxed("CairoFontOptions", "full", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type"),
);
const cairo_font_options_copy = bind(
    "libcairo.so.2",
    "cairo_font_options_copy",
    [{ type: t.boxed("CairoFontOptions", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type") }],
    t.boxed("CairoFontOptions", "full", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type"),
);

class FontOptionsImpl extends FontOptions {
    /**
     * Allocates a font options object. With no argument, a fresh default-valued
     * object is created; passing `other` produces an independent copy of it.
     *
     * @param other - Optional font options to copy
     */
    constructor(other?: FontOptions) {
        super();
        const handle = other === undefined ? cairo_font_options_create() : cairo_font_options_copy(getHandle(other));
        setHandle(this, handle as NativeHandle);
    }

    static create(): FontOptionsImpl {
        return new FontOptionsImpl();
    }
}

export { FontOptionsImpl as FontOptions };

const cairo_font_options_set_hint_style = bind(
    "libcairo.so.2",
    "cairo_font_options_set_hint_style",
    [
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
        { type: t.int32 },
    ],
    t.void,
);
FontOptions.prototype.setHintStyle = function (hintStyle: HintStyle): void {
    cairo_font_options_set_hint_style(getHandle(this), hintStyle);
};

const cairo_font_options_get_hint_style = bind(
    "libcairo.so.2",
    "cairo_font_options_get_hint_style",
    [{ type: t.boxed("CairoFontOptions", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type") }],
    t.int32,
);
FontOptions.prototype.getHintStyle = function (): HintStyle {
    return cairo_font_options_get_hint_style(getHandle(this)) as HintStyle;
};

const cairo_font_options_set_antialias = bind(
    "libcairo.so.2",
    "cairo_font_options_set_antialias",
    [
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
        { type: t.int32 },
    ],
    t.void,
);
FontOptions.prototype.setAntialias = function (antialias: Antialias): void {
    cairo_font_options_set_antialias(getHandle(this), antialias);
};

const cairo_font_options_get_antialias = bind(
    "libcairo.so.2",
    "cairo_font_options_get_antialias",
    [{ type: t.boxed("CairoFontOptions", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type") }],
    t.int32,
);
FontOptions.prototype.getAntialias = function (): Antialias {
    return cairo_font_options_get_antialias(getHandle(this)) as Antialias;
};

const cairo_font_options_set_hint_metrics = bind(
    "libcairo.so.2",
    "cairo_font_options_set_hint_metrics",
    [
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
        { type: t.int32 },
    ],
    t.void,
);
FontOptions.prototype.setHintMetrics = function (hintMetrics: HintMetrics): void {
    cairo_font_options_set_hint_metrics(getHandle(this), hintMetrics);
};

const cairo_font_options_get_hint_metrics = bind(
    "libcairo.so.2",
    "cairo_font_options_get_hint_metrics",
    [{ type: t.boxed("CairoFontOptions", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type") }],
    t.int32,
);
FontOptions.prototype.getHintMetrics = function (): HintMetrics {
    return cairo_font_options_get_hint_metrics(getHandle(this)) as HintMetrics;
};

const cairo_font_options_set_subpixel_order = bind(
    "libcairo.so.2",
    "cairo_font_options_set_subpixel_order",
    [
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
        { type: t.int32 },
    ],
    t.void,
);
FontOptions.prototype.setSubpixelOrder = function (subpixelOrder: SubpixelOrder): void {
    cairo_font_options_set_subpixel_order(getHandle(this), subpixelOrder);
};

const cairo_font_options_get_subpixel_order = bind(
    "libcairo.so.2",
    "cairo_font_options_get_subpixel_order",
    [{ type: t.boxed("CairoFontOptions", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type") }],
    t.int32,
);
FontOptions.prototype.getSubpixelOrder = function (): SubpixelOrder {
    return cairo_font_options_get_subpixel_order(getHandle(this)) as SubpixelOrder;
};

const cairo_font_options_equal = bind(
    "libcairo.so.2",
    "cairo_font_options_equal",
    [
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
    ],
    t.boolean,
);
FontOptions.prototype.equal = function (other: FontOptions): boolean {
    return cairo_font_options_equal(getHandle(this), getHandle(other)) as boolean;
};

const cairo_font_options_merge = bind(
    "libcairo.so.2",
    "cairo_font_options_merge",
    [
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
    ],
    t.void,
);
FontOptions.prototype.merge = function (other: FontOptions): void {
    cairo_font_options_merge(getHandle(this), getHandle(other));
};

declare module "../cairo.js" {
    interface FontOptions {
        status(): Status;
        hash(): number;
        setVariations(variations: string): void;
        getVariations(): string;
    }
}

const cairo_font_options_status = bind(
    "libcairo.so.2",
    "cairo_font_options_status",
    [{ type: t.boxed("CairoFontOptions", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type") }],
    t.int32,
);
FontOptions.prototype.status = function (): Status {
    return cairo_font_options_status(getHandle(this)) as Status;
};

const cairo_font_options_hash = bind(
    "libcairo.so.2",
    "cairo_font_options_hash",
    [{ type: t.boxed("CairoFontOptions", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type") }],
    t.uint64,
);
FontOptions.prototype.hash = function (): number {
    return cairo_font_options_hash(getHandle(this)) as number;
};

const cairo_font_options_set_variations = bind(
    "libcairo.so.2",
    "cairo_font_options_set_variations",
    [
        {
            type: t.boxed(
                "CairoFontOptions",
                "borrowed",
                "libcairo-gobject.so.2",
                "cairo_gobject_font_options_get_type",
            ),
        },
        { type: t.string("full") },
    ],
    t.void,
);
FontOptions.prototype.setVariations = function (variations: string): void {
    cairo_font_options_set_variations(getHandle(this), variations);
};

const cairo_font_options_get_variations = bind(
    "libcairo.so.2",
    "cairo_font_options_get_variations",
    [{ type: t.boxed("CairoFontOptions", "borrowed", "libcairo-gobject.so.2", "cairo_gobject_font_options_get_type") }],
    t.string("borrowed"),
);
FontOptions.prototype.getVariations = function (): string {
    return cairo_font_options_get_variations(getHandle(this)) as string;
};
