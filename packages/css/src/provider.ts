import type { Logger } from "@gtkx/utils";
import { type Display, DisplayManager } from "@gtkx/gi/gdk";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk";

const registerProviderForDefaultDisplay = (
    priority: number = STYLE_PROVIDER_PRIORITY_APPLICATION,
): CssProvider => {
    const provider = new CssProvider();
    const manager = DisplayManager.get();

    const attach = (display: Display): void => {
        StyleContext.addProviderForDisplay(display, provider, priority);
    };

    const initialDisplay = manager.getDefaultDisplay();

    if (initialDisplay) {
        attach(initialDisplay);
    } else {
        manager.once("display-opened", (openedDisplay: Display): void => {
            attach(openedDisplay);
        });
    }

    return provider;
};

const attachParsingErrorLogger = (provider: CssProvider, log: Logger, subject: string): void => {
    if (process.env.NODE_ENV !== "production") {
        provider.on("parsing-error", (section, error) => {
            log.warn(`GTK4 rejected ${subject} at ${section.toString()}: ${error.message}`);
        });
    }
};

export { registerProviderForDefaultDisplay, attachParsingErrorLogger };
