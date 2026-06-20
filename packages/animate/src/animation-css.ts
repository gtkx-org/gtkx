import { registerProviderForDefaultDisplay } from "@gtkx/css";
import type * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import type { AnimatableProperties } from "./types.js";

export const DEFAULT_TIMED_DURATION = 300;
export const DEFAULT_SPRING_DAMPING = 1;
export const DEFAULT_SPRING_MASS = 1;
export const DEFAULT_SPRING_STIFFNESS = 100;

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

export class AnimationCssProvider {
    private className: string;
    private provider: Gtk.CssProvider | null = null;
    private display: Gdk.Display | null = null;
    private widget: Gtk.Widget | null = null;
    private classApplied = false;

    constructor(className: string) {
        this.className = className;
    }

    public attach(widget: Gtk.Widget): void {
        this.widget = widget;

        if (!this.provider) {
            const { provider, display } = registerProviderForDefaultDisplay();
            this.provider = provider;
            this.display = display;
        }

        if (!this.classApplied) {
            widget.addCssClass(this.className);
            this.classApplied = true;
        }
    }

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
