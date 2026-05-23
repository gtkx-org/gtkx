import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewSelectionsDemo } from "../../../src/demos/lists/listview-selections.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

describe("listviewSelectionsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewSelectionsDemo.id).toBe("listview-selections");
        expect(listviewSelectionsDemo.title).toBe("Lists/Selections");
        expect(listviewSelectionsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewSelectionsDemo.keywords)).toBe(true);
        expect(typeof listviewSelectionsDemo.sourceCode).toBe("string");
        expect(listviewSelectionsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewSelectionsDemo layout", () => {
    it("renders Dropdowns and Suggestions section titles", async () => {
        await renderDemo(listviewSelectionsDemo);
        expect(await screen.findByText("Dropdowns")).toBeInstanceOf(Gtk.Widget);
        expect(await screen.findByText("Suggestions")).toBeInstanceOf(Gtk.Widget);
    });

    it("renders the fonts and column-separator widgets", async () => {
        await renderDemo(listviewSelectionsDemo);
        const fonts = (await screen.findByName("fonts-dropdown")) as Gtk.DropDown;
        expect(fonts).toBeInstanceOf(Gtk.DropDown);
        const sep = (await screen.findByName("column-separator")) as Gtk.Separator;
        expect(sep).toBeInstanceOf(Gtk.Separator);
        expect(sep.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });

    it("renders a vertical separator between the two columns", async () => {
        await renderDemo(listviewSelectionsDemo);
        const sep = (await screen.findByName("column-separator")) as Gtk.Separator;
        expect(sep).toBeInstanceOf(Gtk.Separator);
        expect(sep.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
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
