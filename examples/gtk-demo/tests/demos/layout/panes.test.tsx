import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { panesDemo } from "../../../src/demos/layout/panes.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllOfType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new (...args: never[]) => T): T[] => {
    const matches: T[] = [];
    const visit = (widget: Gtk.Widget): void => {
        if (widget instanceof ctor) matches.push(widget);
        let child = widget.getFirstChild();
        while (child) {
            visit(child);
            child = child.getNextSibling();
        }
    };
    visit(root);
    return matches;
};

describe("panesDemo", () => {
    it("exposes the expected metadata", () => {
        expect(panesDemo.id).toBe("panes");
        expect(panesDemo.title).toBe("Paned Widgets");
        expect(panesDemo.description.length).toBeGreaterThan(0);
        expect(panesDemo.keywords).toEqual(expect.arrayContaining(["paned", "GtkPaned"]));
        expect(typeof panesDemo.sourceCode).toBe("string");
        expect(panesDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(panesDemo.defaultWidth).toBe(330);
        expect(panesDemo.defaultHeight).toBe(250);
        expect(panesDemo.component).toBeTypeOf("function");
    });

    it("renders the 'Hi there', 'Hello' and 'Goodbye' labels", async () => {
        if (!panesDemo.component) throw new Error("panes demo component missing");
        const { container } = await renderDemo(panesDemo.component);
        const labelTexts = findAllOfType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labelTexts).toContain("Hi there");
        expect(labelTexts).toContain("Hello");
        expect(labelTexts).toContain("Goodbye");
    });

    it("renders two GtkPaned widgets: an outer vertical and an inner horizontal", async () => {
        if (!panesDemo.component) throw new Error("panes demo component missing");
        const { container } = await renderDemo(panesDemo.component);
        const paneds = findAllOfType(container, Gtk.Paned);
        expect(paneds).toHaveLength(2);
        const orientations = paneds.map((p) => p.getOrientation());
        expect(orientations).toContain(Gtk.Orientation.VERTICAL);
        expect(orientations).toContain(Gtk.Orientation.HORIZONTAL);
    });

    it("disables shrink on both children of both GtkPaned widgets", async () => {
        if (!panesDemo.component) throw new Error("panes demo component missing");
        const { container } = await renderDemo(panesDemo.component);
        const paneds = findAllOfType(container, Gtk.Paned);
        for (const paned of paneds) {
            expect(paned.getShrinkStartChild()).toBe(false);
            expect(paned.getShrinkEndChild()).toBe(false);
        }
    });

    it("wraps the outer GtkPaned in a GtkFrame within a vertical GtkBox", async () => {
        if (!panesDemo.component) throw new Error("panes demo component missing");
        const { container } = await renderDemo(panesDemo.component);
        const frames = findAllOfType(container, Gtk.Frame);
        expect(frames).toHaveLength(1);
        const boxes = findAllOfType(container, Gtk.Box);
        expect(boxes.length).toBeGreaterThanOrEqual(1);
        const verticalBox = boxes.find((b) => b.getOrientation() === Gtk.Orientation.VERTICAL);
        expect(verticalBox).toBeDefined();
    });
});
