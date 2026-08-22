import * as Adw from "@gtkx/gi/adw";
import { useProperty } from "@gtkx/react";
import { useMemo } from "react";

/** Style state handed to `useTheme` and to option callbacks as `theme`, mirroring Adwaita's style manager. */
type AdwaitaTheme = {
    /** Whether the application currently uses the dark color scheme. */
    dark: boolean;
    /** Whether the system requested high-contrast styling. */
    highContrast: boolean;
};

declare module "@react-navigation/core" {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Theme extends AdwaitaTheme {}
}

/** The light Adwaita theme. */
const DefaultTheme: AdwaitaTheme = { dark: false, highContrast: false };
/** The dark Adwaita theme. */
const DarkTheme: AdwaitaTheme = { dark: true, highContrast: false };

const useAdwaitaTheme = (): AdwaitaTheme => {
    const manager = Adw.StyleManager.getDefault();
    const isDark = useProperty(manager, "dark") ?? manager.getDark();
    const isHighContrast = useProperty(manager, "highContrast") ?? manager.getHighContrast();

    return useMemo(() => ({ dark: isDark, highContrast: isHighContrast }), [isDark, isHighContrast]);
};

export { type AdwaitaTheme as Theme, DarkTheme, DefaultTheme, useAdwaitaTheme };
