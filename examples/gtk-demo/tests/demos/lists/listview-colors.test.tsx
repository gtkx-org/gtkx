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

type RenderedColor = ColorLike & { swatch: Gtk.DrawingArea };
type ColorComparator = (a: ColorLike, b: ColorLike) => number;
type SortModeCase = { label: string; index: number; compare: ColorComparator };

const compareByName: ColorComparator = (a, b) => a.name.localeCompare(b.name);

const sortModeCases: SortModeCase[] = [
    { label: "name", index: 1, compare: compareByName },
    { label: "red", index: 2, compare: (a, b) => b.r - a.r },
    { label: "green", index: 3, compare: (a, b) => b.g - a.g },
    { label: "blue", index: 4, compare: (a, b) => b.b - a.b },
    { label: "rgb", index: 5, compare: (a, b) => b.r - a.r || b.g - a.g || b.b - a.b },
    { label: "hue", index: 6, compare: (a, b) => b.h - a.h },
    { label: "saturation", index: 7, compare: (a, b) => b.s - a.s },
    { label: "value", index: 8, compare: (a, b) => b.v - a.v },
    { label: "hsv", index: 9, compare: (a, b) => b.h - a.h || b.s - a.s || b.v - a.v },
];

const parseComponents = (text: string, pattern: RegExp): [number, number, number] => {
    const match = pattern.exec(text);
    const first = match?.[1];
    const second = match?.[2];
    const third = match?.[3];

    if (first === undefined || second === undefined || third === undefined) {
        throw new Error(`Could not read rendered color values from ${text}`);
    }

    return [Number(first), Number(second), Number(third)];
};

const findGrid = (): Promise<Gtk.GridView> => screen.findByName("color-grid", { as: Gtk.GridView });

const renderedColors = (grid: Gtk.GridView): RenderedColor[] =>
    within(grid)
        .getAllByRole(Gtk.AccessibleRole.GRID_CELL)
        .flatMap((cell) => {
            const rgbLabel = within(cell).queryByText(/^R:\s*\d+\s+G:\s*\d+\s+B:\s*\d+$/u, { as: Gtk.Label });

            if (rgbLabel === null) {
                return [];
            }

            const hsvLabel = within(cell).getByText(/^H:\s*\d+\s+S:\s*\d+\s+V:\s*\d+$/u, { as: Gtk.Label });
            const nameLabel = within(cell)
                .getAllByRole(Gtk.AccessibleRole.LABEL, { as: Gtk.Label })
                .find((label) => label !== rgbLabel && label !== hsvLabel);

            if (nameLabel === undefined) {
                throw new TypeError("Detailed color name is missing");
            }

            const swatch = within(cell).getByRole(Gtk.AccessibleRole.IMG, { as: Gtk.DrawingArea });

            const [r, g, b] = parseComponents(rgbLabel.getText(), /^R:\s*(\d+)\s+G:\s*(\d+)\s+B:\s*(\d+)$/u);
            const [h, s, v] = parseComponents(hsvLabel.getText(), /^H:\s*(\d+)\s+S:\s*(\d+)\s+V:\s*(\d+)$/u);

            return [{ name: nameLabel.getText(), r, g, b, h, s, v, swatch }];
        });

const isOrdered = (colors: ColorLike[], compare: ColorComparator): boolean => {
    const [first, ...rest] = colors;

    if (first === undefined) {
        return true;
    }

    let previous = first;

    for (const current of rest) {
        if (compare(previous, current) > 0) {
            return false;
        }

        previous = current;
    }

    return true;
};

const renderedNames = (grid: Gtk.GridView): string[] => renderedColors(grid).map((color) => color.name);

const renderSortableGrid = async (): Promise<{ grid: Gtk.GridView; sortDropdown: Gtk.DropDown }> => {
    await renderDemo(listviewColorsDemo);
    const grid = await findGrid();
    const limitDropdown = await screen.findByName("limit-dropdown", { as: Gtk.DropDown });
    const displayDropdown = await screen.findByName("display-dropdown", { as: Gtk.DropDown });
    const sortDropdown = await screen.findByName("sort-dropdown", { as: Gtk.DropDown });
    await userEvent.selectOptions(limitDropdown, 0);
    await userEvent.selectOptions(displayDropdown, 1);

    await waitFor(() => {
        expect(renderedColors(grid)).toHaveLength(8);
    });

    return { grid, sortDropdown };
};

