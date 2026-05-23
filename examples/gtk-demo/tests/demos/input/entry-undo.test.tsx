import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { entryUndoDemo } from "../../../src/demos/input/entry-undo.js";
import { renderDemo, screen, userEvent } from "../../test-utils.js";

describe("entryUndoDemo", () => {
    it("exposes the expected metadata", () => {
        expect(entryUndoDemo.id).toBe("entry-undo");
        expect(entryUndoDemo.title).toBe("Entry/Undo and Redo");
        expect(entryUndoDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(entryUndoDemo.keywords)).toBe(true);
        expect(typeof entryUndoDemo.sourceCode).toBe("string");
        expect(entryUndoDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(entryUndoDemo.component).toBeTypeOf("function");
    });

    it("renders the instructional label and entry widget", async () => {
        await renderDemo(entryUndoDemo);
        const box = await screen.findByText("Use Control+z or Control+Shift+z to undo or redo changes");
        expect(box).toBeInstanceOf(Gtk.Box);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect((entry as Gtk.Entry).getEnableUndo()).toBe(true);
    });

    it("accepts typed text into the entry", async () => {
        await renderDemo(entryUndoDemo);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await userEvent.type(entry, "hello");
        expect(entry.getText()).toBe("hello");
    });

    it("nests the entry inside a vertically-oriented box", async () => {
        await renderDemo(entryUndoDemo);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        const parent = entry.getParent();
        expect(parent).toBeInstanceOf(Gtk.Box);
        expect((parent as Gtk.Box).getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect((parent as Gtk.Box).getSpacing()).toBe(12);
    });
});
