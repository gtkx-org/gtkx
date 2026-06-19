import type { Display } from "@gtkx/gi/gdk";
import { DisplayManager } from "@gtkx/gi/gdk";
import { CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION, StyleContext } from "@gtkx/gi/gtk";

/**
 * A freshly created {@link CssProvider} paired with the default display it was
 * registered on.
 */
export type DisplayProvider = {
    /** The newly created provider. */
    readonly provider: CssProvider;
    /** The default display the provider was registered on, or `null` when none exists. */
    readonly display: Display | null;
};

/**
 * Registers `provider` on `display` at application priority — the single home
 * for GTKX's provider-attach policy.
 *
 * @param provider - The provider to attach.
 * @param display - The display to attach it to.
 */
export const attachProviderToDisplay = (provider: CssProvider, display: Display): void => {
    StyleContext.addProviderForDisplay(display, provider, STYLE_PROVIDER_PRIORITY_APPLICATION);
};

/**
 * Creates a {@link CssProvider} and registers it on the default display at
 * application priority.
 *
 * When no default display is available the provider is still created and
 * returned, paired with a `null` display, so the caller can attach it later
 * with {@link attachProviderToDisplay} once a display opens.
 *
 * @returns The created provider and the display it was registered on, if any.
 *
 * @example
 * ```ts
 * const { provider, display } = registerProviderForDefaultDisplay();
 * provider.loadFromString(".foo { color: red; }");
 * ```
 */
export const registerProviderForDefaultDisplay = (): DisplayProvider => {
    const provider = new CssProvider();
    const display = DisplayManager.get().getDefaultDisplay();
    if (display) attachProviderToDisplay(provider, display);
    return { provider, display };
};
