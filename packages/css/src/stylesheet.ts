import type * as Gtk from "@gtkx/gi/gtk";
import { createLogger } from "@gtkx/utils";
import { attachParsingErrorLogger, registerProviderForDefaultDisplay } from "./provider.js";
import { hasNul, NUL_REASON, printableRule } from "./rule-text.js";
import { containmentFailure } from "./self-contained.js";
import { hasNewlineInString, NEWLINE_IN_STRING } from "./tokens.js";

const log = createLogger("css");

const unusableReason = (rule: string): string | null => {
    if (hasNul(rule)) {
        return NUL_REASON;
    }

    return hasNewlineInString(rule) ? NEWLINE_IN_STRING : containmentFailure(rule);
};

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
        const reason = unusableReason(rule);

        if (reason !== null) {
            log.warn(`Dropped a malformed CSS rule that ${reason}: ${printableRule(rule)}`);

            return;
        }

        this.css += this.css.length > 0 ? `\n${rule}` : rule;
        this.scheduleUpdate();
    }
}

export { StyleSheet };
