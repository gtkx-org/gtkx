import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewColorsDemo } from "../../../src/demos/lists/listview-colors.js";
import { renderDemo } from "../../test-utils.js";

type ColorLike = {
    name: string;
    r: number;
    g: number;
    b: number;
    h: number;
    s: number;
    v: number;
};

type SortField = keyof ColorLike;
type SortModeCase = { label: string; index: number; field: SortField };

const sortModeCases: SortModeCase[] = [
    { label: "name", index: 1, field: "name" },
    { label: "red", index: 2, field: "r" },
    { label: "green", index: 3, field: "g" },
    { label: "blue", index: 4, field: "b" },
    { label: "rgb", index: 5, field: "r" },
    { label: "hue", index: 6, field: "h" },
    { label: "saturation", index: 7, field: "s" },
    { label: "value", index: 8, field: "v" },
    { label: "hsv", index: 9, field: "h" },
];

const PROBE_LENGTH = 12;

const colorAt = (model: Gtk.MultiSelection, index: number): ColorLike => {
    const obj = model.getItem(index);

    if (!obj) {
        throw new Error(`no color item at index ${String(index)}`);
    }

    return Reflect.get(obj, "colorItem") as ColorLike;
};

const findGrid = (): Promise<Gtk.GridView> => screen.findByName("color-grid", { as: Gtk.GridView });
const gridModel = (grid: Gtk.GridView): Gtk.MultiSelection => grid.getModel() as Gtk.MultiSelection;
const findGridModel = async (): Promise<Gtk.MultiSelection> => gridModel(await findGrid());

const orderingScore = (a: ColorLike, b: ColorLike, field: SortField): number =>
    field === "name" ? b.name.localeCompare(a.name) : a[field] - b[field];

const leadingNames = (model: Gtk.MultiSelection): string[] =>
    Array.from({ length: PROBE_LENGTH }, (_, index) => colorAt(model, index).name);

const isAscending = (values: string[]): boolean =>
    values.every((value, index) => index === 0 || (values[index - 1] ?? "").localeCompare(value) <= 0);

const renderSortableGrid = async (): Promise<{ model: Gtk.MultiSelection; sortDropdown: Gtk.DropDown }> => {
    await renderDemo(listviewColorsDemo);
    const model = await findGridModel();
    const sortDropdown = await screen.findByName("sort-dropdown", { as: Gtk.DropDown });

    return { model, sortDropdown };
};

const expectSelectionSize = async (model: Gtk.MultiSelection, size: number): Promise<void> => {
    await waitFor(() => {
        expect(Number(model.getSelection().getSize())).toBe(size);
    });
};

vi.setConfig({ testTimeout: 30_000 });

describe("listviewColorsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewColorsDemo.id).toBe("listview-colors");
        expect(listviewColorsDemo.title).toBe("Lists/Colors");
        expect(listviewColorsDemo.description).toContain("This demo displays a grid of colors.");
        expect(listviewColorsDemo.keywords).toEqual(["GtkMultiSelection"]);
        expect(listviewColorsDemo.sourceCode).toContain("const listviewColorsDemo: Demo = {");
        expect(listviewColorsDemo.defaultWidth).toBe(800);
        expect(listviewColorsDemo.defaultHeight).toBe(400);
        expect(listviewColorsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewColorsDemo header bar", () => {
    it("hosts the refill button and the three drop-downs inside the header bar", async () => {
        await renderDemo(listviewColorsDemo);
        const headerBar = await screen.findByName("header-bar", { as: Gtk.HeaderBar });
        await within(headerBar).findByRole(Gtk.AccessibleRole.BUTTON, { name: "Refill" });
        expect(headerBar).toContainOneByRole(Gtk.AccessibleRole.BUTTON, { name: "Refill" });
        expect(headerBar).toContainElement(await screen.findByName("limit-dropdown", { as: Gtk.DropDown }));
        expect(headerBar).toContainElement(await screen.findByName("sort-dropdown", { as: Gtk.DropDown }));
        expect(headerBar).toContainElement(await screen.findByName("display-dropdown", { as: Gtk.DropDown }));
    });

    it("maps each drop-down's initial selection to demo state", async () => {
        await renderDemo(listviewColorsDemo);
        const limit = await screen.findByName("limit-dropdown", { as: Gtk.DropDown });
        const sort = await screen.findByName("sort-dropdown", { as: Gtk.DropDown });
        const display = await screen.findByName("display-dropdown", { as: Gtk.DropDown });
        expect(limit).toHaveObjectProperty("selected", 3);
        expect(sort).toHaveObjectProperty("selected", 0);
        expect(display).toHaveObjectProperty("selected", 0);
    });

    it("renders a selection-info toggle button initially unpressed", async () => {
        await renderDemo(listviewColorsDemo);
        const selectionToggle = await screen.findByName("selection-toggle", { as: Gtk.ToggleButton });
        expect(selectionToggle).not.toBePressed();
    });
});

