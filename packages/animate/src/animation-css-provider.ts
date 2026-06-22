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

export class AnimationCssProvider {
    private className: string;
    private attachment: Attachment | null = null;

    constructor(className: string) {
        this.className = className;
    }

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

    public write(values: AnimatableProperties): void {
        if (!this.attachment) return;

        const css = buildCss(this.className, values);
        if (css) {
            this.attachment.provider.loadFromString(css);
        }
    }

    public dispose(): void {
        if (!this.attachment) return;

        this.attachment.dispose();
        this.attachment = null;
    }
}
