import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewSelectionsDemo } from "../../../src/demos/lists/listview-selections.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAllOfType } from "../../helpers/traverse.js";

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
        await renderDemo(listviewSelectionsDemo);
        expect(await screen.findByText("Dropdowns")).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByText("Suggestions")).toBeInstanceOf(Gtk.Widget);
    });

    it("renders four GtkDropDowns (times, sectioned-times, fonts, devices)", async () => {
        const { container } = await renderDemo(listviewSelectionsDemo);
        const dropdowns = findAllOfType(container, Gtk.DropDown);
        expect(dropdowns.length).toBe(4);
    });

    it("renders three suggestion entries (words, directory, destination)", async () => {
        const { container } = await renderDemo(listviewSelectionsDemo);
        const entries = findAllOfType(container, Gtk.Entry);
        expect(entries.length).toBe(3);
    });

    it("renders a vertical separator between the two columns", async () => {
        await renderDemo(listviewSelectionsDemo);
        const sep = (await screen.findByName("column-separator")) as Gtk.Separator;
        expect(sep).toBeInstanceOf(Gtk.Separator);
        expect(sep.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });

    it("renders MenuButton suggestion poppers next to entries", async () => {
        const { container } = await renderDemo(listviewSelectionsDemo);
        const menus = findAllOfType(container, Gtk.MenuButton);
        expect(menus.length).toBeGreaterThanOrEqual(3);
    });
});

describe("listviewSelectionsDemo controls", () => {
    it("renders the Enable Search check button initially inactive", async () => {
        await renderDemo(listviewSelectionsDemo);
        const check = (await screen.findByName("enable-search-check")) as Gtk.CheckButton;
        expect(check).toBeInstanceOf(Gtk.CheckButton);
        expect(check.getLabel()).toBe("Enable search");
        expect(check.getActive()).toBe(false);
    });

    it("renders a GtkSpinButton synced with the font index", async () => {
        await renderDemo(listviewSelectionsDemo);
        const spin = (await screen.findByName("font-spin")) as Gtk.SpinButton;
        expect(spin).toBeInstanceOf(Gtk.SpinButton);
        expect(spin.getValue()).toBe(0);
    });

    it("toggles enable-search on the fonts dropdown when the check button is toggled", async () => {
        await renderDemo(listviewSelectionsDemo);
        const check = (await screen.findByName("enable-search-check")) as Gtk.CheckButton;
        await act(() => check.setActive(true));
        await fireEvent(check, "toggled");
        const fonts = (await screen.findByName("fonts-dropdown")) as Gtk.DropDown;
        expect(fonts.getEnableSearch()).toBe(true);
    });

    it("updates the entry text when text is typed into the suggestion entry", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await act(() => entry.setText("GNOME"));
        await fireEvent(entry, "changed");
        const refreshed = (await screen.findByName("words-entry")) as Gtk.Entry;
        expect(refreshed.getText()).toBe("GNOME");
    });
});
