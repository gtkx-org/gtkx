import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { textscrollDemo } from "../../../src/demos/input/textscroll.js";
import { renderDemo, screen, waitFor } from "../../test-utils.js";

const findTextViews = async (): Promise<Gtk.TextView[]> => {
    const widgets = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX);
    return widgets.filter((w): w is Gtk.TextView => w instanceof Gtk.TextView);
};

describe("textscrollDemo", () => {
    it("exposes the expected metadata", () => {
        expect(textscrollDemo.id).toBe("textscroll");
        expect(textscrollDemo.title).toBe("Text View/Automatic Scrolling");
        expect(textscrollDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(textscrollDemo.keywords)).toBe(true);
        expect(typeof textscrollDemo.sourceCode).toBe("string");
        expect(textscrollDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(textscrollDemo.defaultWidth).toBe(600);
        expect(textscrollDemo.defaultHeight).toBe(400);
        expect(textscrollDemo.component).toBeTypeOf("function");
    });

    it("renders two text views inside the demo", async () => {
        await renderDemo(textscrollDemo);
        const textViews = await findTextViews();
        expect(textViews).toHaveLength(2);
    });

    it("creates 'end' and 'scroll' marks in the two text view buffers", async () => {
        await renderDemo(textscrollDemo);
        const textViews = await findTextViews();
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
        await renderDemo(textscrollDemo);
        const textViews = await findTextViews();
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
