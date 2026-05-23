import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { shortcutTriggersDemo } from "../../../src/demos/gestures/shortcut-triggers.js";
import { renderDemo, screen } from "../../test-utils.js";

const countChildren = (widget: Gtk.Widget): number => {
    let count = 0;
    let child = widget.getFirstChild();
    while (child) {
        count++;
        child = child.getNextSibling();
    }
    return count;
};

const collectLabels = (widget: Gtk.Widget): string[] => {
    const labels: string[] = [];
    let child = widget.getFirstChild();
    while (child) {
        if (child instanceof Gtk.Label) labels.push(child.getLabel());
        labels.push(...collectLabels(child));
        child = child.getNextSibling();
    }
    return labels;
};

describe("shortcutTriggersDemo", () => {
    it("exposes the expected metadata", () => {
        expect(shortcutTriggersDemo.id).toBe("shortcut-triggers");
        expect(shortcutTriggersDemo.title).toBe("Shortcuts");
        expect(shortcutTriggersDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(shortcutTriggersDemo.keywords)).toBe(true);
        expect(typeof shortcutTriggersDemo.sourceCode).toBe("string");
        expect(shortcutTriggersDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(shortcutTriggersDemo.keywords).toContain("GtkShortcutController");
        expect(shortcutTriggersDemo.component).toBeTypeOf("function");
        expect(shortcutTriggersDemo.defaultWidth).toBe(200);
    });

    it("renders a ListBox containing the two instruction labels", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        expect(listBox).toBeInstanceOf(Gtk.ListBox);
        const labels = collectLabels(listBox);
        expect(labels).toEqual(expect.arrayContaining(["Press Ctrl-G", "Press X"]));
    });

    it("wraps each instruction label in a list box row", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        expect(countChildren(listBox)).toBe(2);
        let row = listBox.getFirstChild();
        while (row) {
            expect(row).toBeInstanceOf(Gtk.ListBoxRow);
            const labels = collectLabels(row);
            expect(labels.some((label) => label.startsWith("Press"))).toBe(true);
            row = row.getNextSibling();
        }
    });

    it("applies the 6px margins on the listbox container", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        expect(listBox.getMarginTop()).toBe(6);
        expect(listBox.getMarginBottom()).toBe(6);
        expect(listBox.getMarginStart()).toBe(6);
        expect(listBox.getMarginEnd()).toBe(6);
    });
});
