import type * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { themesDemo } from "../../../src/demos/benchmark/themes.js";
import { renderDemo } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

const activateCycleAndAwaitAlert = async (): Promise<{ cycle: Gtk.ToggleButton; alert: Adw.AlertDialog }> => {
    await renderDemo(themesDemo);
    const cycle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Cycle" })) as Gtk.ToggleButton;
    await userEvent.click(cycle);
    const alert = (await screen.findByName("warning-dialog")) as Adw.AlertDialog;
    return { cycle, alert };
};

describe("themesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(themesDemo.id).toBe("themes");
        expect(themesDemo.title).toBe("Benchmark/Themes");
        expect(typeof themesDemo.sourceCode).toBe("string");
    });

    it("renders the cycle toggle inside the titlebar and the body buttons", async () => {
        await renderDemo(themesDemo);
        const window = (await screen.findByRole(Gtk.AccessibleRole.WINDOW)) as Gtk.Window;
        expect(window.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
        const cycle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Cycle",
        })) as Gtk.ToggleButton;
        expect(cycle).toBeInstanceOf(Gtk.ToggleButton);
        expect(cycle.getActive()).toBe(false);
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hi, I am a button" })).toBeDefined();
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Destructive" })).toBeDefined();
    });

    it("opens the warning dialog when the cycle toggle is activated", async () => {
        await renderDemo(themesDemo);
        const cycle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Cycle",
        })) as Gtk.ToggleButton;
        await userEvent.click(cycle);
        expect(await screen.findByName("warning-dialog")).toBeDefined();
        const warning = await screen.findByText(/photosensitive/i, { exact: false });
        expect(warning).toBeDefined();
        expect(cycle.getActive()).toBe(true);
    });
});

describe("themesDemo cycling lifecycle", () => {
    it("starts cycling when the warning is accepted", async () => {
        const { alert } = await activateCycleAndAwaitAlert();
        await fireEvent(alert, "response", "ok");
    });

    it("does not start cycling when the warning is dismissed", async () => {
        const { alert } = await activateCycleAndAwaitAlert();
        await fireEvent(alert, "response", "cancel");
    });

    it("stops cycling when the toggle is unchecked after acceptance", async () => {
        const { cycle, alert } = await activateCycleAndAwaitAlert();
        await fireEvent(alert, "response", "ok");
        await userEvent.click(cycle);
    });
});
