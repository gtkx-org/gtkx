import * as Adw from "@gtkx/gi/adw";

/** A color scheme under which documentation assets are captured. */
export type Theme = "light" | "dark";

/** Both capture themes, in the order assets are produced. */
export const THEMES: readonly Theme[] = ["light", "dark"];

/**
 * Forces the Adwaita color scheme for the current process so subsequent
 * renders are captured under the requested theme.
 *
 * @param theme - The color scheme to force
 */
export const setTheme = (theme: Theme): void => {
    Adw.StyleManager.getDefault().setColorScheme(
        theme === "dark" ? Adw.ColorScheme.FORCE_DARK : Adw.ColorScheme.FORCE_LIGHT,
    );
};
