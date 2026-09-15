import type * as Gio from "@gtkx/gi/gio";
import { GSettings } from "@gtkx/jsx/gio";
import { createPortal, rootElement } from "@gtkx/react";
import { createContext, type ReactNode, use, useState } from "react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";

const SettingsContext = createContext<Gio.Settings | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<Gio.Settings | null>(null);

    return (
        <>
            {createPortal(<GSettings ref={setSettings} schemaId={schema.id} />, rootElement)}
            {settings !== null && <SettingsContext value={settings}>{children}</SettingsContext>}
        </>
    );
};

export const useAppSettings = (): Gio.Settings => {
    const settings = use(SettingsContext);
    if (settings === null) {
        throw new Error("SettingsProvider is required");
    }

    return settings;
};
