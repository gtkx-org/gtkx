import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { render, screen } from "./test-utils.js";

describe("App", () => {
    it("renders the main window titled 'GTK Demo'", async () => {
        await render(<App />, { wrapper: false });
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "GTK Demo" });
        expect(window).toBeInstanceOf(Gtk.ApplicationWindow);
    });

    it("renders the Info notebook tab label", async () => {
        await render(<App />, { wrapper: false });
        expect(await screen.findByText("Info")).toBeDefined();
    });

    it("starts with the Run button disabled because the intro demo has no component", async () => {
        await render(<App />, { wrapper: false });
        const run = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" });
        expect((run as Gtk.Button).getSensitive()).toBe(false);
    });

    it("renders a search toggle in the header bar", async () => {
        await render(<App />, { wrapper: false });
        const toggles = await screen.findAllByRole(Gtk.AccessibleRole.TOGGLE_BUTTON);
        expect(toggles.length).toBeGreaterThan(0);
    });

    it("renders the sidebar with the intro demo entry", async () => {
        await render(<App />, { wrapper: false });
        const entries = await screen.findAllByText("GTK Demo");
        expect(entries.length).toBeGreaterThan(0);
    });
});
