import { registerProviderForDefaultDisplay } from "@gtkx/css";
import type * as Gtk from "@gtkx/gi/gtk";
import { STYLE_PROVIDER_PRIORITY_APPLICATION } from "@gtkx/gi/gtk";
import { createLogger } from "@gtkx/utils";
import type { AnimationTarget } from "./animation-types.js";
import { buildCss } from "./build-css.js";

const ANIMATION_PROVIDER_PRIORITY = STYLE_PROVIDER_PRIORITY_APPLICATION + 1;

const log = createLogger("animate");

class AnimationStyleSheet {
    private provider: Gtk.CssProvider | null = null;
    private rules = new Map<string, string>();
    private lastFlushed = "";
    private flushScheduled = false;

    public set(className: string, rule: string): void {
        if (rule.length === 0) {
            this.remove(className);
            return;
        }
        if (this.rules.get(className) === rule) return;
        this.rules.set(className, rule);
        this.scheduleFlush();
    }

    public remove(className: string): void {
        if (!this.rules.delete(className)) return;
        this.scheduleFlush();
    }

    private ensureProvider(): Gtk.CssProvider {
        if (this.provider) return this.provider;
        const provider = registerProviderForDefaultDisplay(ANIMATION_PROVIDER_PRIORITY);
        this.provider = provider;
        if (process.env.NODE_ENV !== "production") {
            provider.on("parsing-error", (section, error) => {
                log.warn(`GTK rejected animation CSS at ${section.toString()}: ${error.message}`);
            });
        }
        return provider;
    }

    private scheduleFlush(): void {
        if (this.flushScheduled) return;
        this.flushScheduled = true;
        queueMicrotask(() => {
            this.flushScheduled = false;
            this.flush();
        });
    }

    private flush(): void {
        const css = [...this.rules.values()].join("\n");
        if (css === this.lastFlushed) return;
        this.lastFlushed = css;
        this.ensureProvider().loadFromString(css);
    }
}

const sheet = new AnimationStyleSheet();

export class AnimationCssProvider {
    private className: string;
    private widget: Gtk.Widget | null = null;

    constructor(className: string) {
        this.className = className;
    }

    public attach(widget: Gtk.Widget): void {
        if (this.widget) return;
        this.widget = widget;
        widget.addCssClass(this.className);
    }

    public write(values: AnimationTarget): void {
        if (!this.widget) return;
        sheet.set(this.className, buildCss(this.className, values));
    }

    public dispose(): void {
        if (!this.widget) return;
        this.widget.removeCssClass(this.className);
        this.widget = null;
        sheet.remove(this.className);
    }
}
