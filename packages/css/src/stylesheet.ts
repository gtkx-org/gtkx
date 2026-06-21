import type * as Gtk from "@gtkx/gi/gtk";
import { registerProviderForDefaultDisplay } from "./provider.js";

export class Stylesheet {
    private rules: string[] = [];
    private provider: Gtk.CssProvider | null = null;
    private updateScheduled = false;

    private ensureProvider(): void {
        if (this.provider) return;
        const { provider } = registerProviderForDefaultDisplay();
        this.provider = provider;
        provider.on("parsing-error", (section, error) => {
            console.warn(`[gtkx/css] GTK rejected CSS at ${section.toString()}: ${error.message}`);
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
