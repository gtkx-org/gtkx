import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { shortcutTriggersDemo } from "../../../src/demos/gestures/shortcut-triggers.js";
import { renderDemo } from "../../test-utils.js";

const expectShortcutLog = async (labelName: string, keys: string, message: string): Promise<void> => {
    const logSpy = vi.spyOn(console, "log").mockImplementation((): void => undefined);

    try {
        await renderDemo(shortcutTriggersDemo);
        const label = await screen.findByName(labelName, { as: Gtk.Label });
        await userEvent.keyboard(label, keys);
        expect(logSpy).toHaveBeenCalledWith(message);
    } finally {
        logSpy.mockRestore();
    }
};

describe("shortcutTriggersDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(shortcutTriggersDemo.id).toBe("shortcut-triggers");
        expect(shortcutTriggersDemo.title).toBe("Shortcuts");
        expect(shortcutTriggersDemo.description).toContain("GtkShortcut is the abstraction used by GTK");
        expect(shortcutTriggersDemo.keywords).toEqual(["GtkShortcutController"]);
        expect(shortcutTriggersDemo.sourceCode).toContain("const shortcutTriggersDemo: Demo = {");
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
        const rows = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM, { as: Gtk.ListBoxRow });
        expect(rows).toHaveLength(2);
        expect(rows[0]).toContainElement(await screen.findByName("label-ctrl-g"));
        expect(rows[1]).toContainElement(await screen.findByName("label-x"));
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
        await expectShortcutLog("label-ctrl-g", "{Control>}g{/Control}", "activated Press Ctrl-G");
    });

    it("logs the Press-X activation message when the X shortcut fires", async () => {
        await expectShortcutLog("label-x", "x", "activated Press X");
    });
});
