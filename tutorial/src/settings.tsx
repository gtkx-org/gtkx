import * as Adw from "@gtkx/gi/adw";
import type * as Gio from "@gtkx/gi/gio";
import { t } from "@gtkx/i18n";
import { GSettings } from "@gtkx/jsx/gio";
import { createPortal, rootElement } from "@gtkx/react";
import { createContext, type ReactNode, use, useState } from "react";
import schema from "../data/dev.gtkx.Notes.gschema.xml";

type ColorScheme = (typeof schema.values)["color-scheme"][number];

const COLOR_SCHEMES: Record<ColorScheme, { label: () => string; value: Adw.ColorScheme }> = {
    default: { label: () => t("Follow System"), value: Adw.ColorScheme.DEFAULT },
    light: { label: () => t("Light"), value: Adw.ColorScheme.FORCE_LIGHT },
    dark: { label: () => t("Dark"), value: Adw.ColorScheme.FORCE_DARK },
};

const colorSchemeItems = (): { id: ColorScheme; value: string }[] =>
    schema.values["color-scheme"].map((id) => ({ id, value: COLOR_SCHEMES[id].label() }));

const toColorScheme = (id: string | null): ColorScheme | undefined =>
    schema.values["color-scheme"].find((scheme) => scheme === id);

const SettingsContext = createContext<Gio.Settings | null>(null);

const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<Gio.Settings | null>(null);

    return (
        <>
            {createPortal(<GSettings ref={setSettings} schemaId={schema.id} />, rootElement)}
            {settings !== null && <SettingsContext value={settings}>{children}</SettingsContext>}
        </>
    );
};

const useAppSettings = (): Gio.Settings => {
    const settings = use(SettingsContext);
    if (settings === null) {
        throw new Error("SettingsProvider is required");
    }

    return settings;
};

export { COLOR_SCHEMES, type ColorScheme, colorSchemeItems, schema, SettingsProvider, toColorScheme, useAppSettings };
