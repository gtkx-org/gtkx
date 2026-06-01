import * as Gtk from "@gtkx/gi/gtk";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { App } from "../src/app.js";

describe("App", () => {
    it("renders the main window titled 'GTK Demo'", async () => {
        await render(<App />, { wrapper: false });
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "GTK Demo" });
        expect(window).toBeInstanceOf(Gtk.ApplicationWindow);
    });

    it("renders the Info notebook tab label", async () => {
        await render(<App />, { wrapper: false });
        await screen.findByText("Info");
    });

    it("starts with the Run button disabled because the intro demo has no component", async () => {
        await render(<App />, { wrapper: false });
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        expect(run.getSensitive()).toBe(false);
    });

    it("renders a search toggle in the header bar", async () => {
        await render(<App />, { wrapper: false });
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
        expect(toggle.getActive()).toBe(false);
    });

    it("renders the sidebar with the intro demo entry", async () => {
        await render(<App />, { wrapper: false });
        const entries = await screen.findAllByText("GTK Demo");
        expect(entries.length).toBeGreaterThan(0);
    });

    it("renders a menu button in the header bar", async () => {
        await render(<App />, { wrapper: false });
        const menuButton = (await screen.findByName("menu-button")) as Gtk.MenuButton;
        expect(menuButton).toBeInstanceOf(Gtk.MenuButton);
    });

    it("renders the notebook with two pages", async () => {
        await render(<App />, { wrapper: false });
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        expect(notebook).toBeInstanceOf(Gtk.Notebook);
        expect(notebook.getNPages()).toBe(2);
    });
});
