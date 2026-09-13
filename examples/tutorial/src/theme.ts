import * as Adw from "@gtkx/gi/adw";
import { colorSchemeValue } from "./settings.js";

export const applyColorScheme = (value: string): void => {
    const manager = Adw.StyleManager.getDefault();
    manager.setColorScheme(colorSchemeValue(value));
};
