import { registerProviderForDefaultDisplay } from "@gtkx/css";
import type * as Gtk from "@gtkx/gi/gtk";
import { STYLE_PROVIDER_PRIORITY_APPLICATION } from "@gtkx/gi/gtk";
import { buildCss } from "./build-css.js";
import type { AnimatableProperties } from "./types.js";

const ANIMATION_PROVIDER_PRIORITY = STYLE_PROVIDER_PRIORITY_APPLICATION + 1;

type Attachment = {
    provider: Gtk.CssProvider;
    dispose: () => void;
};

/**
 * Owns the GTK {@link Gtk.CssProvider} lifecycle that drives a single animated
 * widget. Attachment registers the provider, adds the animation class, and
 * records the inverse teardown; subsequent writes assume the widget is attached
 * and stream interpolated keyframes into the provider as CSS.
 */
export class AnimationCssProvider {
    private className: string;
    private attachment: Attachment | null = null;

    constructor(className: string) {
        this.className = className;
    }

    /**
     * Register the CSS provider for the default display and add the animation
     * class to the widget, recording the teardown that reverses both effects.
     *
     * @param widget - The widget the animation class is applied to.
     */
    public attach(widget: Gtk.Widget): void {
        if (this.attachment) return;

        const displayProvider = registerProviderForDefaultDisplay(ANIMATION_PROVIDER_PRIORITY);
        widget.addCssClass(this.className);

        this.attachment = {
            provider: displayProvider.provider,
            dispose: () => {
                displayProvider.dispose();
                widget.removeCssClass(this.className);
            },
        };
    }

    /**
     * Serialize a keyframe to CSS and stream it into the attached provider.
     *
     * @param values - The keyframe to write as CSS declarations.
     */
    public write(values: AnimatableProperties): void {
        if (!this.attachment) return;

        const css = buildCss(this.className, values);
        if (css) {
            this.attachment.provider.loadFromString(css);
        }
    }

    /**
     * Run the recorded teardown, removing the provider and the animation class,
     * and clear the attachment.
     */
    public dispose(): void {
        if (!this.attachment) return;

        this.attachment.dispose();
        this.attachment = null;
    }
}
