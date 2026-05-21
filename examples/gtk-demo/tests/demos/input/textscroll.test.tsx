import * as Gtk from "@gtkx/ffi/gtk";
import { waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textscrollDemo } from "../../../src/demos/input/textscroll.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllByType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new () => T): T[] => {
    const results: T[] = [];
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) results.push(node as T);
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return results;
};

describe("textscrollDemo", () => {
    it("exposes the expected metadata", () => {
        expect(textscrollDemo.id).toBe("textscroll");
        expect(textscrollDemo.title).toBe("Text View/Automatic Scrolling");
        expect(typeof textscrollDemo.sourceCode).toBe("string");
        expect(textscrollDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(textscrollDemo.keywords).toContain("scroll");
        expect(textscrollDemo.defaultWidth).toBe(600);
        expect(textscrollDemo.defaultHeight).toBe(400);
        expect(textscrollDemo.component).toBeTypeOf("function");
    });

    it("renders two text views nested in two scrolled windows wrapped by a homogeneous box", async () => {
        const { container } = await renderDemo(textscrollDemo);
        const textViews = findAllByType(container, Gtk.TextView);
        expect(textViews).toHaveLength(2);
        const scrolledWindows = findAllByType(container, Gtk.ScrolledWindow);
        expect(scrolledWindows.length).toBeGreaterThanOrEqual(2);
        const homogeneousBox = findAllByType(container, Gtk.Box).find(
            (b) => b.getHomogeneous() && b.getSpacing() === 6,
        );
        expect(homogeneousBox).toBeInstanceOf(Gtk.Box);
    });

    it("creates 'end' and 'scroll' marks in the two text view buffers", async () => {
        const { container } = await renderDemo(textscrollDemo);
        const textViews = findAllByType(container, Gtk.TextView);
        expect(textViews).toHaveLength(2);
        const markNames = ["end", "scroll"];
        const found = textViews.map((tv) => {
            const buffer = tv.getBuffer();
            return markNames.filter((name) => buffer.getMark(name) !== null);
        });
        const flatNames = found.flat().sort();
        expect(flatNames).toEqual(["end", "scroll"]);
    });

    it("appends text to the buffers as scroll ticks run", async () => {
        const { container } = await renderDemo(textscrollDemo);
        const textViews = findAllByType(container, Gtk.TextView);
        await waitFor(() => {
            for (const view of textViews) {
                const buffer = view.getBuffer();
                const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false) ?? "";
                const expected = text.includes("Scroll to end") || text.includes("Scroll to bottom");
                expect(expected).toBe(true);
            }
        });
    });
});
