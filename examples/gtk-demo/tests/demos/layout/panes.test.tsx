import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { panesDemo } from "../../../src/demos/layout/panes.js";
import { renderDemo } from "../../test-utils.js";

const findLabel = async (text: string): Promise<Gtk.Label> =>
    (await screen.findByRole(Gtk.AccessibleRole.LABEL, { name: text })) as Gtk.Label;

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
        expect((await findLabel("Hi there")).getLabel()).toBe("Hi there");
        expect((await findLabel("Hello")).getLabel()).toBe("Hello");
        expect((await findLabel("Goodbye")).getLabel()).toBe("Goodbye");
    });
});

describe("panesDemo structure", () => {
    it("places the 'Hi there'/'Hello' labels in a horizontal inner paned", async () => {
        await renderDemo(panesDemo);
        const hiThere = await findLabel("Hi there");
        const hello = await findLabel("Hello");
        const innerPaned = hiThere.getParent();
        expect(innerPaned).toBeInstanceOf(Gtk.Paned);
        expect(hello.getParent()).toBe(innerPaned);
        expect((innerPaned as Gtk.Paned).getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
    });

    it("places the inner paned and 'Goodbye' in a vertical outer paned", async () => {
        await renderDemo(panesDemo);
        const hiThere = await findLabel("Hi there");
        const goodbye = await findLabel("Goodbye");
        const innerPaned = hiThere.getParent();
        const outerPaned = goodbye.getParent();
        expect(outerPaned).toBeInstanceOf(Gtk.Paned);
        expect(innerPaned?.getParent()).toBe(outerPaned);
        expect((outerPaned as Gtk.Paned).getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });

    it("disables shrink on both children of both panes", async () => {
        await renderDemo(panesDemo);
        const hiThere = await findLabel("Hi there");
        const innerPaned = hiThere.getParent() as Gtk.Paned;
        const outerPaned = innerPaned.getParent() as Gtk.Paned;
        for (const paned of [innerPaned, outerPaned]) {
            expect(paned.getShrinkStartChild()).toBe(false);
            expect(paned.getShrinkEndChild()).toBe(false);
        }
    });

    it("wraps the outer pane in a GtkFrame inside a vertical GtkBox", async () => {
        await renderDemo(panesDemo);
        const goodbye = await findLabel("Goodbye");
        const outerPaned = goodbye.getParent();
        const frame = outerPaned?.getParent();
        const box = frame?.getParent();
        expect(frame).toBeInstanceOf(Gtk.Frame);
        expect(box).toBeInstanceOf(Gtk.Box);
        expect((box as Gtk.Box).getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });
});
