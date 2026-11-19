import type * as Gio from "@gtkx/gi/gio";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GSettings } from "@gtkx/jsx/gio";
import {
    createPortal,
    rootElement,
    type SettingsSchema,
    useSetting,
} from "@gtkx/react";
import { useState } from "react";

const desktopInterface = {
    id: "org.gnome.desktop.interface",
    path: null,
    keys: { "monospace-font-name": "s", "color-scheme": "enum" },
    values: {
        "color-scheme": { default: 0, "prefer-dark": 1, "prefer-light": 2 },
    },
} as const satisfies SettingsSchema;

const AppearanceRows = ({ settings }: { settings: Gio.Settings }) => {
    const [font] = useSetting(
        settings,
        desktopInterface,
        "monospace-font-name",
    );
    const [scheme] = useSetting(settings, desktopInterface, "color-scheme");
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

export const SystemAppearance = () => {
    const [settings, setSettings] = useState<Gio.Settings | null>(null);

    return (
        <>
            {createPortal(
                <GSettings ref={setSettings} schemaId={desktopInterface.id} />,
                rootElement,
            )}
            {settings !== null && <AppearanceRows settings={settings} />}
        </>
    );
};
