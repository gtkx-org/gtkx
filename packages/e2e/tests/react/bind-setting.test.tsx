import type { SettingsSchema } from "@gtkx/react/internal";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { useBindSetting } from "@gtkx/react";
import { act, renderHook, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { resetSettingsKey } from "../helpers/settings.js";

const SCHEMA_ID = "com.gtkx.test.useSetting";

const SCHEMA: SettingsSchema<{ enabled: "b" }> = {
    id: SCHEMA_ID,
    path: null,
    keys: { enabled: "b" },
};

const UNDECLARED_KEY_SCHEMA: SettingsSchema<{ missing: "b" }> = {
    id: SCHEMA_ID,
    path: null,
    keys: { missing: "b" },
};

describe("useBindSetting", () => {
    it("keeps the bound property in sync with the settings key", async () => {
        resetSettingsKey(SCHEMA_ID, "enabled");
        const toggle = new Gtk.Switch();

        await renderHook(() => {
            useBindSetting({ schema: SCHEMA, key: "enabled", object: toggle, property: "active" });
        });

        const settings = Gio.Settings.new(SCHEMA_ID);

        await act(() => {
            settings.setBoolean("enabled", true);
        });

        await waitFor(() => {
            expect(toggle.getActive()).toBe(true);
        });

        resetSettingsKey(SCHEMA_ID, "enabled");
    });

    it("unbinds the property when the component unmounts", async () => {
        resetSettingsKey(SCHEMA_ID, "enabled");
        const toggle = new Gtk.Switch();

        const { unmount } = await renderHook(() => {
            useBindSetting({ schema: SCHEMA, key: "enabled", object: toggle, property: "active" });
        });

        await unmount();
        const settings = Gio.Settings.new(SCHEMA_ID);

        await act(() => {
            settings.setBoolean("enabled", true);
        });

        expect(toggle.getActive()).toBe(false);
        resetSettingsKey(SCHEMA_ID, "enabled");
    });

    it("throws when the bound key is not declared in the schema", async () => {
        const toggle = new Gtk.Switch();

        await expect(
            renderHook(() => {
                useBindSetting({ schema: UNDECLARED_KEY_SCHEMA, key: "missing", object: toggle, property: "active" });
            }),
        ).rejects.toThrow();
    });
});
