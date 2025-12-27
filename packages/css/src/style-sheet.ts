import { events } from "@gtkx/ffi";
import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";

type StyleSheetOptions = {
    key: string;
    container?: unknown;
    nonce?: string;
    speedy?: boolean;
    prepend?: boolean;
};

const STYLE_PROVIDER_PRIORITY_APPLICATION = 600;

let isGtkReady = false;
const pendingSheets: StyleSheet[] = [];

const flushPendingStyles = (): void => {
    isGtkReady = true;
    for (const sheet of pendingSheets) {
        sheet.applyQueuedRules();
    }
    pendingSheets.length = 0;
};

const resetGtkState = (): void => {
    isGtkReady = false;

    events.once("start", flushPendingStyles);
};

events.once("start", flushPendingStyles);

events.on("stop", resetGtkState);

export class StyleSheet {
    key: string;
    private rules: string[] = [];
    private provider: Gtk.CssProvider | null = null;
    private display: Gdk.Display | null = null;
    private isRegistered = false;
    private hasPendingRules = false;

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

    insert(rule: string): void {
        this.rules.push(rule);

        if (isGtkReady) {
            this.ensureProvider();
            this.updateProvider();
        } else if (!this.hasPendingRules) {
            this.hasPendingRules = true;
            pendingSheets.push(this);
        }
    }

    applyQueuedRules(): void {
        if (this.rules.length > 0) {
            this.ensureProvider();
            this.updateProvider();
        }
        this.hasPendingRules = false;
    }

    flush(): void {
        if (this.provider && this.display && this.isRegistered) {
            Gtk.StyleContext.removeProviderForDisplay(this.display, this.provider);
            this.isRegistered = false;
        }

        this.rules = [];
        this.provider = null;
        this.display = null;
        this.hasPendingRules = false;
    }

    hydrate(_elements: unknown[]): void {}
}
