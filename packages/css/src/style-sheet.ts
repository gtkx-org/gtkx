import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";

type StyleSheetOptions = {
    key: string;
};

export class StyleSheet {
    key: string;
    private rules: string[] = [];
    private provider: Gtk.CssProvider | null = null;
    private updateScheduled = false;

    constructor(options: StyleSheetOptions) {
        this.key = options.key;
    }

    private ensureProvider(): void {
        if (this.provider) return;
        const { provider, display } = Gtk.registerProviderForDefaultDisplay();
        this.provider = provider;
        provider.connect("parsing-error", (section, error) => {
            console.warn(`[gtkx/css] GTK rejected CSS at ${section.toString()}: ${error.message}`);
        });
        if (!display) this.registerWhenDisplayOpens(provider);
    }

    /**
     * Defers the provider's display registration until a display exists.
     *
     * Application code evaluates `css` templates at module scope, before the
     * application activates and opens the default display — at that point the
     * provider can only be created, not attached. Attaching on the display
     * manager's `display-opened` signal makes those early rules take effect
     * the moment the first display appears.
     */
    private registerWhenDisplayOpens(provider: Gtk.CssProvider): void {
        Gdk.DisplayManager.get().once("display-opened", (display) => {
            Gtk.StyleContext.addProviderForDisplay(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
        });
    }

    private updateProvider(): void {
        if (this.provider && this.rules.length > 0) {
            const css = this.rules.join("\n");
            this.provider.loadFromString(css);
        }
    }

    private scheduleUpdate(): void {
        if (this.updateScheduled) return;
        this.updateScheduled = true;
        queueMicrotask(() => {
            this.updateScheduled = false;
            this.ensureProvider();
            this.updateProvider();
        });
    }

    insert(rule: string): void {
        this.rules.push(rule);
        this.scheduleUpdate();
    }
}
