import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
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
        expect(themesDemo.description.length).toBeGreaterThan(0);
        expect(typeof themesDemo.sourceCode).toBe("string");
        expect(themesDemo.resizable).toBe(false);
        expect(themesDemo.component).toBeTypeOf("function");
    });

    it("renders the cycle toggle inside the titlebar and the body buttons", async () => {
        await renderDemo(themesDemo);
        const header = (await screen.findByName("themes-header")) as Gtk.HeaderBar;
        const cycle = within(header).getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, {
            name: "Cycle",
        }) as Gtk.ToggleButton;
        expect(cycle).not.toBePressed();
        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Hi, I am a button" })).toBeInstanceOf(
            Gtk.Button,
        );
        const destructive = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, {
            name: "Destructive",
        })) as Gtk.Button;
        expect(destructive.getCssClasses()).toContain("destructive-action");
    });

    it("opens the warning dialog and exposes the photosensitive warning text", async () => {
        const { cycle, alert } = await activateCycleAndAwaitAlert();
        expect(alert.getHeading()).toBe("Warning");
        expect(within(alert).getByText(/photosensitive/i)).not.toBeNull();
        expect(cycle).toBePressed();
    });
});

describe("themesDemo cycling lifecycle", () => {
    it("dismisses the warning dialog when accepted and keeps the cycle toggle active", async () => {
        const { cycle, alert } = await activateCycleAndAwaitAlert();
        await userEvent.click(within(alert).getByRole(Gtk.AccessibleRole.BUTTON, { name: "_OK" }));
        await waitFor(() => expect(screen.queryByName("warning-dialog")).toBeNull());
        expect(cycle).toBePressed();
    });

    it("dismisses the warning dialog when cancelled", async () => {
        const { alert } = await activateCycleAndAwaitAlert();
        await userEvent.click(within(alert).getByRole(Gtk.AccessibleRole.BUTTON, { name: "_Cancel" }));
        await waitFor(() => expect(screen.queryByName("warning-dialog")).toBeNull());
    });

    it("stops cycling and clears the cycle toggle when unchecked after acceptance", async () => {
        const { cycle, alert } = await activateCycleAndAwaitAlert();
        await userEvent.click(within(alert).getByRole(Gtk.AccessibleRole.BUTTON, { name: "_OK" }));
        await waitFor(() => expect(cycle).toBePressed());
        await userEvent.click(cycle);
        await waitFor(() => expect(cycle).not.toBePressed());
        expect(screen.queryByName("warning-dialog")).toBeNull();
    });
});
