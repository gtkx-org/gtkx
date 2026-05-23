import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { panesDemo } from "../../../src/demos/layout/panes.js";
import { renderDemo } from "../../test-utils.js";

interface PanesLayout {
    box: Gtk.Box;
    frame: Gtk.Frame;
    outerPaned: Gtk.Paned;
    innerPaned: Gtk.Paned;
    helloLabel: Gtk.Label;
    hiThereLabel: Gtk.Label;
    goodbyeLabel: Gtk.Label;
}

const resolvePanesLayout = (window: Gtk.Window): PanesLayout => {
    const box = window.getChild();
    if (!(box instanceof Gtk.Box)) throw new Error("expected window child to be a Box");
    const frame = box.getFirstChild();
    if (!(frame instanceof Gtk.Frame)) throw new Error("expected box child to be a Frame");
    const outerPaned = frame.getChild();
    if (!(outerPaned instanceof Gtk.Paned)) throw new Error("expected frame child to be a Paned");
    const innerPaned = outerPaned.getStartChild();
    if (!(innerPaned instanceof Gtk.Paned)) throw new Error("expected outer paned start child to be a Paned");
    const hiThereLabel = innerPaned.getStartChild();
    const helloLabel = innerPaned.getEndChild();
    const goodbyeLabel = outerPaned.getEndChild();
    if (
        !(hiThereLabel instanceof Gtk.Label) ||
        !(helloLabel instanceof Gtk.Label) ||
        !(goodbyeLabel instanceof Gtk.Label)
    ) {
        throw new Error("expected paned children to be Labels");
    }
    return { box, frame, outerPaned, innerPaned, helloLabel, hiThereLabel, goodbyeLabel };
};

describe("panesDemo", () => {
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

    it("renders the 'Hi there', 'Hello' and 'Goodbye' labels", async () => {
        const { window } = await renderDemo(panesDemo);
        if (!window.current) throw new Error("expected window ref");
        const layout = resolvePanesLayout(window.current);
        expect(layout.hiThereLabel.getLabel()).toBe("Hi there");
        expect(layout.helloLabel.getLabel()).toBe("Hello");
        expect(layout.goodbyeLabel.getLabel()).toBe("Goodbye");
    });

    it("renders two GtkPaned widgets: an outer vertical and an inner horizontal", async () => {
        const { window } = await renderDemo(panesDemo);
        if (!window.current) throw new Error("expected window ref");
        const layout = resolvePanesLayout(window.current);
        expect(layout.outerPaned.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(layout.innerPaned.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
    });

    it("disables shrink on both children of both GtkPaned widgets", async () => {
        const { window } = await renderDemo(panesDemo);
        if (!window.current) throw new Error("expected window ref");
        const layout = resolvePanesLayout(window.current);
        for (const paned of [layout.outerPaned, layout.innerPaned]) {
            expect(paned.getShrinkStartChild()).toBe(false);
            expect(paned.getShrinkEndChild()).toBe(false);
        }
    });

    it("wraps the outer GtkPaned in a GtkFrame within a vertical GtkBox", async () => {
        const { window } = await renderDemo(panesDemo);
        if (!window.current) throw new Error("expected window ref");
        const layout = resolvePanesLayout(window.current);
        expect(layout.frame).toBeInstanceOf(Gtk.Frame);
        expect(layout.box).toBeInstanceOf(Gtk.Box);
        expect(layout.box.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });
});
