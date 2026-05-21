import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { fixed2Demo } from "../../../src/demos/layout/fixed2.js";
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

describe("fixed2Demo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(fixed2Demo.id).toBe("fixed2");
        expect(fixed2Demo.title).toBe("Fixed Layout / Transformations");
        expect(fixed2Demo.description.length).toBeGreaterThan(0);
        expect(fixed2Demo.keywords).toEqual(
            expect.arrayContaining([
                "fixed",
                "transform",
                "GskTransform",
                "GdkFrameClock",
                "addTickCallback",
                "animation",
            ]),
        );
        expect(typeof fixed2Demo.sourceCode).toBe("string");
        expect(fixed2Demo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(fixed2Demo.defaultWidth).toBe(400);
        expect(fixed2Demo.defaultHeight).toBe(300);
        expect(fixed2Demo.component).toBeTypeOf("function");
    });
});

describe("fixed2Demo structure", () => {
    it("renders the 'All fixed?' label inside the GtkFixed container", async () => {
        if (!fixed2Demo.component) throw new Error("fixed2 demo component missing");
        const { container } = await renderDemo(fixed2Demo.component);
        const labels = findAllOfType(container, Gtk.Label).filter((l) => l.getLabel() === "All fixed?");
        expect(labels).toHaveLength(1);
        const [label] = labels;
        if (!label) throw new Error("expected label");
        expect(label.getParent()).toBeInstanceOf(Gtk.Fixed);
    });

    it("nests the GtkFixed inside a hexpand+vexpand GtkScrolledWindow", async () => {
        if (!fixed2Demo.component) throw new Error("fixed2 demo component missing");
        const { container } = await renderDemo(fixed2Demo.component);
        const scrolled = findAllOfType(container, Gtk.ScrolledWindow);
        expect(scrolled).toHaveLength(1);
        const sw = scrolled[0];
        if (!sw) throw new Error("expected scrolled window");
        expect(sw.getHexpand()).toBe(true);
        expect(sw.getVexpand()).toBe(true);
        const fixed = findAllOfType(sw, Gtk.Fixed);
        expect(fixed).toHaveLength(1);
    });
});

describe("fixed2Demo configuration", () => {
    it("configures the GtkFixed with visible overflow and expand flags", async () => {
        if (!fixed2Demo.component) throw new Error("fixed2 demo component missing");
        const { container } = await renderDemo(fixed2Demo.component);
        const [fixed] = findAllOfType(container, Gtk.Fixed);
        if (!fixed) throw new Error("expected GtkFixed");
        expect(fixed.getOverflow()).toBe(Gtk.Overflow.VISIBLE);
        expect(fixed.getHexpand()).toBe(true);
        expect(fixed.getVexpand()).toBe(true);
    });

    it("places exactly one widget as a child of the GtkFixed", async () => {
        if (!fixed2Demo.component) throw new Error("fixed2 demo component missing");
        const { container } = await renderDemo(fixed2Demo.component);
        const [fixed] = findAllOfType(container, Gtk.Fixed);
        if (!fixed) throw new Error("expected GtkFixed");
        let count = 0;
        let child = fixed.getFirstChild();
        while (child) {
            count++;
            child = child.getNextSibling();
        }
        expect(count).toBe(1);
    });
});
