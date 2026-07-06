import type * as Gtk from "@gtkx/gi/gtk";
import { createLogger } from "@gtkx/utils";
import { registerProviderForDefaultDisplay } from "./provider.js";

const log = createLogger("css");

export class StyleSheet {
    private css = "";
    private provider: Gtk.CssProvider | null = null;
    private updateScheduled = false;

    private ensureProvider(): Gtk.CssProvider {
        if (this.provider) return this.provider;
        const provider = registerProviderForDefaultDisplay();
        this.provider = provider;
        if (process.env.NODE_ENV !== "production") {
            provider.on("parsing-error", (section, error) => {
                log.warn(`GTK rejected CSS at ${section.toString()}: ${error.message}`);
            });
        }
        return provider;
    }

    private scheduleUpdate(): void {
        if (this.updateScheduled) return;
        this.updateScheduled = true;
        queueMicrotask(() => {
            this.updateScheduled = false;
            this.ensureProvider().loadFromString(this.css);
        });
    }

    insert(rule: string): void {
        this.css += this.css.length > 0 ? `\n${rule}` : rule;
        this.scheduleUpdate();
    }
}
