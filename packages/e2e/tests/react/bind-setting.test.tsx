import type * as Gtk from "@gtkx/gi/gtk";
import type { SettingsSchema } from "@gtkx/react/internal";
import * as Gio from "@gtkx/gi/gio";
import { GtkSwitch } from "@gtkx/jsx/gtk";
import { useBindSetting } from "@gtkx/react";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { renderSettings, resetSettingsKey } from "../helpers/settings.js";

const SCHEMA_ID = "com.gtkx.test.useSetting";

const SCHEMA: SettingsSchema<{ enabled: "b" }> = {
    id: SCHEMA_ID,
    path: null,
    keys: { enabled: "b" },
};

describe("useBindSetting", () => {
    it("keeps the bound property in sync with the settings key", async () => {
        await resetSettingsKey(SCHEMA_ID, "enabled");
        const ref = createRef<Gtk.Switch>();
        await render(<GtkSwitch ref={ref} />);
        const toggle = ref.current;
        if (toggle === null) {
            throw new Error("Switch did not mount");
        }
        const settings = await renderSettings(SCHEMA_ID);

        await renderHook(() => {
            useBindSetting({ settings, schema: SCHEMA, key: "enabled", object: toggle, property: "active" });
        });

        await act(() => {
            settings.setBoolean("enabled", true);
        });

        await waitFor(() => {
            expect(toggle.getActive()).toBe(true);
        });

        await act(() => {
            toggle.setActive(false);
        });
        expect(settings.getBoolean("enabled")).toBe(false);
        await resetSettingsKey(SCHEMA_ID, "enabled");
    });

    it("unbinds the property when the component unmounts", async () => {
        await resetSettingsKey(SCHEMA_ID, "enabled");
        const ref = createRef<Gtk.Switch>();
        await render(<GtkSwitch ref={ref} />);
        const toggle = ref.current;
        if (toggle === null) {
            throw new Error("Switch did not mount");
        }
        const settings = await renderSettings(SCHEMA_ID);

        const { unmount } = await renderHook(() => {
            useBindSetting({ settings, schema: SCHEMA, key: "enabled", object: toggle, property: "active" });
        });

        await unmount();

        await act(() => {
            settings.setBoolean("enabled", true);
        });

        expect(toggle.getActive()).toBe(false);
        await resetSettingsKey(SCHEMA_ID, "enabled");
    });

    it("keeps a GET binding from writing widget changes back to settings", async () => {
        const settings = await renderSettings(SCHEMA_ID);
        settings.reset("enabled");
        const ref = createRef<Gtk.Switch>();
        await render(<GtkSwitch ref={ref} />);
        const toggle = ref.current;
        if (toggle === null) {
            throw new Error("Switch did not mount");
        }

        await renderHook(() => {
            useBindSetting({
                settings,
                schema: SCHEMA,
                key: "enabled",
                object: toggle,
                property: "active",
                flags: Gio.SettingsBindFlags.GET,
            });
        });
        await act(() => {
            toggle.setActive(true);
        });

        expect(settings.getBoolean("enabled")).toBe(false);
        await act(() => {
            settings.setBoolean("enabled", true);
            settings.setBoolean("enabled", false);
        });
        expect(toggle.getActive()).toBe(false);
    });

    it("rejects a property the native target does not provide", async () => {
        const settings = await renderSettings(SCHEMA_ID);
        const ref = createRef<Gtk.Switch>();
        await render(<GtkSwitch ref={ref} />);

        await expect(renderHook(() => {
            useBindSetting({
                settings,
                schema: SCHEMA,
                key: "enabled",
                object: ref.current,
                property: "missingProperty",
            });
        })).rejects.toThrow();
    });
});
