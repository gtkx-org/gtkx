import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel, GtkSwitch } from "@gtkx/jsx/gtk";
import { useTheme } from "@gtkx/navigation";
import { Page } from "./page.js";

const setDarkScheme = (isDark: boolean): void => {
    Adw.StyleManager.getDefault().setColorScheme(isDark ? Adw.ColorScheme.FORCE_DARK : Adw.ColorScheme.FORCE_LIGHT);
};

const AppearanceScreen = (): ReactNode => {
    const theme = useTheme();

    return (
        <Page>
            <GtkLabel cssClasses={["title-2"]} halign={Gtk.Align.START}>
                Appearance
            </GtkLabel>
            <GtkLabel cssClasses={["dim-label"]} halign={Gtk.Align.START} xalign={0} wrap>
                The navigation theme follows Adw.StyleManager, so useTheme() updates when the color scheme changes.
            </GtkLabel>
            <GtkLabel halign={Gtk.Align.START}>{`useTheme().dark is ${theme.dark ? "true" : "false"}`}</GtkLabel>
            <GtkBox spacing={12}>
                <GtkLabel>Dark mode</GtkLabel>
                <GtkSwitch
                    accessibleLabel="Dark mode"
                    valign={Gtk.Align.CENTER}
                    active={theme.dark}
                    onNotifyActive={(isActive) => {
                        setDarkScheme(isActive === true);
                    }}
                />
            </GtkBox>
        </Page>
    );
};

export { AppearanceScreen };
