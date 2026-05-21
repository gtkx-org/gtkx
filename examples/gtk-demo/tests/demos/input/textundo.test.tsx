import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { textundoDemo } from "../../../src/demos/input/textundo.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findTextView = (root: Gtk.Widget): Gtk.TextView | null => {
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof Gtk.TextView) return node;
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return null;
};

const findScrolledWindow = (root: Gtk.Widget): Gtk.ScrolledWindow | null => {
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof Gtk.ScrolledWindow) return node;
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return null;
};

describe("textundoDemo", () => {
    it("exposes the expected metadata", () => {
        expect(textundoDemo.id).toBe("textundo");
        expect(textundoDemo.title).toBe("Text View/Undo and Redo");
        expect(typeof textundoDemo.sourceCode).toBe("string");
        expect(textundoDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(textundoDemo.keywords).toContain("undo");
        expect(textundoDemo.keywords).toContain("redo");
        expect(textundoDemo.defaultWidth).toBe(330);
        expect(textundoDemo.defaultHeight).toBe(330);
        expect(textundoDemo.component).toBeTypeOf("function");
    });

    it("renders a text view with undo enabled and the introductory content", async () => {
        const { container } = await renderDemo(textundoDemo);
        const textView = findTextView(container);
        expect(textView).toBeInstanceOf(Gtk.TextView);
        const view = textView as Gtk.TextView;
        const buffer = view.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("GtkTextView supports undo and redo");
        expect(text).toContain("Control+z");
        expect(buffer.getEnableUndo()).toBe(true);
        expect(view.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });

    it("nests the text view inside a scrolled window with automatic scrollbar policies", async () => {
        const { container } = await renderDemo(textundoDemo);
        const sw = findScrolledWindow(container) as Gtk.ScrolledWindow;
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });
});
