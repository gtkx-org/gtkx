import type { SettingsSchema } from "@gtkx/react/internal";
import type { ReactNode } from "react";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkSwitch } from "@gtkx/jsx/gtk";
import { useBindSetting } from "@gtkx/react";
import { act, render, renderHook, waitFor } from "@gtkx/testing";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { resetSettingsKey } from "../helpers/settings.js";

const SCHEMA_ID = "com.gtkx.test.useSetting";

const SCHEMA: SettingsSchema<{ enabled: "b" }> = {
    id: SCHEMA_ID,
    path: null,
    keys: { enabled: "b" },
};

function RefBindingProbe({ revision, instances }: { revision: string; instances: Gtk.Switch[] }): ReactNode {
    const target = useRef<Gtk.Switch | null>(null);
    useBindSetting({ schema: SCHEMA, key: "enabled", object: target, property: "active" });

    return (
        <GtkSwitch
            key={revision}
            ref={(toggle) => {
                target.current = toggle;

                if (toggle !== null && instances.at(-1) !== toggle) {
                    instances.push(toggle);
                }
            }}
        />
    );
}

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
});

describe("useBindSetting (ref replacement)", () => {
    it("moves a binding to a keyed replacement host", async () => {
        resetSettingsKey(SCHEMA_ID, "enabled");
        const instances: Gtk.Switch[] = [];
        const settings = Gio.Settings.new(SCHEMA_ID);
        const { rerender } = await render(<RefBindingProbe revision="first" instances={instances} />);

        await act(() => {
            settings.setBoolean("enabled", true);
        });

        await rerender(<RefBindingProbe revision="second" instances={instances} />);
        const [first, second] = instances;

        if (first === undefined || second === undefined) {
            throw new TypeError("expected both switch instances");
        }

        expect(second.getActive()).toBe(true);

        await act(() => {
            settings.setBoolean("enabled", false);
        });

        await waitFor(() => {
            expect(second.getActive()).toBe(false);
        });

        expect(first.getActive()).toBe(true);
        resetSettingsKey(SCHEMA_ID, "enabled");
    });
});
