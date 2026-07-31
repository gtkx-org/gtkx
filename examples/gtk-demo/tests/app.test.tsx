import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { Demo } from "../src/app.js";
import { createApplicationIdFactory } from "./test-utils.js";

const nextApplicationId = createApplicationIdFactory("org.gtkx.gtkdemoapp");

const renderDemo = () =>
    render(
        <GtkApplication applicationId={nextApplicationId()} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <Demo />
        </GtkApplication>,
        { container: rootElement },
    );

describe("App", () => {
    it("renders the main window titled 'GTK Demo'", async () => {
        await renderDemo();
        const window = await screen.findByRole(Gtk.AccessibleRole.WINDOW, { name: "GTK Demo" });
        expect(window).toBeInstanceOf(Gtk.ApplicationWindow);
    });

    it("renders the Info notebook tab label", async () => {
        await renderDemo();
        const labels = await screen.findAllByText("Info");
        expect(labels.length).toBeGreaterThanOrEqual(1);
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
        const entries = await screen.findAllByText("GTK Demo");
        expect(entries.length).toBeGreaterThan(0);
    });

    it("renders a menu button in the header bar", async () => {
        await renderDemo();
        const menuButton = await screen.findByName("menu-button", { as: Gtk.MenuButton });
        expect(menuButton).toBeInstanceOf(Gtk.MenuButton);
    });

    it("renders the notebook with two pages", async () => {
        await renderDemo();
        expect(await screen.findAllByRole(Gtk.AccessibleRole.TAB)).toHaveLength(2);
    });
});
