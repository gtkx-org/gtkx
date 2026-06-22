import type * as Gtk from "@gtkx/gi/gtk";
import { registerProviderForDefaultDisplay } from "./provider.js";

export class Stylesheet {
    private css = "";
    private provider: Gtk.CssProvider | null = null;
    private updateScheduled = false;

    private ensureProvider(): void {
        if (this.provider) return;
        const { provider } = registerProviderForDefaultDisplay();
        this.provider = provider;
        if (process.env["NODE_ENV"] !== "production") {
            provider.on("parsing-error", (section, error) => {
                console.warn(`[gtkx/css] GTK rejected CSS at ${section.toString()}: ${error.message}`);
            });
        }
    }

    private updateProvider(): void {
        if (this.provider && this.css.length > 0) {
            this.provider.loadFromString(this.css);
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
        this.css += this.css.length > 0 ? `\n${rule}` : rule;
        this.scheduleUpdate();
    }
}
