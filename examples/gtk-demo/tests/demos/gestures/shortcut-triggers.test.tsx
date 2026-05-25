import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { shortcutTriggersDemo } from "../../../src/demos/gestures/shortcut-triggers.js";
import { renderDemo } from "../../test-utils.js";

describe("shortcutTriggersDemo metadata", () => {
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
});

describe("shortcutTriggersDemo rendering", () => {
    it("renders the two instruction labels in the listbox", async () => {
        await renderDemo(shortcutTriggersDemo);
        expect(await screen.findByName("list-box")).toBeInstanceOf(Gtk.ListBox);
        expect(await screen.findByName("label-ctrl-g")).toBeInstanceOf(Gtk.Label);
        expect(await screen.findByName("label-x")).toBeInstanceOf(Gtk.Label);
    });

    it("wraps each instruction label in a list box row", async () => {
        await renderDemo(shortcutTriggersDemo);
        const rows = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row).toBeInstanceOf(Gtk.ListBoxRow);
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

describe("shortcutTriggersDemo activation handlers", () => {
    it("logs the Ctrl-G activation message when the Ctrl-G shortcut fires", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        try {
            await renderDemo(shortcutTriggersDemo);
            const label = (await screen.findByName("label-ctrl-g")) as Gtk.Label;
            await userEvent.keyboard(label, "{Control>}g{/Control}");
            expect(logSpy).toHaveBeenCalledWith("activated Press Ctrl-G");
        } finally {
            logSpy.mockRestore();
        }
    });

    it("logs the Press-X activation message when the X shortcut fires", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        try {
            await renderDemo(shortcutTriggersDemo);
            const label = (await screen.findByName("label-x")) as Gtk.Label;
            await userEvent.keyboard(label, "x");
            expect(logSpy).toHaveBeenCalledWith("activated Press X");
        } finally {
            logSpy.mockRestore();
        }
    });
});
