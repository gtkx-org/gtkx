import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewSelectionsDemo } from "../../../src/demos/lists/listview-selections.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findFirst } from "./helpers.js";

describe("listviewSelectionsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewSelectionsDemo, { id: "listview-selections", title: "Lists/Selections" });
        expect(typeof listviewSelectionsDemo.sourceCode).toBe("string");
        expect(listviewSelectionsDemo.keywords).toContain("dropdown");
        expect(listviewSelectionsDemo.keywords).toContain("selection");
        expect(listviewSelectionsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewSelectionsDemo layout", () => {
    it("renders Dropdowns and Suggestions section titles", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const titles = findAll(container, Gtk.Label).map((l) => l.getLabel());
        expect(titles).toContain("Dropdowns");
        expect(titles).toContain("Suggestions");
    });

    it("renders four GtkDropDowns (times, sectioned-times, fonts, devices)", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const dropdowns = findAll(container, Gtk.DropDown);
        expect(dropdowns.length).toBe(4);
    });

    it("renders three suggestion entries (words, directory, destination)", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const entries = findAll(container, Gtk.Entry);
        expect(entries.length).toBe(3);
    });

    it("renders a vertical separator between the two columns", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const sep = findFirst(container, Gtk.Separator);
        expect(sep).toBeInstanceOf(Gtk.Separator);
        expect(sep?.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });

    it("renders MenuButton suggestion poppers next to entries", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const menus = findAll(container, Gtk.MenuButton);
        expect(menus.length).toBeGreaterThanOrEqual(3);
    });
});

describe("listviewSelectionsDemo controls", () => {
    it("renders the Enable Search check button initially inactive", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const check = findFirst(container, Gtk.CheckButton);
        expect(check).toBeInstanceOf(Gtk.CheckButton);
        expect(check?.getLabel()).toBe("Enable search");
        expect(check?.getActive()).toBe(false);
    });

    it("renders a GtkSpinButton synced with the font index", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const spin = findFirst(container, Gtk.SpinButton);
        expect(spin).toBeInstanceOf(Gtk.SpinButton);
        expect(spin?.getValue()).toBe(0);
    });

    it("toggles enable-search on the fonts dropdown when the check button is toggled", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const check = findFirst(container, Gtk.CheckButton);
        if (!check) throw new Error("check button not found");
        check.setActive(true);
        await fireEvent(check as Gtk.Widget, "toggled");
        const dropdowns = findAll(container, Gtk.DropDown);
        const enableSearchValues = dropdowns.map((d) => d.getEnableSearch());
        expect(enableSearchValues.some((v) => v === true)).toBe(true);
    });

    it("updates the entry text when text is typed into the suggestion entry", async () => {
        if (!listviewSelectionsDemo.component) throw new Error("listview-selections demo component missing");
        const { container } = await renderDemo(listviewSelectionsDemo.component);
        const entry = findFirst(container, Gtk.Entry);
        if (!entry) throw new Error("entry not found");
        entry.setText("GNOME");
        await fireEvent(entry as Gtk.Widget, "changed");
        const refreshedEntry = findFirst(container, Gtk.Entry);
        expect(refreshedEntry?.getText()).toBe("GNOME");
    });
});
