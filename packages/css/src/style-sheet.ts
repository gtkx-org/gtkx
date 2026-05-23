import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";

type StyleSheetOptions = {
    key: string;
};

const STYLE_PROVIDER_PRIORITY_APPLICATION = 600;

export class StyleSheet {
    key: string;
    private rules: string[] = [];
    private provider: Gtk.CssProvider | null = null;
    private display: Gdk.Display | null = null;
    private isRegistered = false;
    private updateScheduled = false;

    constructor(options: StyleSheetOptions) {
        this.key = options.key;
    }

    private ensureProvider(): void {
        if (!this.provider) {
            this.provider = new Gtk.CssProvider();
            this.display = Gdk.DisplayManager.get().getDefaultDisplay();

            if (this.display) {
                Gtk.StyleContext.addProviderForDisplay(
                    this.display,
                    this.provider,
                    STYLE_PROVIDER_PRIORITY_APPLICATION,
                );
                this.isRegistered = true;
            }
        }
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

    flush(): void {
        if (this.provider && this.display && this.isRegistered) {
            Gtk.StyleContext.removeProviderForDisplay(this.display, this.provider);
            this.isRegistered = false;
        }

        this.rules = [];
        this.provider = null;
        this.display = null;
        this.updateScheduled = false;
    }

    /**
     * No-op stub for emotion-style API compatibility.
     *
     * Hydration applies to server-rendered HTML, which has no equivalent in
     * GTK applications. Provided so that consumers written for browser-based
     * style-sheet APIs can call it safely.
     */
    hydrate(_elements: unknown[]): void {
        return;
    }
}