describe("listviewColorsDemo grid view", () => {
    it("populates the grid model with exactly the default color limit", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        expect(gridModel(grid)).toHaveObjectProperty("nItems", 4096);
    });

    it("supports multiple selection reflected in the Size label", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        expect(grid).toHaveObjectProperty("enableRubberband", true);
        const model = gridModel(grid);
        model.selectItem(0, true);
        model.selectItem(2, false);
        expect(Number(model.getSelection().getSize())).toBe(2);
        await userEvent.click(await screen.findByName("selection-toggle", { as: Gtk.ToggleButton }));
        const sizeLabel = await screen.findByName("selection-size", { as: Gtk.Label });

        await waitFor(() => {
            expect(sizeLabel).toHaveTextContent("2");
        });
    });

    it("wraps the grid view in a scrolled window inside the overlay", async () => {
        await renderDemo(listviewColorsDemo);
        const overlay = await screen.findByName("grid-overlay", { as: Gtk.Overlay });
        const sw = await within(overlay).findByName("grid-scrolled", { as: Gtk.ScrolledWindow });
        expect(overlay).toContainElement(sw);
        expect(sw).toContainElement(await screen.findByName("color-grid", { as: Gtk.GridView }));
    });
});

describe("listviewColorsDemo selection info revealer", () => {
    it("starts collapsed (revealer not revealing children)", async () => {
        await renderDemo(listviewColorsDemo);
        const revealer = await screen.findByName("selection-revealer", { as: Gtk.Revealer });
        expect(revealer).toHaveObjectProperty("revealChild", false);
    });

    it("expands and shows the Selection panel when the toggle is activated", async () => {
        await renderDemo(listviewColorsDemo);
        const toggle = await screen.findByName("selection-toggle", { as: Gtk.ToggleButton });
        await userEvent.click(toggle);
        const revealer = await screen.findByName("selection-revealer", { as: Gtk.Revealer });

        await waitFor(() => {
            expect(revealer).toHaveObjectProperty("revealChild", true);
        });

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
        await expectSelectionSize(model, 1);
        const refill = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Refill" });
        await userEvent.click(refill);
        await expectSelectionSize(model, 0);
    });

    it("reorders the grid model when the sort dropdown selects Name", async () => {
        const { model, sortDropdown } = await renderSortableGrid();
        await userEvent.selectOptions(sortDropdown, 1);

        await waitFor(() => {
            expect(colorAt(model, 0).name.localeCompare(colorAt(model, 1).name)).toBeLessThanOrEqual(0);
            expect(colorAt(model, 1).name.localeCompare(colorAt(model, 2).name)).toBeLessThanOrEqual(0);
        });
    });

    it("refills the store to the new count and updates the count label when the limit drops to 8", async () => {
        await renderDemo(listviewColorsDemo);
        const model = await findGridModel();
        const limitDropdown = await screen.findByName("limit-dropdown", { as: Gtk.DropDown });
        await userEvent.selectOptions(limitDropdown, 0);

        await waitFor(() => {
            expect(model).toHaveObjectProperty("nItems", 8);
        });

        await screen.findByText("8 /");
    });
});

describe("listviewColorsDemo display modes", () => {
    it("re-columns the grid when the display dropdown selects Everything", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const displayDropdown = await screen.findByName("display-dropdown", { as: Gtk.DropDown });
        expect(grid).toHaveObjectProperty("minColumns", 8);
        expect(grid).toHaveObjectProperty("maxColumns", 24);

        await act(async () => {
            await userEvent.selectOptions(displayDropdown, 1);
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(grid).toHaveObjectProperty("minColumns", 4);
            expect(grid).toHaveObjectProperty("maxColumns", 12);
        });
    });
});

describe("listviewColorsDemo sort modes", () => {
    it.each(sortModeCases)("orders the model per the $label compare function", async ({ index, field }) => {
        const { model, sortDropdown } = await renderSortableGrid();
        await userEvent.selectOptions(sortDropdown, index);

        await waitFor(() => {
            expect(orderingScore(colorAt(model, 0), colorAt(model, 1), field)).toBeGreaterThanOrEqual(0);
            expect(orderingScore(colorAt(model, 1), colorAt(model, 2), field)).toBeGreaterThanOrEqual(0);
        });
    });

    it("restores the generated order when switching back to unsorted", async () => {
        const { model, sortDropdown } = await renderSortableGrid();
        const original = leadingNames(model);
        await userEvent.selectOptions(sortDropdown, 1);

        await waitFor(() => {
            expect(isAscending(leadingNames(model))).toBe(true);
        });

        expect(leadingNames(model)).not.toEqual(original);
        await userEvent.selectOptions(sortDropdown, 0);

        await waitFor(() => {
            expect(leadingNames(model)).toEqual(original);
        });
    });
});
