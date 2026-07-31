import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
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
        const listBox = await screen.findByName("list-box", { as: Gtk.ListBox });
        expect(within(listBox).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(2);
        expect(await screen.findByName("label-ctrl-g")).toHaveTextContent("Press Ctrl-G");
        expect(await screen.findByName("label-x")).toHaveTextContent("Press X");
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
        const listBox = await screen.findByName("list-box", { as: Gtk.ListBox });
        expect(listBox).toHaveObjectProperty("marginTop", 6);
        expect(listBox).toHaveObjectProperty("marginBottom", 6);
        expect(listBox).toHaveObjectProperty("marginStart", 6);
        expect(listBox).toHaveObjectProperty("marginEnd", 6);
    });
});

describe("shortcutTriggersDemo activation handlers", () => {
    it("logs the Ctrl-G activation message when the Ctrl-G shortcut fires", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation((): void => undefined);

        try {
            await renderDemo(shortcutTriggersDemo);
            const label = await screen.findByName("label-ctrl-g", { as: Gtk.Label });
            await userEvent.keyboard(label, "{Control>}g{/Control}");
            expect(logSpy).toHaveBeenCalledWith("activated Press Ctrl-G");
        } finally {
            logSpy.mockRestore();
        }
    });

    it("logs the Press-X activation message when the X shortcut fires", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation((): void => undefined);

        try {
            await renderDemo(shortcutTriggersDemo);
            const label = await screen.findByName("label-x", { as: Gtk.Label });
            await userEvent.keyboard(label, "x");
            expect(logSpy).toHaveBeenCalledWith("activated Press X");
        } finally {
            logSpy.mockRestore();
        }
    });
});
