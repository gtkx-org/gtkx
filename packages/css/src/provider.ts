import type { Display } from "@gtkx/gi/gdk";
import { DisplayManager } from "@gtkx/gi/gdk";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk";

/**
 * A {@link CssProvider} bound to the default GDK display. When no display exists yet at
 * creation time, the provider attaches automatically as soon as a display opens, and its
 * {@link DisplayProvider.display} is populated with the resolved display for correct teardown.
 */
export type DisplayProvider = {
    provider: CssProvider;
    display: Display | null;
    dispose: () => void;
};

const attachProviderToDisplay = (provider: CssProvider, display: Display): void => {
    StyleContext.addProviderForDisplay(display, provider, STYLE_PROVIDER_PRIORITY_APPLICATION);
};

/**
 * Creates a {@link CssProvider} and attaches it to the default GDK display.
 *
 * If a display already exists it is attached immediately. Otherwise a one-shot
 * `display-opened` handler attaches the provider as soon as the first display opens,
 * recording it on the returned object so teardown can remove the provider correctly.
 */
export const registerProviderForDefaultDisplay = (): DisplayProvider => {
    const provider = new CssProvider();
    const initialDisplay = DisplayManager.get().getDefaultDisplay();

    const result: DisplayProvider = {
        provider,
        display: initialDisplay,
        dispose: () => {
            if (result.display) StyleContext.removeProviderForDisplay(result.display, provider);
        },
    };

    if (initialDisplay) {
        attachProviderToDisplay(provider, initialDisplay);
    } else {
        DisplayManager.get().once("display-opened", (display) => {
            result.display = display;
            attachProviderToDisplay(provider, display);
        });
    }

    return result;
};
