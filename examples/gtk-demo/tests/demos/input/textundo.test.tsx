import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textundoDemo } from "../../../src/demos/input/textundo.js";
import { readBufferText, renderDemo } from "../../test-utils.js";

type EditedTextView = {
    textView: Gtk.TextView;
    buffer: Gtk.TextBuffer;
    before: string;
};

const renderTextView = async (): Promise<Gtk.TextView> => {
    await renderDemo(textundoDemo);

    return await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
};

const renderAndInsert = async (insertedText: string): Promise<EditedTextView> => {
    const textView = await renderTextView();
    const buffer = textView.getBuffer();
    const before = readBufferText(textView);
    await userEvent.type(textView, insertedText);

    return { textView, buffer, before };
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

    it("renders a text view with the introductory content and word wrap", async () => {
        const textView = await renderTextView();
        const initial = readBufferText(textView);
        expect(initial).toContain("GtkTextView supports undo and redo");
        expect(initial).toContain("Control+z");
        expect(textView).toHaveObjectProperty("wrapMode", Gtk.WrapMode.WORD);
    });

    it("nests the text view inside the named scrolled window with automatic scrollbar policies", async () => {
        await renderDemo(textundoDemo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const textView = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        expect(textView.isAncestor(sw)).toBe(true);
        const [hpolicy, vpolicy] = sw.getPolicy();
        expect(hpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
        expect(vpolicy).toBe(Gtk.PolicyType.AUTOMATIC);
    });
});

describe("textundoDemo undo and redo", () => {
    it("undoes a buffer edit when Control+z is dispatched to the text view", async () => {
        const { textView, buffer, before } = await renderAndInsert(" — appended");
        expect(screen.getByDisplayValue(`${before} — appended`)).toBe(textView);
        expect(buffer).toHaveObjectProperty("canUndo", true);
        await userEvent.keyboard(textView, "{Control>}z{/Control}");
        expect(screen.getByDisplayValue(before)).toBe(textView);
        expect(buffer).toHaveObjectProperty("canRedo", true);
    });

    it("redoes the previous edit when Control+Shift+z is dispatched after an undo", async () => {
        const { textView, before } = await renderAndInsert(" REDO");
        const afterInsert = readBufferText(textView);
        await userEvent.keyboard(textView, "{Control>}z{/Control}");
        expect(screen.getByDisplayValue(before)).toBe(textView);
        await userEvent.keyboard(textView, "{Control>}{Shift>}z{/Shift}{/Control}");
        expect(screen.getByDisplayValue(afterInsert)).toBe(textView);
    });

    it("redoes the previous edit via the alternate Control+y shortcut after an undo", async () => {
        const { textView, before } = await renderAndInsert(" ALT-REDO");
        const afterInsert = readBufferText(textView);
        await userEvent.keyboard(textView, "{Control>}z{/Control}");
        expect(screen.getByDisplayValue(before)).toBe(textView);
        await userEvent.keyboard(textView, "{Control>}y{/Control}");
        expect(screen.getByDisplayValue(afterInsert)).toBe(textView);
    });
});
