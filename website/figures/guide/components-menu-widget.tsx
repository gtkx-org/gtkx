import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkBox, GtkMenuButton, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useState } from "react";

const COLOR_SCHEMES = [
    { label: "System", scheme: Adw.ColorScheme.DEFAULT },
    { label: "Light", scheme: Adw.ColorScheme.FORCE_LIGHT },
    { label: "Dark", scheme: Adw.ColorScheme.FORCE_DARK },
];

const ThemeSelector = () => {
    const [first, setFirst] = useState<Gtk.ToggleButton | null>(null);

    return (
        <GtkBox
            cssClasses={["linked"]}
            halign={Gtk.Align.CENTER}
            marginTop={6}
            marginBottom={6}
        >
            {COLOR_SCHEMES.map(({ label, scheme }, index) => (
                <GtkToggleButton
                    key={label}
                    ref={index === 0 ? setFirst : undefined}
                    group={index === 0 ? undefined : (first ?? undefined)}
                    label={label}
                    active={index === 0}
                    onClicked={() =>
                        Adw.StyleManager.getDefault().setColorScheme(scheme)
                    }
                />
            ))}
        </GtkBox>
    );
};

export const AppMenu = () => (
    <GtkMenuButton
        iconName="open-menu-symbolic"
        tooltipText="Main Menu"
        menuModel={
            <GMenu
                items={[
                    { section: [{ custom: "theme" }] },
                    {
                        section: [
                            {
                                label: "Preferences",
                                action: "win.preferences",
                                accel: "<Control>comma",
                            },
                        ],
                    },
                ]}
            />
        }
        customChildren={{ theme: <ThemeSelector /> }}
    />
);
