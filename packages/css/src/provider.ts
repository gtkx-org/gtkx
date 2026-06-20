import type { Display } from "@gtkx/gi/gdk";
import { DisplayManager } from "@gtkx/gi/gdk";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk";

export type DisplayProvider = {
    provider: CssProvider;
    display: Display | null;
};

export const attachProviderToDisplay = (provider: CssProvider, display: Display): void => {
    StyleContext.addProviderForDisplay(display, provider, STYLE_PROVIDER_PRIORITY_APPLICATION);
};

export const registerProviderForDefaultDisplay = (): DisplayProvider => {
    const provider = new CssProvider();
    const display = DisplayManager.get().getDefaultDisplay();
    if (display) attachProviderToDisplay(provider, display);
    return { provider, display };
};
