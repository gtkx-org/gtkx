import { type Display, DisplayManager } from "@gtkx/gi/gdk";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk";

export const registerProviderForDefaultDisplay = (
    priority: number = STYLE_PROVIDER_PRIORITY_APPLICATION,
): { provider: CssProvider; dispose: () => void } => {
    const provider = new CssProvider();
    const manager = DisplayManager.get();

    let attachedDisplay: Display | undefined;
    const attach = (display: Display): void => {
        attachedDisplay = display;
        StyleContext.addProviderForDisplay(display, provider, priority);
    };

    const onDisplayOpened = (openedDisplay: Display): void => attach(openedDisplay);
    const initialDisplay = manager.getDefaultDisplay();
    if (initialDisplay) {
        attach(initialDisplay);
    } else {
        manager.once("display-opened", onDisplayOpened);
    }

    return {
        provider,
        dispose: () => {
            manager.off("display-opened", onDisplayOpened);
            if (attachedDisplay) StyleContext.removeProviderForDisplay(attachedDisplay, provider);
        },
    };
};
