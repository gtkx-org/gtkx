import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";

type StyleSheetOptions = {
    key: string;
};

const STYLE_PROVIDER_PRIORITY_APPLICATION = 600;

export class StyleSheet {
    key: string;
    private rules: string[] = [];
    private provider: Gtk.CssProvider | null = null;
    private display: Gdk.Display | null = null;
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
}
