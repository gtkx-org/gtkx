import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { createAppRenderer } from "./render-app.js";

const renderDemo = createAppRenderer("org.gtkx.gtkdemoapp");

describe("App", () => {
    it("renders the main window titled 'GTK Demo'", async () => {
        await renderDemo();

        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, {
            name: "GTK Demo",
            as: Gtk.ApplicationWindow,
        });

        expect(window).toBeRooted();
        expect(window.getApplication()?.getApplicationId()).toMatch(/^org\.gtkx\.gtkdemoapp\d+$/);
    });

    it("renders the Info notebook tab label", async () => {
        await renderDemo();
        const notebook = await screen.findByName("notebook", { as: Gtk.Notebook });
        expect(notebook).toContainOneByText("Info");
    });

    it("starts with the Run button disabled because the intro demo has no component", async () => {
        await renderDemo();
        const run = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run", as: Gtk.Button });
        expect(run).toBeDisabled();
    });

    it("renders a search toggle in the header bar", async () => {
        await renderDemo();
        const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Search" });
        expect(toggle).not.toBePressed();
    });

    it("renders the sidebar with the intro demo entry", async () => {
        await renderDemo();
        const sidebar = await screen.findByName("sidebar-list", { as: Gtk.ListView });
        expect(sidebar).toContainOneByText("GTK Demo");
    });

    it("renders a menu button in the header bar", async () => {
        await renderDemo();
        const menuButton = await screen.findByName("menu-button", { as: Gtk.MenuButton });
        expect(menuButton).toBeEnabled();
        expect(menuButton.getMenuModel()).not.toBeNull();
    });

    it("renders the notebook with two pages", async () => {
        await renderDemo();
        expect(await screen.findAllByRole(Gtk.AccessibleRole.TAB)).toHaveLength(2);
    });
});
