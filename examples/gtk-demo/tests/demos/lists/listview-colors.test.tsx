import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewColorsDemo } from "../../../src/demos/lists/listview-colors.js";
import { renderDemo } from "../../test-utils.js";

vi.setConfig({ testTimeout: 30000 });

interface ColorLike {
    name: string;
    r: number;
    g: number;
    b: number;
    h: number;
    s: number;
    v: number;
}

const colorAt = (model: Gtk.MultiSelection, index: number): ColorLike => {
    const obj = model.getItem(index);
    if (!obj) throw new Error(`no color item at index ${index}`);
    return Reflect.get(obj, "colorItem") as ColorLike;
};

const findGrid = async (): Promise<Gtk.GridView> => (await screen.findByName("color-grid")) as Gtk.GridView;
const gridModel = (grid: Gtk.GridView): Gtk.MultiSelection => grid.getModel() as Gtk.MultiSelection;

const SORT_TEST_LIMIT = 64;

const prepareSortableModel = async (model: Gtk.MultiSelection): Promise<void> => {
    const limitDropdown = (await screen.findByName("limit-dropdown")) as Gtk.DropDown;
    await userEvent.selectOptions(limitDropdown, 1);
    await waitFor(() => expect(model.getNItems()).toBe(SORT_TEST_LIMIT), { timeout: 20000 });
};

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
    it("hosts the refill button and the three drop-downs inside the header bar", async () => {
        await renderDemo(listviewColorsDemo);
        const headerBar = (await screen.findByName("header-bar")) as Gtk.HeaderBar;
        await within(headerBar).findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Refill" });
        await within(headerBar).findByName("limit-dropdown");
        await within(headerBar).findByName("sort-dropdown");
        await within(headerBar).findByName("display-dropdown");
    });

    it("maps each drop-down's initial selection to demo state", async () => {
        await renderDemo(listviewColorsDemo);
        const limit = (await screen.findByName("limit-dropdown")) as Gtk.DropDown;
        const sort = (await screen.findByName("sort-dropdown")) as Gtk.DropDown;
        const display = (await screen.findByName("display-dropdown")) as Gtk.DropDown;
        expect(limit.getSelected()).toBe(3);
        expect(sort.getSelected()).toBe(0);
        expect(display.getSelected()).toBe(0);
    });

    it("renders a selection-info toggle button initially unpressed", async () => {
        await renderDemo(listviewColorsDemo);
        const selectionToggle = (await screen.findByName("selection-toggle")) as Gtk.ToggleButton;
        expect(selectionToggle).not.toBePressed();
    });
});

describe("listviewColorsDemo grid view", () => {
    it("progressively fills the grid model up to the default color limit", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        await waitFor(() => expect(gridModel(grid).getNItems()).toBe(4096), { timeout: 20000 });
    });

    it("supports multiple selection reflected in the Size label", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        expect(grid.getEnableRubberband()).toBe(true);
        const model = gridModel(grid);
        model.selectItem(0, true);
        model.selectItem(2, false);
        expect(Number(model.getSelection().getSize())).toBe(2);
        const sizeLabel = (await screen.findByName("selection-size")) as Gtk.Label;
        await waitFor(() => expect(sizeLabel).toHaveTextContent("2"));
    });

    it("wraps the grid view in a scrolled window inside the overlay", async () => {
        await renderDemo(listviewColorsDemo);
        const overlay = (await screen.findByName("grid-overlay")) as Gtk.Overlay;
        const sw = await within(overlay).findByName("grid-scrolled");
        await within(sw).findByName("color-grid");
    });
});

describe("listviewColorsDemo selection info revealer", () => {
    it("starts collapsed (revealer not revealing children)", async () => {
        await renderDemo(listviewColorsDemo);
        const revealer = (await screen.findByName("selection-revealer")) as Gtk.Revealer;
        expect(revealer.getRevealChild()).toBe(false);
    });

    it("expands and shows the Selection panel when the toggle is activated", async () => {
        await renderDemo(listviewColorsDemo);
        const toggle = (await screen.findByName("selection-toggle")) as Gtk.ToggleButton;
        await userEvent.click(toggle);
        const revealer = (await screen.findByName("selection-revealer")) as Gtk.Revealer;
        await waitFor(() => expect(revealer.getRevealChild()).toBe(true));
        expect(toggle).toBePressed();
        await within(revealer).findByText("Selection");
        await within(revealer).findByText("Size:");
    });
});

