import type { Display } from "@gtkx/gi/gdk";
import { DisplayManager } from "@gtkx/gi/gdk";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk";

/**
 * A {@link CssProvider} bound to the default GDK display. When no display exists yet at
 * creation time, the provider attaches automatically as soon as a display opens. The
 * resolved display is held privately so `dispose` can remove the provider correctly.
 */
export type DisplayProvider = {
    provider: CssProvider;
    dispose: () => void;
};

const attachProviderToDisplay = (provider: CssProvider, display: Display, priority: number): void => {
    StyleContext.addProviderForDisplay(display, provider, priority);
};

/**
 * Creates a {@link CssProvider} and attaches it to the default GDK display.
 *
 * If a display already exists it is attached immediately. Otherwise a one-shot
 * `display-opened` handler attaches the provider as soon as the first display opens.
 * The resolved display is captured in closure state so teardown can remove the
 * provider correctly.
 *
 * @param priority - The GTK style-provider priority the provider attaches at. Defaults
 *   to {@link STYLE_PROVIDER_PRIORITY_APPLICATION}; pass a higher value so the provider's
 *   rules deterministically override lower-priority providers regardless of attachment order.
 * @returns The provider and a `dispose` callback that detaches it from the resolved display.
 */
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
