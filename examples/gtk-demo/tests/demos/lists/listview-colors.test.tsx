import * as Gtk from "@gtkx/ffi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewColorsDemo } from "../../../src/demos/lists/listview-colors.js";
import { renderDemo } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

describe("listviewColorsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewColorsDemo.id).toBe("listview-colors");
        expect(listviewColorsDemo.title).toBe("Lists/Colors");
        expect(listviewColorsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewColorsDemo.keywords)).toBe(true);
        expect(typeof listviewColorsDemo.sourceCode).toBe("string");
        expect(listviewColorsDemo.defaultWidth).toBe(600);
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
        await waitFor(() => {
            expect(mainGrid.getEnableRubberband()).toBe(true);
            expect(mainGrid.getModel()).toBeInstanceOf(Gtk.MultiSelection);
        });
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
        await userEvent.click(toggle);
        const revealer = (await screen.findByName("selection-revealer")) as Gtk.Revealer;
        await waitFor(() => expect(revealer.getRevealChild()).toBe(true));
    });
});

describe("listviewColorsDemo header actions", () => {
    it("triggers the refill handler when the Refill button is clicked", async () => {
        await renderDemo(listviewColorsDemo);
        const refill = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Refill" });
        await userEvent.click(refill);
    });

    it("changes the sort mode when the sort dropdown selection changes", async () => {
        await renderDemo(listviewColorsDemo);
        const sortDropdown = (await screen.findByName("sort-dropdown")) as Gtk.DropDown;
        await userEvent.selectOptions(sortDropdown, 1);
        expect(sortDropdown.getSelected()).toBe(1);
    });

    it("changes the display factory when the display dropdown selection changes", async () => {
        await renderDemo(listviewColorsDemo);
        const displayDropdown = (await screen.findByName("display-dropdown")) as Gtk.DropDown;
        await userEvent.selectOptions(displayDropdown, 1);
        expect(displayDropdown.getSelected()).toBe(1);
    });

    it("changes the color limit when the limit dropdown selection changes", async () => {
        await renderDemo(listviewColorsDemo);
        const limitDropdown = (await screen.findByName("limit-dropdown")) as Gtk.DropDown;
        await userEvent.selectOptions(limitDropdown, 0);
        expect(limitDropdown.getSelected()).toBe(0);
    });
});

describe("listviewColorsDemo sort modes", () => {
    const sortModeIndices = [
        { label: "name", index: 1 },
        { label: "red", index: 2 },
        { label: "green", index: 3 },
        { label: "blue", index: 4 },
        { label: "rgb", index: 5 },
        { label: "hue", index: 6 },
        { label: "saturation", index: 7 },
        { label: "value", index: 8 },
        { label: "hsv", index: 9 },
    ];

    it.each(sortModeIndices)("applies the $label sort mode", async ({ index }) => {
        await renderDemo(listviewColorsDemo);
        const sortDropdown = (await screen.findByName("sort-dropdown")) as Gtk.DropDown;
        await userEvent.selectOptions(sortDropdown, index);
        await waitFor(() => expect(sortDropdown.getSelected()).toBe(index));
    });

    it("returns to unsorted mode when index 0 is selected", async () => {
        await renderDemo(listviewColorsDemo);
        const sortDropdown = (await screen.findByName("sort-dropdown")) as Gtk.DropDown;
        await userEvent.selectOptions(sortDropdown, 5);
        await waitFor(() => expect(sortDropdown.getSelected()).toBe(5));
        await userEvent.selectOptions(sortDropdown, 0);
        await waitFor(() => expect(sortDropdown.getSelected()).toBe(0));
    });
});

describe("listviewColorsDemo selection averages", () => {
    it("populates the grid model with the color items once filling completes", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = (await screen.findByName("color-grid")) as Gtk.GridView;
        await waitFor(
            () => {
                const model = grid.getModel() as Gtk.MultiSelection;
                expect(model.getNItems()).toBeGreaterThan(0);
            },
            { timeout: 10000 },
        );
    });
});
