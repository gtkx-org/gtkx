import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { textundoDemo } from "../../../src/demos/input/textundo.js";
import { renderDemo, screen } from "../../test-utils.js";

describe("textundoDemo", () => {
    it("exposes the expected metadata", () => {
        expect(textundoDemo.id).toBe("textundo");
        expect(textundoDemo.title).toBe("Text View/Undo and Redo");
        expect(textundoDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(textundoDemo.keywords)).toBe(true);
        expect(typeof textundoDemo.sourceCode).toBe("string");
        expect(textundoDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(textundoDemo.defaultWidth).toBe(330);
        expect(textundoDemo.defaultHeight).toBe(330);
        expect(textundoDemo.component).toBeTypeOf("function");
    });

    it("renders a text view with undo enabled and the introductory content", async () => {
        await renderDemo(textundoDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        expect(textView).toBeInstanceOf(Gtk.TextView);
        const buffer = textView.getBuffer();
        const text = buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
        expect(text).toContain("GtkTextView supports undo and redo");
        expect(text).toContain("Control+z");
        expect(buffer.getEnableUndo()).toBe(true);
        expect(textView.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });

    it("nests the text view inside a scrolled window with automatic scrollbar policies", async () => {
        await renderDemo(textundoDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const parent = textView.getParent();
        const sw = parent instanceof Gtk.ScrolledWindow ? parent : parent?.getParent();
        if (!(sw instanceof Gtk.ScrolledWindow)) throw new Error("expected enclosing scrolled window");
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });
});
