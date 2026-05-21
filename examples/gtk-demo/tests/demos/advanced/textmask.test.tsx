import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { textmaskDemo } from "../../../src/demos/advanced/textmask.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";

const findFirstDrawingArea = (root: Gtk.Widget): Gtk.DrawingArea | null => {
    if (root instanceof Gtk.DrawingArea) return root;
    let child = root.getFirstChild();
    while (child) {
        const found = findFirstDrawingArea(child);
        if (found) return found;
        child = child.getNextSibling();
    }
    return null;
};

describe("textmaskDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(textmaskDemo, { id: "textmask", title: "Pango/Text Mask" });
        expect(typeof textmaskDemo.sourceCode).toBe("string");
        expect(textmaskDemo.defaultWidth).toBe(600);
        expect(textmaskDemo.defaultHeight).toBe(400);
        expect(textmaskDemo.keywords).toContain("cairo");
        expect(textmaskDemo.keywords).toContain("pango");
    });

    it("renders a GtkDrawingArea with the configured size requests", async () => {
        const { container } = await renderDemo(textmaskDemo);
        const area = findFirstDrawingArea(container);
        expect(area).toBeInstanceOf(Gtk.DrawingArea);
        const [w, h] = area?.getSizeRequest() ?? [0, 0];
        expect(w).toBe(400);
        expect(h).toBe(240);
    });
});
