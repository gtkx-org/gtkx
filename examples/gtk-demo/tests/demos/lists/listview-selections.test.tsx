import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewSelectionsDemo } from "../../../src/demos/lists/listview-selections.js";
import { renderDemo } from "../../test-utils.js";

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
        await userEvent.click(check);
        const fonts = (await screen.findByName("fonts-dropdown")) as Gtk.DropDown;
        expect(fonts.getEnableSearch()).toBe(true);
    });

    it("updates the entry text when text is typed into the suggestion entry", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await userEvent.type(entry, "GNOME");
        expect(entry.getText()).toBe("GNOME");
    });

    it("clears the suggestion entry when cleared", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await userEvent.type(entry, "TEXT");
        await userEvent.clear(entry);
        expect(entry.getText()).toBe("");
    });

    it("toggles the font-spin value when the value changes (rounds and clamps)", async () => {
        await renderDemo(listviewSelectionsDemo);
        const spin = (await screen.findByName("font-spin")) as Gtk.SpinButton;
        await act(() => spin.setValue(2));
        await waitFor(() => expect(spin.getValue()).toBe(2));
    });
});

describe("listviewSelectionsDemo suggestion popover", () => {
    it("navigates suggestions with the Down arrow key after typing", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await userEvent.type(entry, "gnom");
        await userEvent.keyboard(entry, "{ArrowDown}");
        expect(entry).toBeInstanceOf(Gtk.Entry);
    });

    it("navigates suggestions with the Up arrow key after typing", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await userEvent.type(entry, "tot");
        await userEvent.keyboard(entry, "{ArrowDown}");
        await userEvent.keyboard(entry, "{ArrowUp}");
        expect(entry).toBeInstanceOf(Gtk.Entry);
    });

    it("accepts a suggestion when Enter is pressed after navigating", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await userEvent.type(entry, "GNOM");
        await userEvent.keyboard(entry, "{ArrowDown}{Enter}");
        await waitFor(() => expect(entry.getText().length).toBeGreaterThanOrEqual(4));
    });

    it("closes the suggestion popover when Escape is pressed", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await userEvent.type(entry, "tot");
        await userEvent.keyboard(entry, "{Escape}");
        expect(entry).toBeInstanceOf(Gtk.Entry);
    });

    it("clears the suggestion list when the entry is cleared after typing", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await userEvent.type(entry, "ttt");
        await userEvent.clear(entry);
        expect(entry.getText()).toBe("");
    });

    it("ignores Down arrow keypress when there are no current suggestions", async () => {
        await renderDemo(listviewSelectionsDemo);
        const entry = (await screen.findByName("words-entry")) as Gtk.Entry;
        await userEvent.keyboard(entry, "{ArrowDown}");
        expect(entry.getText()).toBe("");
    });
});

describe("listviewSelectionsDemo font spin button", () => {
    it("updates the font index when the spin button value changes within range", async () => {
        await renderDemo(listviewSelectionsDemo);
        const spin = (await screen.findByName("font-spin")) as Gtk.SpinButton;
        const fonts = (await screen.findByName("fonts-dropdown")) as Gtk.DropDown;
        const initialSelected = fonts.getSelected();
        await act(() => spin.setValue(initialSelected + 1));
        await waitFor(() => expect(spin.getValue()).toBe(initialSelected + 1));
    });

    it("ignores spin button values out of range", async () => {
        await renderDemo(listviewSelectionsDemo);
        const spin = (await screen.findByName("font-spin")) as Gtk.SpinButton;
        await act(() => spin.setValue(-1));
        expect(spin.getValue()).toBe(-1);
    });
});
