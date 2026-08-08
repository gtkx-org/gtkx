import * as Gtk from "@gtkx/gi/gtk";
import { GtkPasswordEntry } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { getWidgetText, prettyWidget, render, screen } from "../src/index.js";
import { getWidgetTextContent } from "../src/widget-accessible-properties.js";

const SECRET = "hunter2";

const renderPasswordEntry = async (text: string): Promise<Gtk.Widget> => {
    await render(<GtkPasswordEntry name="password" text={text} />);

    return screen.findByName("password");
};

describe("password entry", () => {
    it("reads its text like any other entry", async () => {
        const entry = await renderPasswordEntry(SECRET);
        expect(getWidgetText(entry)).toBe(SECRET);
        expect(getWidgetTextContent(entry)).toContain(SECRET);
        expect(prettyWidget(entry)).toContain(SECRET);
    });

    it("reads no text when it is empty", async () => {
        const entry = await renderPasswordEntry("");
        expect(getWidgetText(entry)).toBeNull();
    });

    it("reports its text as the display value and as the selection", async () => {
        const entry = await renderPasswordEntry(SECRET);
        expect(entry).toHaveDisplayValue(SECRET);
        expect(entry).toBeInstanceOf(Gtk.Editable);

        if (entry instanceof Gtk.Editable) {
            entry.selectRegion(0, -1);
        }

        expect(entry).toHaveSelection(SECRET);
    });

    it("takes its accessible name from its text", async () => {
        await renderPasswordEntry(SECRET);
        expect(await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: SECRET })).not.toBeNull();
    });
});
