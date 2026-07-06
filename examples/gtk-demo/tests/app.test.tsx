import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication } from "@gtkx/jsx/gtk";
import { createRootElement } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { Demo } from "../src/app.js";
import { findInactiveSearchToggle } from "./test-utils.js";

let nextAppId = 0;

const renderDemo = () =>
    render(
        <GtkApplication applicationId={`org.gtkx.gtkdemoapp${nextAppId++}`} flags={Gio.ApplicationFlags.NON_UNIQUE}>
            <Demo />
        </GtkApplication>,
        { container: createRootElement() },
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
        const run = (await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Run" })) as Gtk.Button;
        expect(run.getSensitive()).toBe(false);
    });

    it("renders a search toggle in the header bar", async () => {
        await renderDemo();
        await findInactiveSearchToggle();
    });

    it("renders the sidebar with the intro demo entry", async () => {
        await renderDemo();
        const entries = await screen.findAllByText("GTK Demo");
        expect(entries.length).toBeGreaterThan(0);
    });

    it("renders a menu button in the header bar", async () => {
        await renderDemo();
        const menuButton = (await screen.findByName("menu-button")) as Gtk.MenuButton;
        expect(menuButton).toBeInstanceOf(Gtk.MenuButton);
    });

    it("renders the notebook with two pages", async () => {
        await renderDemo();
        const notebook = (await screen.findByName("notebook")) as Gtk.Notebook;
        expect(notebook).toBeInstanceOf(Gtk.Notebook);
        expect(notebook.getNPages()).toBe(2);
    });
});
