import { css } from "@gtkx/css";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { afterEach, describe, expect, it } from "vitest";
import { probeMinWidth } from "./helpers/probe.js";

const LIGHT_WIDTH = 301;
const DARK_WIDTH = 401;
const PLAIN_WIDTH = 311;
const CONTRAST_WIDTH = 411;

const defaultSettings = (): Gtk.Settings => {
    const settings = Gtk.Settings.getDefault();

    if (settings === null) {
        throw new Error("the default display has no Gtk.Settings");
    }

    return settings;
};

afterEach(() => {
    Adw.StyleManager.getDefault().setColorScheme(Adw.ColorScheme.DEFAULT);
    defaultSettings().resetProperty("gtk-interface-contrast");
});

describe("scheme media queries", () => {
    it("follows the color scheme the app asks Adwaita for", async () => {
        Adw.init();

        const className = css`
            min-width: ${LIGHT_WIDTH}px;

            @media (prefers-color-scheme: dark) {
                min-width: ${DARK_WIDTH}px;
            }
        `;

        const manager = Adw.StyleManager.getDefault();
        manager.setColorScheme(Adw.ColorScheme.FORCE_LIGHT);
        expect(await probeMinWidth([className])).toBeLessThan(DARK_WIDTH);
        manager.setColorScheme(Adw.ColorScheme.FORCE_DARK);
        expect(await probeMinWidth([className])).toBeGreaterThanOrEqual(DARK_WIDTH);
        manager.setColorScheme(Adw.ColorScheme.FORCE_LIGHT);
        expect(await probeMinWidth([className])).toBeGreaterThanOrEqual(LIGHT_WIDTH);
        expect(await probeMinWidth([className])).toBeLessThan(DARK_WIDTH);
    });

    it("follows the contrast the system reports", async () => {
        const className = css`
            min-width: ${PLAIN_WIDTH}px;

            @media (prefers-contrast: more) {
                min-width: ${CONTRAST_WIDTH}px;
            }
        `;

        expect(await probeMinWidth([className])).toBeLessThan(CONTRAST_WIDTH);
        defaultSettings().gtkInterfaceContrast = Gtk.InterfaceContrast.MORE;
        expect(await probeMinWidth([className])).toBeGreaterThanOrEqual(CONTRAST_WIDTH);
    });
});
