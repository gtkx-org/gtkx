import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { entryUndoDemo } from "../../../src/demos/input/entry-undo.js";
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

describe("entryUndoDemo", () => {
    it("exposes the expected metadata", () => {
        expect(entryUndoDemo.id).toBe("entry-undo");
        expect(entryUndoDemo.title).toBe("Entry/Undo and Redo");
        expect(typeof entryUndoDemo.sourceCode).toBe("string");
        expect(entryUndoDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(entryUndoDemo.component).toBeTypeOf("function");
    });

    it("renders the instructional label and entry widget", async () => {
        const { container } = await renderDemo(entryUndoDemo);
        const box = await screen.findByText("Use Control+z or Control+Shift+z to undo or redo changes");
        expect(box).toBeInstanceOf(Gtk.Box);
        const labels = findAllByType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels).toContain("Use Control+z or Control+Shift+z to undo or redo changes");
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

    it("nests the label and entry inside a vertically-oriented box", async () => {
        await renderDemo(entryUndoDemo);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        const parent = entry.getParent();
        expect(parent).toBeInstanceOf(Gtk.Box);
        expect((parent as Gtk.Box).getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect((parent as Gtk.Box).getSpacing()).toBe(12);
    });
});
