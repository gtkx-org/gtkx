import * as Gtk from "@gtkx/ffi/gtk";
import { screen, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { panesDemo } from "../../../src/demos/layout/panes.js";
import { renderDemo } from "../../test-utils.js";

describe("panesDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(panesDemo.id).toBe("panes");
        expect(panesDemo.title).toBe("Paned Widgets");
        expect(panesDemo.description.length).toBeGreaterThan(0);
        expect(panesDemo.keywords).toEqual([]);
        expect(typeof panesDemo.sourceCode).toBe("string");
        expect(panesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(panesDemo.defaultWidth).toBe(330);
        expect(panesDemo.defaultHeight).toBe(250);
        expect(panesDemo.component).toBeTypeOf("function");
    });
});

describe("panesDemo content", () => {
    it("renders the 'Hi there', 'Hello' and 'Goodbye' labels", async () => {
        await renderDemo(panesDemo);
        expect(await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Hi there" })).toBeInstanceOf(Gtk.Label);
        expect(await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Hello" })).toBeInstanceOf(Gtk.Label);
        expect(await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: "Goodbye" })).toBeInstanceOf(Gtk.Label);
    });
});

describe("panesDemo structure", () => {
    it("places the 'Hi there'/'Hello' labels in a horizontal inner paned", async () => {
        await renderDemo(panesDemo);
        const innerPaned = (await screen.findByName("panes-inner")) as Gtk.Paned;
        expect(innerPaned).toBeInstanceOf(Gtk.Paned);
        expect(innerPaned.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
        expect(within(innerPaned).getByRole(Gtk.AccessibleRole.LABEL, { name: "Hi there" })).toBeInstanceOf(Gtk.Label);
        expect(within(innerPaned).getByRole(Gtk.AccessibleRole.LABEL, { name: "Hello" })).toBeInstanceOf(Gtk.Label);
    });

    it("places the inner paned and 'Goodbye' inside a vertical outer paned", async () => {
        await renderDemo(panesDemo);
        const outerPaned = (await screen.findByName("panes-outer")) as Gtk.Paned;
        expect(outerPaned).toBeInstanceOf(Gtk.Paned);
        expect(outerPaned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(within(outerPaned).getByName("panes-inner")).toBeInstanceOf(Gtk.Paned);
        expect(within(outerPaned).getByRole(Gtk.AccessibleRole.LABEL, { name: "Goodbye" })).toBeInstanceOf(Gtk.Label);
    });

    it("disables shrink on both children of both panes", async () => {
        await renderDemo(panesDemo);
        const outerPaned = (await screen.findByName("panes-outer")) as Gtk.Paned;
        const innerPaned = (await screen.findByName("panes-inner")) as Gtk.Paned;
        for (const paned of [innerPaned, outerPaned]) {
            expect(paned.getShrinkStartChild()).toBe(false);
            expect(paned.getShrinkEndChild()).toBe(false);
        }
    });

    it("wraps the outer pane in a GtkFrame inside a vertical GtkBox", async () => {
        await renderDemo(panesDemo);
        const frame = (await screen.findByName("panes-frame")) as Gtk.Frame;
        expect(frame).toBeInstanceOf(Gtk.Frame);
        expect(within(frame).getByName("panes-outer")).toBeInstanceOf(Gtk.Paned);
        const box = (await screen.findByName("panes-root")) as Gtk.Box;
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(box.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(within(box).getByName("panes-frame")).toBeInstanceOf(Gtk.Frame);
    });
});
