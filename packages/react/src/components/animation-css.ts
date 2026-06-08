import type * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import type { AnimatableProperties } from "../jsx.js";

/** Default duration, in milliseconds, for a timed animation that omits `duration`. */
export const DEFAULT_TIMED_DURATION = 300;
/** Default damping ratio for a spring animation that omits `damping`. */
export const DEFAULT_SPRING_DAMPING = 1;
/** Default virtual mass for a spring animation that omits `mass`. */
export const DEFAULT_SPRING_MASS = 1;
/** Default stiffness for a spring animation that omits `stiffness`. */
export const DEFAULT_SPRING_STIFFNESS = 100;

/**
 * Returns the resting value an animatable property falls back to when absent
 * from a `from`/`to` set. Multiplicative properties rest at `1`; everything
 * else rests at `0`.
 *
 * @param property - The animatable property whose default is requested.
 * @returns The neutral value used when the property is unspecified.
 */
export const getDefaultValue = (property: keyof AnimatableProperties): number => {
    switch (property) {
        case "opacity":
        case "scale":
        case "scaleX":
        case "scaleY":
            return 1;
        default:
            return 0;
    }
};

/**
 * Linearly interpolates every animatable property between two value sets.
 *
 * Keys present in either set are interpolated; a key missing from one side
 * falls back to its {@link getDefaultValue}.
 *
 * @param from - The starting property values.
 * @param to - The target property values.
 * @param progress - The animation progress in the `[0, 1]` range.
 * @returns The interpolated property values at `progress`.
 */
export const interpolate = (
    from: AnimatableProperties,
    to: AnimatableProperties,
    progress: number,
): AnimatableProperties => {
    const result: AnimatableProperties = {};
    const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]) as Set<keyof AnimatableProperties>;

    for (const key of allKeys) {
        const fromVal = from[key] ?? getDefaultValue(key);
        const toVal = to[key] ?? getDefaultValue(key);
        result[key] = fromVal + (toVal - fromVal) * progress;
    }

    return result;
};

/**
 * Serializes animatable property values into a CSS rule scoped to a class.
 *
 * `opacity` becomes an `opacity` declaration; the translate, scale, rotate, and
 * skew properties combine into a single `transform` declaration. Returns an
 * empty string when no property is set.
 *
 * @param className - The CSS class the rule targets.
 * @param props - The animatable values to serialize.
 * @returns A CSS rule string, or `""` when there is nothing to render.
 */
export const buildCss = (className: string, props: AnimatableProperties): string => {
    const parts: string[] = [];
    const transforms: string[] = [];

    if (props.opacity !== undefined) {
        parts.push(`opacity: ${props.opacity}`);
    }

    if (props.translateX !== undefined || props.translateY !== undefined) {
        transforms.push(`translate(${props.translateX ?? 0}px, ${props.translateY ?? 0}px)`);
    }

    if (props.scale !== undefined) {
        transforms.push(`scale(${props.scale})`);
    } else if (props.scaleX !== undefined || props.scaleY !== undefined) {
        transforms.push(`scale(${props.scaleX ?? 1}, ${props.scaleY ?? 1})`);
    }

    if (props.rotate !== undefined) {
        transforms.push(`rotate(${props.rotate}deg)`);
    }

    if (props.skewX !== undefined) {
        transforms.push(`skewX(${props.skewX}deg)`);
    }

    if (props.skewY !== undefined) {
        transforms.push(`skewY(${props.skewY}deg)`);
    }

    if (transforms.length > 0) {
        parts.push(`transform: ${transforms.join(" ")}`);
    }

    if (parts.length === 0) {
        return "";
    }

    return `.${className} { ${parts.join("; ")}; }`;
};

/**
 * Shallow key-and-value comparison of two animatable property sets.
 *
 * @typeParam T - The property record type.
 * @param a - The first property set, or `undefined`.
 * @param b - The second property set, or `undefined`.
 * @returns `true` when both sets hold the same keys and equal values.
 */
export const areAnimatedPropsEqual = <T extends Record<string, unknown>>(a?: T, b?: T): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }

    return true;
};

/**
 * Owns the lifecycle of a per-animation `Gtk.CssProvider` registered against the
 * default display.
 *
 * Each instance registers one provider at application priority and writes CSS
 * scoped to a unique class added to the animated widget. {@link dispose}
 * deregisters the provider and strips the class so a finished or unmounted
 * animation leaves no residue on the display or the widget.
 */
export class AnimationCssProvider {
    private readonly className: string;
    private provider: Gtk.CssProvider | null = null;
    private display: Gdk.Display | null = null;
    private widget: Gtk.Widget | null = null;
    private classApplied = false;

    /**
     * @param className - The unique CSS class this provider scopes its rules to.
     */
    constructor(className: string) {
        this.className = className;
    }

    /**
     * Binds the provider to a widget, registering the provider on the default
     * display and adding the scoped class to the widget.
     *
     * @param widget - The widget the animation drives.
     */
    public attach(widget: Gtk.Widget): void {
        this.widget = widget;

        if (!this.provider) {
            const { provider, display } = Gtk.registerProviderForDefaultDisplay();
            this.provider = provider;
            this.display = display;
        }

        if (!this.classApplied) {
            widget.addCssClass(this.className);
            this.classApplied = true;
        }
    }

    /**
     * Writes the given animatable values as CSS through the provider.
     *
     * @param values - The values to render onto the scoped class.
     */
    public write(values: AnimatableProperties): void {
        if (!this.provider) return;

        if (this.widget && !this.classApplied) {
            this.widget.addCssClass(this.className);
            this.classApplied = true;
        }

        const css = buildCss(this.className, values);
        if (css) {
            this.provider.loadFromString(css);
        }
    }

    /**
     * Deregisters the provider from the display and removes the scoped class
     * from the bound widget, leaving nothing behind.
     */
    public dispose(): void {
        if (this.provider && this.display) {
            Gtk.StyleContext.removeProviderForDisplay(this.display, this.provider);
        }

        if (this.widget && this.classApplied) {
            this.widget.removeCssClass(this.className);
        }

        this.classApplied = false;
        this.provider = null;
        this.display = null;
        this.widget = null;
    }
}
