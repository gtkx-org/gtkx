import { type Display, DisplayManager } from "@gtkx/gi/gdk/gdk.js";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk/gtk.js";

/** A freshly created `CssProvider` paired with the default display it registered on. */
export type DisplayProvider = {
    /** The newly created provider. */
    readonly provider: CssProvider;
    /** The default display the provider was registered on, or `null` when none exists. */
    readonly display: Display | null;
};

/**
 * Creates a `CssProvider` and registers it on the default display at
 * application priority.
 *
 * When no default display is available the provider is still created and
 * returned, paired with a `null` display, so the caller can register it later.
 *
 * @returns The created provider and the display it was registered on, if any.
 * @example
 * ```ts
 * const { provider, display } = registerProviderForDefaultDisplay();
 * provider.loadFromString(".foo { color: red; }");
 * ```
 */
export const registerProviderForDefaultDisplay = (): DisplayProvider => {
    const provider = new CssProvider();
    const display = DisplayManager.get().getDefaultDisplay();
    if (display) {
        StyleContext.addProviderForDisplay(display, provider, STYLE_PROVIDER_PRIORITY_APPLICATION);
    }
    return { provider, display };
};
