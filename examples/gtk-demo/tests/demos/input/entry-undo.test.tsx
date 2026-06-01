import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { entryUndoDemo } from "../../../src/demos/input/entry-undo.js";
import { renderDemo } from "../../test-utils.js";

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
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        expect(entry).toBeInstanceOf(Gtk.Entry);
        expect(entry.getEnableUndo()).toBe(true);
    });

    it("nests the entry inside a vertically-oriented box with 12px spacing", async () => {
        await renderDemo(entryUndoDemo);
        const box = (await screen.findByName("entry-undo-root")) as Gtk.Box;
        expect(box).toBeInstanceOf(Gtk.Box);
        expect(box.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
        expect(box.getSpacing()).toBe(12);
        expect(within(box).getByRole(Gtk.AccessibleRole.TEXT_BOX)).toBeInstanceOf(Gtk.Entry);
    });

    it("undoes the typed text when Control+z is dispatched to the entry", async () => {
        await renderDemo(entryUndoDemo);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await userEvent.type(entry, "hello");
        expect(entry.getText()).toBe("hello");

        await userEvent.keyboard(entry, "{Control>}z{/Control}");
        expect(entry.getText()).toBe("");
    });

    it("redoes the typed text when Control+Shift+z is dispatched after an undo", async () => {
        await renderDemo(entryUndoDemo);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.Entry;
        await userEvent.type(entry, "redo me");
        expect(entry.getText()).toBe("redo me");

        await userEvent.keyboard(entry, "{Control>}z{/Control}");
        expect(entry.getText()).toBe("");

        await userEvent.keyboard(entry, "{Control>}{Shift>}z{/Shift}{/Control}");
        expect(entry.getText()).toBe("redo me");
    });
});
