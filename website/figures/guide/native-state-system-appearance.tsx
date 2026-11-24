import { AdwActionRow } from "@gtkx/jsx/adw";
import { SettingsProvider, type SettingsSchema, useSetting } from "@gtkx/react";

const desktopInterface = {
    id: "org.gnome.desktop.interface",
    path: null,
    keys: { "monospace-font-name": "s", "color-scheme": "enum" },
    values: {
        "color-scheme": { default: 0, "prefer-dark": 1, "prefer-light": 2 },
    },
} as const satisfies SettingsSchema;

const AppearanceRows = () => {
    const [font] = useSetting(desktopInterface, "monospace-font-name");
    const [scheme] = useSetting(desktopInterface, "color-scheme");
    const prefersDark =
        scheme === desktopInterface.values["color-scheme"]["prefer-dark"];

    return (
        <>
            <AdwActionRow title="Monospace font" subtitle={font} />
            <AdwActionRow
                title="Dark style"
                subtitle={prefersDark ? "Preferred" : "Not preferred"}
            />
        </>
    );
};

export const SystemAppearance = () => (
    <SettingsProvider schema={desktopInterface}>
        <AppearanceRows />
    </SettingsProvider>
);
