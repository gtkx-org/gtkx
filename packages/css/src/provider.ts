import type { Display } from "@gtkx/gi/gdk";
import { DisplayManager } from "@gtkx/gi/gdk";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk";

export type DisplayProvider = {
    provider: CssProvider;
    dispose: () => void;
};

const attachProviderToDisplay = (provider: CssProvider, display: Display, priority: number): void => {
    StyleContext.addProviderForDisplay(display, provider, priority);
};

export const registerProviderForDefaultDisplay = (
    priority: number = STYLE_PROVIDER_PRIORITY_APPLICATION,
): DisplayProvider => {
    const provider = new CssProvider();
    const initialDisplay = DisplayManager.get().getDefaultDisplay();
    let display = initialDisplay;

    if (initialDisplay) {
        attachProviderToDisplay(provider, initialDisplay, priority);
    } else {
        DisplayManager.get().once("display-opened", (openedDisplay) => {
            display = openedDisplay;
            attachProviderToDisplay(provider, openedDisplay, priority);
        });
    }

    return {
        provider,
        dispose: () => {
            if (display) StyleContext.removeProviderForDisplay(display, provider);
        },
    };
};