describe("listviewColorsDemo header actions", () => {
    it("clears the current selection when the Refill button is clicked", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const model = gridModel(grid);
        grid.grabFocus();
        await userEvent.keyboard(grid, "{ArrowDown} ");
        await waitFor(() => expect(Number(model.getSelection().getSize())).toBe(1));
        const refill = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "_Refill" });
        await userEvent.click(refill);
        await waitFor(() => expect(Number(model.getSelection().getSize())).toBe(0));
    });

    it("reorders the grid model when the sort dropdown selects Name", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const model = gridModel(grid);
        const sortDropdown = (await screen.findByName("sort-dropdown")) as Gtk.DropDown;
        await prepareSortableModel(model);
        await userEvent.selectOptions(sortDropdown, 1);
        await waitFor(
            () => {
                expect(colorAt(model, 0).name.localeCompare(colorAt(model, 1).name)).toBeLessThanOrEqual(0);
                expect(colorAt(model, 1).name.localeCompare(colorAt(model, 2).name)).toBeLessThanOrEqual(0);
            },
            { timeout: 20000 },
        );
    });

    it("re-columns the grid when the display dropdown selects Everything", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const displayDropdown = (await screen.findByName("display-dropdown")) as Gtk.DropDown;
        expect(grid.getMinColumns()).toBe(8);
        expect(grid.getMaxColumns()).toBe(24);
        await act(async () => {
            await userEvent.selectOptions(displayDropdown, 1);
            await Promise.resolve();
        });
        await waitFor(() => {
            expect(grid.getMinColumns()).toBe(4);
            expect(grid.getMaxColumns()).toBe(12);
        });
    });

    it("refills the store to the new count and updates the count label when the limit drops to 8", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const model = gridModel(grid);
        const limitDropdown = (await screen.findByName("limit-dropdown")) as Gtk.DropDown;
        await userEvent.selectOptions(limitDropdown, 0);
        await waitFor(() => expect(model.getNItems()).toBe(8));
        await screen.findByText("8 /");
    });
});

describe("listviewColorsDemo sort modes", () => {
    const numericDescending = (field: keyof ColorLike) => (a: ColorLike, b: ColorLike) =>
        expect(a[field] as number).toBeGreaterThanOrEqual(b[field] as number);

    const sortModeCases: { label: string; index: number; check: (a: ColorLike, b: ColorLike) => void }[] = [
        { label: "name", index: 1, check: (a, b) => expect(a.name.localeCompare(b.name)).toBeLessThanOrEqual(0) },
        { label: "red", index: 2, check: numericDescending("r") },
        { label: "green", index: 3, check: numericDescending("g") },
        { label: "blue", index: 4, check: numericDescending("b") },
        { label: "rgb", index: 5, check: numericDescending("r") },
        { label: "hue", index: 6, check: numericDescending("h") },
        { label: "saturation", index: 7, check: numericDescending("s") },
        { label: "value", index: 8, check: numericDescending("v") },
        { label: "hsv", index: 9, check: numericDescending("h") },
    ];

    it.each(sortModeCases)("orders the model per the $label compare function", async ({ index, check }) => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const model = gridModel(grid);
        const sortDropdown = (await screen.findByName("sort-dropdown")) as Gtk.DropDown;
        await prepareSortableModel(model);
        await userEvent.selectOptions(sortDropdown, index);
        await waitFor(
            () => {
                check(colorAt(model, 0), colorAt(model, 1));
                check(colorAt(model, 1), colorAt(model, 2));
            },
            { timeout: 20000 },
        );
    });

    it("reverts to the base position order when switching back to unsorted", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const model = gridModel(grid);
        const sortDropdown = (await screen.findByName("sort-dropdown")) as Gtk.DropDown;
        await prepareSortableModel(model);
        const baseFirst = colorAt(model, 0).name;
        await userEvent.selectOptions(sortDropdown, 1);
        await waitFor(
            () => {
                expect(colorAt(model, 0).name).not.toBe(baseFirst);
                expect(colorAt(model, 0).name.localeCompare(colorAt(model, 1).name)).toBeLessThanOrEqual(0);
            },
            { timeout: 20000 },
        );
        await userEvent.selectOptions(sortDropdown, 0);
        await waitFor(() => expect(colorAt(model, 0).name).toBe(baseFirst), { timeout: 20000 });
    });
});
