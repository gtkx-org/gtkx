import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listboxControlsDemo } from "../../../src/demos/lists/listbox-controls.js";
import { renderDemo } from "../../test-utils.js";

describe("listboxControlsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listboxControlsDemo.id).toBe("listbox-controls");
        expect(listboxControlsDemo.title).toBe("List Box/Controls");
        expect(listboxControlsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listboxControlsDemo.keywords)).toBe(true);
        expect(typeof listboxControlsDemo.sourceCode).toBe("string");
        expect(listboxControlsDemo.defaultHeight).toBe(400);
        expect(listboxControlsDemo.component).toBeTypeOf("function");
    });
});

describe("listboxControlsDemo Group 1 structure", () => {
    it("renders two list boxes (Group 1 and Group 2)", async () => {
        await renderDemo(listboxControlsDemo);
        const group1 = (await screen.findByName("group-1-list")) as Gtk.ListBox;
        const group2 = (await screen.findByName("group-2-list")) as Gtk.ListBox;
        expect(group1.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
        expect(group2.getSelectionMode()).toBe(Gtk.SelectionMode.NONE);
    });

    it("renders the Group 1 and Group 2 title labels", async () => {
        await renderDemo(listboxControlsDemo);
        expect(await screen.findByText(/Group 1/)).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByText(/Group 2/)).toBeInstanceOf(Gtk.Widget);
    });

    it("renders the switch initially inactive", async () => {
        await renderDemo(listboxControlsDemo);
        const sw = (await screen.findByName("switch")) as Gtk.Switch;
        expect(sw).toBeInstanceOf(Gtk.Switch);
        expect(sw.getActive()).toBe(false);
    });

    it("renders the check button initially active", async () => {
        await renderDemo(listboxControlsDemo);
        const check = (await screen.findByName("check")) as Gtk.CheckButton;
        expect(check).toBeInstanceOf(Gtk.CheckButton);
        expect(check.getActive()).toBe(true);
    });

    it("renders the click-here icon initially hidden via opacity", async () => {
        await renderDemo(listboxControlsDemo);
        const clickHereImage = (await screen.findByName("click-here-image")) as Gtk.Image;
        expect(clickHereImage).toBeInstanceOf(Gtk.Image);
        expect(clickHereImage.getOpacity()).toBe(0);
    });
});

describe("listboxControlsDemo direct toggles", () => {
    it("toggles the switch when its state-set signal fires", async () => {
        await renderDemo(listboxControlsDemo);
        const sw = (await screen.findByName("switch")) as Gtk.Switch;
        const before = sw.getActive();
        await fireEvent(sw, "state-set", !before);
        expect(sw.getActive()).toBe(!before);
    });

    it("toggles the check button when clicked", async () => {
        await renderDemo(listboxControlsDemo);
        const check = (await screen.findByName("check")) as Gtk.CheckButton;
        const before = check.getActive();
        await userEvent.click(check);
        expect(check.getActive()).toBe(!before);
    });
});

describe("listboxControlsDemo row activation", () => {
    it("activating the click-here row toggles the image opacity", async () => {
        await renderDemo(listboxControlsDemo);
        const list = (await screen.findByName("group-1-list")) as Gtk.ListBox;
        const clickHereImage = (await screen.findByName("click-here-image")) as Gtk.Image;
        const clickRow = list.getRowAtIndex(2);
        expect(clickRow).toBeInstanceOf(Gtk.ListBoxRow);
        await fireEvent(list, "row-activated", clickRow);
        expect(clickHereImage.getOpacity()).toBe(1);
    });

    it("activating the switch row toggles the switch", async () => {
        await renderDemo(listboxControlsDemo);
        const list = (await screen.findByName("group-1-list")) as Gtk.ListBox;
        const sw = (await screen.findByName("switch")) as Gtk.Switch;
        const before = sw.getActive();
        const switchRow = list.getRowAtIndex(0);
        expect(switchRow).toBeInstanceOf(Gtk.ListBoxRow);
        await fireEvent(list, "row-activated", switchRow);
        expect(sw.getActive()).toBe(!before);
    });
});

describe("listboxControlsDemo Group 2 controls", () => {
    it("renders a scale, spin button, dropdown and entry in Group 2", async () => {
        await renderDemo(listboxControlsDemo);
        expect(await screen.findByName("scale")).toBeInstanceOf(Gtk.Scale);
        expect(await screen.findByName("spin")).toBeInstanceOf(Gtk.SpinButton);
        expect(await screen.findByName("dropdown")).toBeInstanceOf(Gtk.DropDown);
        expect(await screen.findByName("entry")).toBeInstanceOf(Gtk.Entry);
    });

    it("seeds the scale and spin button with the expected starting value", async () => {
        await renderDemo(listboxControlsDemo);
        const scale = (await screen.findByName("scale")) as Gtk.Scale;
        const spin = (await screen.findByName("spin")) as Gtk.SpinButton;
        expect(scale.getValue()).toBe(50);
        expect(spin.getValue()).toBe(50);
    });
});
