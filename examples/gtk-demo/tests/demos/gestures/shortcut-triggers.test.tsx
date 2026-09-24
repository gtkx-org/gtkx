import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { shortcutTriggersDemo } from "../../../src/demos/gestures/shortcut-triggers.js";
import { renderDemo } from "../../test-utils.js";

describe("shortcutTriggersDemo rendering", () => {
    it("renders the two instruction labels in the listbox", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = await screen.findByName("list-box", { as: Gtk.ListBox });
        expect(within(listBox).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(2);
        expect(listBox).toHaveObjectProperty("selectionMode", Gtk.SelectionMode.NONE);
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

    it("applies the 6px margins around the shortcut list", async () => {
        await renderDemo(shortcutTriggersDemo);
        const listBox = await screen.findByName("list-box", { as: Gtk.ListBox });
        const container = listBox.getParent();
        expect(container).toHaveObjectProperty("marginTop", 6);
        expect(container).toHaveObjectProperty("marginBottom", 6);
        expect(container).toHaveObjectProperty("marginStart", 6);
        expect(container).toHaveObjectProperty("marginEnd", 6);
    });
});

describe("shortcutTriggersDemo activation", () => {
    it.each([
        ["label-ctrl-g", "{Control>}g{/Control}", "Ctrl-G activated"],
        ["label-x", "x", "X activated"],
    ] as const)("reports the %s shortcut visibly", async (labelName, keys, status) => {
        await renderDemo(shortcutTriggersDemo);
        const label = await screen.findByName(labelName);
        await userEvent.keyboard(label, keys);
        expect(await screen.findByRole(Gtk.AccessibleRole.STATUS)).toHaveTextContent(status);
    });
});
