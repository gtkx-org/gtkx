import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listboxControlsDemo } from "../../../src/demos/lists/listbox-controls.js";
import { renderDemo } from "../../test-utils.js";

describe("listboxControlsDemo Group 1 structure", () => {
    it("renders two non-selectable list boxes that leave rows unselected on click", async () => {
        await renderDemo(listboxControlsDemo);
        const group1 = await screen.findByName("group-1-list", { as: Gtk.ListBox });
        const group2 = await screen.findByName("group-2-list", { as: Gtk.ListBox });
        expect(group1).toHaveObjectProperty("selectionMode", Gtk.SelectionMode.NONE);
        expect(group2).toHaveObjectProperty("selectionMode", Gtk.SelectionMode.NONE);
        const switchRow = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Switch/ });
        await userEvent.click(switchRow);
        expect(group1.getSelectedRow()).toBeNull();
    });

    it("renders the Group 1 and Group 2 title labels", async () => {
        await renderDemo(listboxControlsDemo);
        expect(await screen.findByText("Group 1")).toHaveTextContent("Group 1");
        expect(await screen.findByText("Group 2")).toHaveTextContent("Group 2");
    });

    it("renders the switch initially inactive", async () => {
        await renderDemo(listboxControlsDemo);
        expect(await screen.findByRole(Gtk.AccessibleRole.SWITCH, { checked: false })).not.toBeChecked();
    });

    it("renders the check button initially active", async () => {
        await renderDemo(listboxControlsDemo);
        expect(await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true })).toBeChecked();
    });

    it("renders the click-here icon initially hidden via opacity", async () => {
        await renderDemo(listboxControlsDemo);
        const clickHereImage = await screen.findByName("click-here-image", { as: Gtk.Image });
        expect(clickHereImage).toHaveObjectProperty("opacity", 0);
    });
});

describe("listboxControlsDemo direct toggles", () => {
    it("toggles the switch when clicked", async () => {
        await renderDemo(listboxControlsDemo);
        const sw = await screen.findByRole(Gtk.AccessibleRole.SWITCH, { checked: false });
        await userEvent.click(sw);
        expect(await screen.findByRole(Gtk.AccessibleRole.SWITCH, { checked: true })).toBe(sw);
    });

    it("toggles the check button when clicked", async () => {
        await renderDemo(listboxControlsDemo);
        const check = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: true });
        await userEvent.click(check);
        expect(await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: false })).toBe(check);
    });
});

describe("listboxControlsDemo row activation", () => {
    it("activating the click-here row toggles the image opacity", async () => {
        await renderDemo(listboxControlsDemo);
        const clickHereImage = await screen.findByName("click-here-image", { as: Gtk.Image });
        const clickRow = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Click here!/ });
        await userEvent.click(clickRow);
        expect(clickHereImage).toHaveObjectProperty("opacity", 1);
    });

    it("activating the switch row toggles the switch", async () => {
        await renderDemo(listboxControlsDemo);
        const switchRow = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Switch/ });
        await userEvent.click(switchRow);
        expect(await screen.findByRole(Gtk.AccessibleRole.SWITCH, { checked: true })).toBeChecked();
    });

    it("activating the check row toggles the check button off", async () => {
        await renderDemo(listboxControlsDemo);
        const checkRow = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: /Check/ });
        await userEvent.click(checkRow);
        expect(await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { checked: false })).not.toBeChecked();
    });
});

describe("listboxControlsDemo Group 2 controls", () => {
    it("renders a scale, spin button, dropdown and entry in Group 2", async () => {
        await renderDemo(listboxControlsDemo);
        const group2 = await screen.findByName("group-2-list", { as: Gtk.ListBox });
        expect(group2).toContainElement(await screen.findByName("scale", { as: Gtk.Scale }));
        expect(group2).toContainElement(await screen.findByName("spin", { as: Gtk.SpinButton }));
        expect(group2).toContainElement(await screen.findByName("dropdown", { as: Gtk.DropDown }));
        expect(group2).toContainElement(await screen.findByName("entry", { as: Gtk.Entry }));
    });

    it("seeds the scale and spin button with the expected starting value", async () => {
        await renderDemo(listboxControlsDemo);
        expect(await screen.findByName("scale", { as: Gtk.Scale })).toHaveValue(50);
        expect(await screen.findByName("spin", { as: Gtk.SpinButton })).toHaveValue(50);
    });

    it("increments the scale value when an arrow key is pressed", async () => {
        await renderDemo(listboxControlsDemo);
        const scale = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 50 }, as: Gtk.Scale });
        scale.grabFocus();
        await userEvent.keyboard(scale, "{ArrowUp}");
        expect(await screen.findByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 51 } })).toBe(scale);
    });

    it("increments the spin button value when the up arrow is pressed", async () => {
        await renderDemo(listboxControlsDemo);

        const spin = await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, {
            value: { now: 50 },
            as: Gtk.SpinButton,
        });

        spin.grabFocus();
        await userEvent.keyboard(spin, "{ArrowUp}");
        expect(await screen.findByRole(Gtk.AccessibleRole.SPIN_BUTTON, { value: { now: 51 } })).toBe(spin);
    });

    it("updates the dropdown selection when a choice is picked", async () => {
        await renderDemo(listboxControlsDemo);
        const dropdown = await screen.findByName("dropdown", { as: Gtk.DropDown });
        expect(dropdown).toHaveObjectProperty("selected", 0);
        await userEvent.selectOptions(dropdown, 2);
        expect(dropdown).toHaveObjectProperty("selected", 2);
    });

    it("accepts typed text in the entry", async () => {
        await renderDemo(listboxControlsDemo);
        const entry = await screen.findByName("entry", { as: Gtk.Entry });
        await userEvent.type(entry, "hello");
        expect(entry).toHaveDisplayValue("hello");
    });
});
