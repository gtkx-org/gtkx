import { type ExternalObject, getHandle, type Handle, registerWrapperClass, setHandle, t } from "@gtkx/runtime";
import type { Antialias, HintMetrics, HintStyle, Status, SubpixelOrder } from "./enums.js";
import { bindCairo, cairoGType, FONT_OPTIONS_FULL_T, FONT_OPTIONS_T } from "./lib.js";

const FONT_OPTIONS_TYPE = cairoGType("cairo_gobject_font_options_get_type");
const cairoFontOptionsCreate = bindCairo("cairo_font_options_create", [], FONT_OPTIONS_FULL_T);
const cairoFontOptionsCopy = bindCairo("cairo_font_options_copy", [FONT_OPTIONS_T], FONT_OPTIONS_FULL_T);
const cairoFontOptionsSetHintStyle = bindCairo("cairo_font_options_set_hint_style", [FONT_OPTIONS_T, t.int32], t.void);
const cairoFontOptionsGetHintStyle = bindCairo("cairo_font_options_get_hint_style", [FONT_OPTIONS_T], t.int32);
const cairoFontOptionsSetAntialias = bindCairo("cairo_font_options_set_antialias", [FONT_OPTIONS_T, t.int32], t.void);
const cairoFontOptionsGetAntialias = bindCairo("cairo_font_options_get_antialias", [FONT_OPTIONS_T], t.int32);
const cairoFontOptionsGetHintMetrics = bindCairo("cairo_font_options_get_hint_metrics", [FONT_OPTIONS_T], t.int32);
const cairoFontOptionsEqual = bindCairo("cairo_font_options_equal", [FONT_OPTIONS_T, FONT_OPTIONS_T], t.boolean);
const cairoFontOptionsMerge = bindCairo("cairo_font_options_merge", [FONT_OPTIONS_T, FONT_OPTIONS_T], t.void);
const cairoFontOptionsStatus = bindCairo("cairo_font_options_status", [FONT_OPTIONS_T], t.int32);
const cairoFontOptionsHash = bindCairo("cairo_font_options_hash", [FONT_OPTIONS_T], t.uint64);

const cairoFontOptionsGetVariations = bindCairo(
    "cairo_font_options_get_variations",
    [FONT_OPTIONS_T],
    t.string("borrowed"),
);

const cairoFontOptionsSetVariations = bindCairo(
    "cairo_font_options_set_variations",
    [FONT_OPTIONS_T, t.string("full")],
    t.void,
);

const cairoFontOptionsSetHintMetrics = bindCairo(
    "cairo_font_options_set_hint_metrics",
    [FONT_OPTIONS_T, t.int32],
    t.void,
);

const cairoFontOptionsSetSubpixelOrder = bindCairo(
    "cairo_font_options_set_subpixel_order",
    [FONT_OPTIONS_T, t.int32],
    t.void,
);

const cairoFontOptionsGetSubpixelOrder = bindCairo(
    "cairo_font_options_get_subpixel_order",
    [FONT_OPTIONS_T],
    t.int32,
);

/**
 * Cairo font options (`cairo_font_options_t`): the rendering settings applied to text, such as antialiasing,
 * hinting and font variations.
 */
class FontOptions {
    static {
        registerWrapperClass(this, FONT_OPTIONS_TYPE);
    }

    /** Creates a set of font options with all settings at their defaults, the same as `new FontOptions()`. */
    static create(): FontOptions {
        return new FontOptions();
    }

    /** GType of `CairoFontOptions`, the boxed type this class is registered under. */
    declare __type__: bigint;

    /** Creates a set of font options: a copy of `other` when given, otherwise all settings at their defaults. */
    constructor(other?: FontOptions) {
        const handle = other === undefined ? cairoFontOptionsCreate() : cairoFontOptionsCopy(getHandle(other));
        setHandle(this, handle as ExternalObject<Handle>);
    }

    /** Sets how outlines are fitted to the pixel grid. */
    setHintStyle(hintStyle: HintStyle): void {
        cairoFontOptionsSetHintStyle(getHandle(this), hintStyle);
    }

    /** Returns how outlines are fitted to the pixel grid. */
    getHintStyle(): HintStyle {
        return cairoFontOptionsGetHintStyle(getHandle(this)) as HintStyle;
    }

    /** Sets the antialiasing mode used for text. */
    setAntialias(antialias: Antialias): void {
        cairoFontOptionsSetAntialias(getHandle(this), antialias);
    }

    /** Returns the antialiasing mode used for text. */
    getAntialias(): Antialias {
        return cairoFontOptionsGetAntialias(getHandle(this)) as Antialias;
    }

    /** Sets whether font metrics are quantized to integer pixels. */
    setHintMetrics(hintMetrics: HintMetrics): void {
        cairoFontOptionsSetHintMetrics(getHandle(this), hintMetrics);
    }

    /** Returns whether font metrics are quantized to integer pixels. */
    getHintMetrics(): HintMetrics {
        return cairoFontOptionsGetHintMetrics(getHandle(this)) as HintMetrics;
    }

    /** Sets the order of subpixels on the display, used by subpixel antialiasing. */
    setSubpixelOrder(subpixelOrder: SubpixelOrder): void {
        cairoFontOptionsSetSubpixelOrder(getHandle(this), subpixelOrder);
    }

    /** Returns the order of subpixels on the display. */
    getSubpixelOrder(): SubpixelOrder {
        return cairoFontOptionsGetSubpixelOrder(getHandle(this)) as SubpixelOrder;
    }

    /** Returns whether `other` holds the same settings. */
    equal(other: FontOptions): boolean {
        return cairoFontOptionsEqual(getHandle(this), getHandle(other)) as boolean;
    }

    /** Copies every non-default setting of `other` over this one. */
    merge(other: FontOptions): void {
        cairoFontOptionsMerge(getHandle(this), getHandle(other));
    }

    /** Returns the error status of the font options, `Status.SUCCESS` when they are usable. */
    status(): Status {
        return cairoFontOptionsStatus(getHandle(this)) as Status;
    }

    /** Returns a hash of the settings, equal for options that compare `equal`. */
    hash(): number {
        return cairoFontOptionsHash(getHandle(this)) as number;
    }

    /** Sets the OpenType font variations to apply, as a comma-separated `axis=value` string. */
    setVariations(variations: string): void {
        cairoFontOptionsSetVariations(getHandle(this), variations);
    }

    /** Returns the OpenType font variations to apply. */
    getVariations(): string {
        return cairoFontOptionsGetVariations(getHandle(this)) as string;
    }
}

export { FontOptions };
