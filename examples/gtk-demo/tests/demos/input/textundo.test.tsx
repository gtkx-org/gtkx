import * as Gtk from "@gtkx/ffi/gtk";
import { act, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textundoDemo } from "../../../src/demos/input/textundo.js";
import { renderDemo } from "../../test-utils.js";

const readBufferText = (textView: Gtk.TextView): string => {
    const buffer = textView.getBuffer();
    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false) ?? "";
};

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
        const initial = readBufferText(textView);
        expect(initial).toContain("GtkTextView supports undo and redo");
        expect(initial).toContain("Control+z");
        expect(textView.getBuffer().getEnableUndo()).toBe(true);
        expect(textView.getWrapMode()).toBe(Gtk.WrapMode.WORD);
    });

    it("nests the text view inside a scrolled window with automatic scrollbar policies", async () => {
        await renderDemo(textundoDemo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });

    it("undoes a buffer edit when Control+z is dispatched to the text view", async () => {
        await renderDemo(textundoDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const before = readBufferText(textView);

        await act(() => {
            buffer.beginUserAction();
            buffer.insertAtCursor(" — appended", -1);
            buffer.endUserAction();
        });
        expect(readBufferText(textView)).toBe(`${before} — appended`);
        expect(buffer.getCanUndo()).toBe(true);

        await userEvent.keyboard(textView, "{Control>}z{/Control}");

        expect(readBufferText(textView)).toBe(before);
        expect(buffer.getCanRedo()).toBe(true);
    });

    it("redoes the previous edit when Control+Shift+z is dispatched after an undo", async () => {
        await renderDemo(textundoDemo);
        const textView = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const before = readBufferText(textView);

        await act(() => {
            buffer.beginUserAction();
            buffer.insertAtCursor(" REDO", -1);
            buffer.endUserAction();
        });
        const afterInsert = readBufferText(textView);
        await userEvent.keyboard(textView, "{Control>}z{/Control}");
        expect(readBufferText(textView)).toBe(before);

        await userEvent.keyboard(textView, "{Control>}{Shift>}z{/Shift}{/Control}");

        expect(readBufferText(textView)).toBe(afterInsert);
    });
});
