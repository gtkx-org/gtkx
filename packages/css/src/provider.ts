import { DisplayManager } from "@gtkx/gi/gdk";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk";

export const registerProviderForDefaultDisplay = (
    priority: number = STYLE_PROVIDER_PRIORITY_APPLICATION,
): { provider: CssProvider; dispose: () => void } => {
    const provider = new CssProvider();
    const initialDisplay = DisplayManager.get().getDefaultDisplay();
    let display = initialDisplay;

    if (initialDisplay) {
        StyleContext.addProviderForDisplay(initialDisplay, provider, priority);
    } else {
        DisplayManager.get().once("display-opened", (openedDisplay) => {
            display = openedDisplay;
            StyleContext.addProviderForDisplay(openedDisplay, provider, priority);
        });
    }

    return {
        provider,
        dispose: () => {
            if (display) StyleContext.removeProviderForDisplay(display, provider);
        },
    };
};
