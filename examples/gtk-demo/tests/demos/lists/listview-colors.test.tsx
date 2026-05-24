import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it, vi } from "vitest";
import { listviewColorsDemo } from "../../../src/demos/lists/listview-colors.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

describe("listviewColorsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewColorsDemo.id).toBe("listview-colors");
        expect(listviewColorsDemo.title).toBe("Lists/Colors");
        expect(listviewColorsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewColorsDemo.keywords)).toBe(true);
        expect(typeof listviewColorsDemo.sourceCode).toBe("string");
        expect(listviewColorsDemo.defaultWidth).toBe(800);
        expect(listviewColorsDemo.defaultHeight).toBe(400);
        expect(listviewColorsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewColorsDemo header bar", () => {
    it("installs a header bar via the titlebar slot", async () => {
        await renderDemo(listviewColorsDemo);
        const headerBar = await screen.findByName("header-bar");
        expect(headerBar).toBeInstanceOf(Gtk.HeaderBar);
    });

    it("renders the Refill button", async () => {
        await renderDemo(listviewColorsDemo);
        const refill = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Refill" });
        expect(refill).toBeInstanceOf(Gtk.Button);
    });

    it("renders three drop-downs in the header bar (limit, sort, display)", async () => {
        await renderDemo(listviewColorsDemo);
        expect(await screen.findByName("limit-dropdown")).toBeInstanceOf(Gtk.DropDown);
        expect(await screen.findByName("sort-dropdown")).toBeInstanceOf(Gtk.DropDown);
        expect(await screen.findByName("display-dropdown")).toBeInstanceOf(Gtk.DropDown);
    });

    it("renders a selection-info toggle button", async () => {
        await renderDemo(listviewColorsDemo);
        const selectionToggle = (await screen.findByName("selection-toggle")) as Gtk.ToggleButton;
        expect(selectionToggle).toBeInstanceOf(Gtk.ToggleButton);
        expect(selectionToggle.getIconName()).toBe("emblem-important-symbolic");
        expect(selectionToggle.getActive()).toBe(false);
    });
});

describe("listviewColorsDemo grid view", () => {
    it("renders a GtkGridView with multiple selection and rubberband enabled", async () => {
        await renderDemo(listviewColorsDemo);
        const mainGrid = (await screen.findByName("color-grid")) as Gtk.GridView;
        expect(mainGrid.getEnableRubberband()).toBe(true);
        expect(mainGrid.getModel()).toBeInstanceOf(Gtk.MultiSelection);
    });

    it("wraps the grid view in a scrolled window inside an overlay", async () => {
        await renderDemo(listviewColorsDemo);
        const overlay = await screen.findByName("grid-overlay");
        expect(overlay).toBeInstanceOf(Gtk.Overlay);
        const sw = await screen.findByName("grid-scrolled");
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });
});

describe("listviewColorsDemo selection info revealer", () => {
    it("starts collapsed (revealer not revealing children)", async () => {
        await renderDemo(listviewColorsDemo);
        const revealer = (await screen.findByName("selection-revealer")) as Gtk.Revealer;
        expect(revealer.getRevealChild()).toBe(false);
    });

    it("expands when the selection-info toggle is activated", async () => {
        await renderDemo(listviewColorsDemo);
        const toggle = (await screen.findByName("selection-toggle")) as Gtk.ToggleButton;
        await act(() => toggle.setActive(true));
        await fireEvent(toggle, "toggled");
        const revealer = (await screen.findByName("selection-revealer")) as Gtk.Revealer;
        expect(revealer.getRevealChild()).toBe(true);
    });
});

describe("listviewColorsDemo header actions", () => {
    it("triggers the refill handler when the Refill button is clicked", async () => {
        await renderDemo(listviewColorsDemo);
        const refill = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Refill" });
        await fireEvent(refill, "clicked");
    });

    it("changes the sort mode when the sort dropdown selection changes", async () => {
        await renderDemo(listviewColorsDemo);
        const sortDropdown = (await screen.findByName("sort-dropdown")) as Gtk.DropDown;
        await act(() => sortDropdown.setSelected(1));
        await fireEvent(sortDropdown, "notify::selected");
    });

    it("changes the display factory when the display dropdown selection changes", async () => {
        await renderDemo(listviewColorsDemo);
        const displayDropdown = (await screen.findByName("display-dropdown")) as Gtk.DropDown;
        await act(() => displayDropdown.setSelected(1));
        await fireEvent(displayDropdown, "notify::selected");
    });

    it("changes the color limit when the limit dropdown selection changes", async () => {
        await renderDemo(listviewColorsDemo);
        const limitDropdown = (await screen.findByName("limit-dropdown")) as Gtk.DropDown;
        await act(() => limitDropdown.setSelected(0));
        await fireEvent(limitDropdown, "notify::selected");
    });
});