vi.setConfig({ testTimeout: 30_000 });

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
    it("shows the default number of generated colors", async () => {
        await renderDemo(listviewColorsDemo);
        expect(await screen.findByText("4,096 /")).toBeVisible();
    });

    it("wraps the grid view in a scrolled window inside the overlay", async () => {
        await renderDemo(listviewColorsDemo);
        const overlay = await screen.findByName("grid-overlay", { as: Gtk.Overlay });
        const sw = await within(overlay).findByName("grid-scrolled", { as: Gtk.ScrolledWindow });
        expect(overlay).toContainElement(sw);
        expect(sw).toContainElement(await screen.findByName("color-grid", { as: Gtk.GridView }));
    });

    it("names every visible color swatch", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const swatches = within(grid).getAllByRole(Gtk.AccessibleRole.IMG, { as: Gtk.DrawingArea });
        expect(swatches.length).toBeGreaterThan(0);

        for (const swatch of swatches) {
            expect(swatch).toHaveAccessibleName(/.+/);
        }
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
        await within(revealer).findByRole(Gtk.AccessibleRole.IMG, { name: /^Average color #[0-9a-f]{6}$/ });
    });
});

describe("listviewColorsDemo header actions", () => {
    it("clears the current selection when the Refill button is clicked", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const limitDropdown = await screen.findByName("limit-dropdown", { as: Gtk.DropDown });
        await userEvent.selectOptions(limitDropdown, 0);
        grid.grabFocus();
        await userEvent.keyboard(grid, "{ArrowDown} ");
        await userEvent.click(await screen.findByName("selection-toggle", { as: Gtk.ToggleButton }));
        const sizeLabel = await screen.findByName("selection-size", { as: Gtk.Label });
        await waitFor(() => {
            expect(sizeLabel).toHaveTextContent("1");
        });
        const refill = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Refill" });
        await userEvent.click(refill);
        await waitFor(() => {
            expect(sizeLabel).toHaveTextContent("0");
        });
    });

    it("recovers the rendered colors after shrinking, growing, and refilling the store", async () => {
        await renderDemo(listviewColorsDemo);
        const grid = await findGrid();
        const limitDropdown = await screen.findByName("limit-dropdown", { as: Gtk.DropDown });
        const displayDropdown = await screen.findByName("display-dropdown", { as: Gtk.DropDown });
        await userEvent.selectOptions(limitDropdown, 0);
        await userEvent.selectOptions(displayDropdown, 1);
        expect(await screen.findByText("8 /")).toBeVisible();

        await waitFor(() => {
            expect(renderedColors(grid)).toHaveLength(8);
        });

        await userEvent.selectOptions(limitDropdown, 1);
        expect(await screen.findByText("64 /")).toBeVisible();

        await waitFor(() => {
            const colors = renderedColors(grid);
            expect(colors.length).toBeGreaterThan(0);
            expect(colors.every((color) => color.swatch.getWidth() > 0 && color.swatch.getHeight() > 0)).toBe(true);
        });

        await userEvent.selectOptions(limitDropdown, 0);
        await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Refill" }));

        expect(await screen.findByText("8 /")).toBeVisible();
        await waitFor(() => {
            const colors = renderedColors(grid);
            expect(colors).toHaveLength(8);
            expect(colors.every((color) => color.swatch.getWidth() > 0 && color.swatch.getHeight() > 0)).toBe(true);
        });
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
    it.each(sortModeCases)("orders the rendered colors by $label", async ({ index, compare }) => {
        const { grid, sortDropdown } = await renderSortableGrid();
        await userEvent.selectOptions(sortDropdown, index);

        await waitFor(() => {
            const colors = renderedColors(grid);
            expect(colors).toHaveLength(8);
            expect(isOrdered(colors, compare)).toBe(true);
            expect(colors.every((color) => color.swatch.getWidth() > 0 && color.swatch.getHeight() > 0)).toBe(true);
        });
    });

    it("restores the generated order when switching back to unsorted", async () => {
        const { grid, sortDropdown } = await renderSortableGrid();
        const original = renderedNames(grid);
        await userEvent.selectOptions(sortDropdown, 1);

        await waitFor(() => {
            expect(isOrdered(renderedColors(grid), compareByName)).toBe(true);
        });

        expect(renderedNames(grid)).not.toEqual(original);
        await userEvent.selectOptions(sortDropdown, 0);

        await waitFor(() => {
            expect(renderedNames(grid)).toEqual(original);
        });
    });
});
