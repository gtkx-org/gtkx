import * as Gtk from "@gtkx/gi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { panesDemo } from "../../../src/demos/layout/panes.js";
import { renderDemo } from "../../test-utils.js";

describe("panesDemo content", () => {
    it("renders the 'Hi there', 'Hello' and 'Goodbye' labels", async () => {
        await renderDemo(panesDemo);
        expect(await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Hi there" })).toHaveTextContent("Hi there");
        expect(await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Hello" })).toHaveTextContent("Hello");
        expect(await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Goodbye" })).toHaveTextContent("Goodbye");
    });
});

describe("panesDemo structure", () => {
    it("places the 'Hi there'/'Hello' labels in a horizontal inner paned", async () => {
        await renderDemo(panesDemo);
        const innerPaned = await screen.findByName("panes-inner", { as: Gtk.Paned });
        expect(innerPaned).toHaveObjectProperty("orientation", Gtk.Orientation.HORIZONTAL);
        expect(innerPaned).toContainOneByRole(Gtk.AccessibleRole.LABEL, { name: "Hi there" });
        expect(innerPaned).toContainOneByRole(Gtk.AccessibleRole.LABEL, { name: "Hello" });
    });

    it("places the inner paned and 'Goodbye' inside a vertical outer paned", async () => {
        await renderDemo(panesDemo);
        const outerPaned = await screen.findByName("panes-outer", { as: Gtk.Paned });
        const innerPaned = await screen.findByName("panes-inner", { as: Gtk.Paned });
        expect(outerPaned).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
        expect(outerPaned).toContainElement(innerPaned);
        expect(outerPaned).toContainOneByRole(Gtk.AccessibleRole.LABEL, { name: "Goodbye" });
    });

    it("disables shrink on both children of both panes", async () => {
        await renderDemo(panesDemo);
        const outerPaned = await screen.findByName("panes-outer", { as: Gtk.Paned });
        const innerPaned = await screen.findByName("panes-inner", { as: Gtk.Paned });

        for (const paned of [innerPaned, outerPaned]) {
            expect(paned).toHaveObjectProperty("shrinkStartChild", false);
            expect(paned).toHaveObjectProperty("shrinkEndChild", false);
        }
    });

    it("wraps the outer pane in a GtkFrame inside a vertical GtkBox", async () => {
        await renderDemo(panesDemo);
        const outerPaned = await screen.findByName("panes-outer", { as: Gtk.Paned });
        const frame = await screen.findByName("panes-frame", { as: Gtk.Frame });
        const box = await screen.findByName("panes-root", { as: Gtk.Box });
        expect(frame).toContainElement(outerPaned);
        expect(box).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
        expect(box).toContainElement(frame);
    });
});
