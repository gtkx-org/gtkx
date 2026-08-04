import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { entryUndoDemo } from "../../../src/demos/input/entry-undo.js";
import { renderDemo } from "../../test-utils.js";

const LABEL_TEXT = "Use Control+z or Control+Shift+z to undo or redo changes";

const typeIntoEntry = async (text: string): Promise<Gtk.Entry> => {
    await renderDemo(entryUndoDemo);
    const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
    await userEvent.type(entry, text);

    return entry;
};

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

    it("labels the entry with the instructional label via accessibleLabelledBy", async () => {
        await renderDemo(entryUndoDemo);
        await screen.findByText(LABEL_TEXT);
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });
        expect(screen.getByLabelText(LABEL_TEXT)).toBe(entry);
    });

    it("nests the sole entry inside a vertically-oriented box with 12px spacing", async () => {
        await renderDemo(entryUndoDemo);
        const box = await screen.findByName("entry-undo-root", { as: Gtk.Box });
        expect(box).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
        expect(box).toHaveObjectProperty("spacing", 12);
        const nested = within(box).getByRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(nested).toBe(await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX));
    });
});

describe("entryUndoDemo undo and redo", () => {
    it("undoes the typed text when Control+z is dispatched to the entry", async () => {
        const entry = await typeIntoEntry("hello");
        expect(screen.getByDisplayValue("hello")).toBe(entry);
        await userEvent.keyboard(entry, "{Control>}z{/Control}");
        expect(screen.queryByDisplayValue("hello")).toBeNull();
    });

    it("redoes the typed text when Control+Shift+z is dispatched after an undo", async () => {
        const entry = await typeIntoEntry("redo me");
        expect(screen.getByDisplayValue("redo me")).toBe(entry);
        await userEvent.keyboard(entry, "{Control>}z{/Control}");
        expect(screen.queryByDisplayValue("redo me")).toBeNull();
        await userEvent.keyboard(entry, "{Control>}{Shift>}z{/Shift}{/Control}");
        expect(screen.getByDisplayValue("redo me")).toBe(entry);
    });

    it("redoes the typed text with the Control+y accelerator after an undo", async () => {
        const entry = await typeIntoEntry("control y redo");
        expect(screen.getByDisplayValue("control y redo")).toBe(entry);
        await userEvent.keyboard(entry, "{Control>}z{/Control}");
        expect(screen.queryByDisplayValue("control y redo")).toBeNull();
        await userEvent.keyboard(entry, "{Control>}y{/Control}");
        expect(screen.getByDisplayValue("control y redo")).toBe(entry);
    });
});
