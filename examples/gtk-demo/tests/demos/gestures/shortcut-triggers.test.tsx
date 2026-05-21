import * as Gtk from "@gtkx/ffi/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { shortcutTriggersDemo } from "../../../src/demos/gestures/shortcut-triggers.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

describe("shortcutTriggersDemo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(shortcutTriggersDemo, { id: "shortcut-triggers", title: "Shortcuts" });
        expect(typeof shortcutTriggersDemo.sourceCode).toBe("string");
        expect(shortcutTriggersDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(shortcutTriggersDemo.keywords).toContain("shortcut");
        expect(shortcutTriggersDemo.keywords).toContain("GtkShortcutController");
        expect(shortcutTriggersDemo.component).toBeTypeOf("function");
        expect(shortcutTriggersDemo.defaultWidth).toBe(200);
    });

    it("renders a ListBox containing the two instruction labels", async () => {
        const { container } = await renderDemo(shortcutTriggersDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        expect(listBox).toBeInstanceOf(Gtk.ListBox);
        const labels = findAllOfType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels).toEqual(expect.arrayContaining(["Press Ctrl-G", "Press X"]));
    });

    it("renders the two instruction labels inside the list box", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const labels = findAllOfType(listBox, Gtk.Label).filter((l) => l.getLabel()?.startsWith("Press"));
        expect(labels.map((l) => l.getLabel())).toEqual(expect.arrayContaining(["Press Ctrl-G", "Press X"]));
    });

    it("wraps each instruction label in a list box row", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = (await screen.findByName("list-box")) as Gtk.ListBox;
        const rows = findAllOfType(listBox, Gtk.ListBoxRow);
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            const label = findAllOfType(row, Gtk.Label)[0];
            expect(label?.getLabel()).toMatch(/^Press /);
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
