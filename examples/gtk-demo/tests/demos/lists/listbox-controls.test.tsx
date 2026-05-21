import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listboxControlsDemo } from "../../../src/demos/lists/listbox-controls.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { ancestorOfType, findAll, findFirst } from "./helpers.js";

describe("listboxControlsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listboxControlsDemo, { id: "listbox-controls", title: "List Box/Controls" });
        expect(typeof listboxControlsDemo.sourceCode).toBe("string");
        expect(listboxControlsDemo.keywords).toContain("listbox");
        expect(listboxControlsDemo.keywords).toContain("controls");
        expect(listboxControlsDemo.defaultHeight).toBe(400);
        expect(listboxControlsDemo.component).toBeTypeOf("function");
    });
});

describe("listboxControlsDemo Group 1 structure", () => {
    it("renders two list boxes (Group 1 and Group 2)", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const lists = findAll(container, Gtk.ListBox);
        expect(lists.length).toBe(2);
        for (const list of lists) {
            expect(list.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
        }
    });

    it("renders the Group 1 and Group 2 title labels", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const labelTexts = findAll(container, Gtk.Label).map((l) => l.getLabel());
        expect(labelTexts).toContain("Group 1");
        expect(labelTexts).toContain("Group 2");
    });

    it("renders the switch initially inactive", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const sw = findFirst(container, Gtk.Switch);
        expect(sw).toBeInstanceOf(Gtk.Switch);
        expect(sw?.getActive()).toBe(false);
    });

    it("renders the check button initially active", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const check = findFirst(container, Gtk.CheckButton);
        expect(check).toBeInstanceOf(Gtk.CheckButton);
        expect(check?.getActive()).toBe(true);
    });

    it("renders the click-here icon initially hidden via opacity", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const images = findAll(container, Gtk.Image);
        const clickHereImage = images.find((i) => i.getIconName() === "object-select-symbolic");
        expect(clickHereImage).toBeInstanceOf(Gtk.Image);
        expect(clickHereImage?.getOpacity()).toBe(0);
    });
});

describe("listboxControlsDemo direct toggles", () => {
    it("toggles the switch when its state-set signal fires", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const sw = findFirst(container, Gtk.Switch);
        if (!sw) throw new Error("switch not found");
        const before = sw.getActive();
        await fireEvent(sw as Gtk.Widget, "state-set", !before);
        const after = findFirst(container, Gtk.Switch)?.getActive();
        expect(after).toBe(!before);
    });

    it("toggles the check button when toggled", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const check = findFirst(container, Gtk.CheckButton);
        if (!check) throw new Error("check button not found");
        const before = check.getActive();
        await fireEvent(check as Gtk.Widget, "toggled");
        const after = findFirst(container, Gtk.CheckButton)?.getActive();
        expect(after).toBe(!before);
    });
});

describe("listboxControlsDemo row activation", () => {
    it("activating the click-here row toggles the image opacity", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const clickHereImage = findAll(container, Gtk.Image).find((i) => i.getIconName() === "object-select-symbolic");
        if (!clickHereImage) throw new Error("click-here image not found");
        const clickRow = ancestorOfType(clickHereImage, Gtk.ListBoxRow);
        const list = clickRow?.getParent() as Gtk.ListBox | null;
        if (!clickRow || !list) throw new Error("click-here row / list not found");
        await fireEvent(list as Gtk.Widget, "row-activated", clickRow);
        const updatedImage = findAll(container, Gtk.Image).find((i) => i.getIconName() === "object-select-symbolic");
        expect(updatedImage?.getOpacity()).toBe(1);
    });

    it("activating the switch row toggles the switch", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const sw = findFirst(container, Gtk.Switch);
        if (!sw) throw new Error("switch not found");
        const before = sw.getActive();
        const switchRow = ancestorOfType(sw, Gtk.ListBoxRow);
        const list = switchRow?.getParent() as Gtk.ListBox | null;
        if (!switchRow || !list) throw new Error("switch row / list not found");
        await fireEvent(list as Gtk.Widget, "row-activated", switchRow);
        const after = findFirst(container, Gtk.Switch)?.getActive();
        expect(after).toBe(!before);
    });
});

describe("listboxControlsDemo Group 2 controls", () => {
    it("renders a scale, spin button, dropdown and entry in Group 2", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        expect(findFirst(container, Gtk.Scale)).toBeInstanceOf(Gtk.Scale);
        expect(findFirst(container, Gtk.SpinButton)).toBeInstanceOf(Gtk.SpinButton);
        expect(findFirst(container, Gtk.DropDown)).toBeInstanceOf(Gtk.DropDown);
        expect(findFirst(container, Gtk.Entry)).toBeInstanceOf(Gtk.Entry);
    });

    it("seeds the scale and spin button with the expected starting value", async () => {
        if (!listboxControlsDemo.component) throw new Error("listbox-controls demo component missing");
        const { container } = await renderDemo(listboxControlsDemo.component);
        const scale = findFirst(container, Gtk.Scale);
        const spin = findFirst(container, Gtk.SpinButton);
        expect(scale?.getValue()).toBe(50);
        expect(spin?.getValue()).toBe(50);
    });
});
