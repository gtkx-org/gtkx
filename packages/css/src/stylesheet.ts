import type * as Gtk from "@gtkx/gi/gtk";
import { createLogger } from "@gtkx/utils";
import { attachParsingErrorLogger, registerProviderForDefaultDisplay } from "./provider.js";

const log = createLogger("css");

class StyleSheet {
    private css = "";
    private provider: Gtk.CssProvider | null = null;
    private updateScheduled = false;

    private ensureProvider(): Gtk.CssProvider {
        if (this.provider) {
            return this.provider;
        }

        const provider = registerProviderForDefaultDisplay();
        this.provider = provider;
        attachParsingErrorLogger(provider, log, "CSS");

        return provider;
    }

    private scheduleUpdate(): void {
        if (this.updateScheduled) {
            return;
        }

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

export { StyleSheet };
