import type * as Gtk from "@gtkx/gi/gtk";
import * as Gio from "@gtkx/gi/gio";
import { GtkSwitch } from "@gtkx/jsx/gtk";
import { type SettingsSchema, useBindSetting } from "@gtkx/react";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { renderSettings, resetSettingsKey } from "../helpers/settings.js";

const SCHEMA_ID = "com.gtkx.test.useSetting";

const SCHEMA: SettingsSchema<{ enabled: "b" }> = {
    id: SCHEMA_ID,
    path: null,
    keys: { enabled: "b" },
};

const useMisspelledProperty = (settings: Gio.Settings, toggle: Gtk.Switch) =>
    // @ts-expect-error "activ" is not a property of Gtk.Switch
    useBindSetting({ settings, schema: SCHEMA, key: "enabled", object: toggle, property: "activ" });

const useReadOnlyProperty = (settings: Gio.Settings, toggle: Gtk.Switch) =>
    // @ts-expect-error "scaleFactor" is readable but not writable
    useBindSetting({ settings, schema: SCHEMA, key: "enabled", object: toggle, property: "scaleFactor" });

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

    it("binds nothing to a property the native target does not provide", async () => {
        await resetSettingsKey(SCHEMA_ID, "enabled");
        const settings = await renderSettings(SCHEMA_ID);
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
                // @ts-expect-error the type rejects a name Gtk.Switch does not declare; this exercises the runtime path
                property: "missingProperty",
            });
        });

        await act(() => {
            settings.setBoolean("enabled", true);
        });
        expect(toggle.getActive()).toBe(false);

        await act(() => {
            settings.setBoolean("enabled", false);
            toggle.setActive(true);
        });
        expect(settings.getBoolean("enabled")).toBe(false);
        await resetSettingsKey(SCHEMA_ID, "enabled");
    });

    it("accepts only the object's writable property names", () => {
        expectTypeOf(useMisspelledProperty).toBeFunction();
        expectTypeOf(useReadOnlyProperty).toBeFunction();
    });
});
