import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listviewFilebrowserDemo } from "../../../src/demos/lists/listview-filebrowser.js";
import { renderDemo } from "../../test-utils.js";

type ScrollAxis = { adjustment: Gtk.Adjustment; isHorizontal: boolean };

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const originalCwd = process.cwd();
const SCROLL_STEP = 200;
const MAX_SCROLL_STEPS = 80;

const waitForPopulatedModel = async (grid: Gtk.GridView): Promise<number> =>
    waitFor(() => {
        const count = (grid.getModel() as Gtk.SelectionModel).getNItems();
        expect(count).toBeGreaterThan(0);

        return count;
    });

const findFilesGrid = async (): Promise<Gtk.GridView> => await screen.findByName("files-grid", { as: Gtk.GridView });

const renderPopulatedGrid = async (): Promise<Gtk.GridView> => {
    await renderDemo(listviewFilebrowserDemo);
    const grid = await findFilesGrid();
    await waitForPopulatedModel(grid);

    return grid;
};

const selectViewMode = async (index: number): Promise<Gtk.ListView> => {
    await renderDemo(listviewFilebrowserDemo);
    const switcher = await screen.findByName("view-switcher", { as: Gtk.ListView });
    await userEvent.selectOptions(switcher, index);

    return switcher;
};

const visibleNames = (grid: Gtk.GridView): string[] =>
    within(grid)
        .getAllByRole(Gtk.AccessibleRole.LABEL, { as: Gtk.Label })
        .map((label) => label.getText());

const findScrolledFiles = (): Promise<Gtk.ScrolledWindow> =>
    screen.findByName("files-scrolled", { as: Gtk.ScrolledWindow });

const isScrolledToEnd = (adjustment: Gtk.Adjustment): boolean =>
    adjustment.getValue() >= adjustment.getUpper() - adjustment.getPageSize();

const getScrollAxis = (scrolled: Gtk.ScrolledWindow): ScrollAxis => {
    const horizontal = scrolled.getHadjustment();

    if (horizontal.getUpper() > horizontal.getPageSize()) {
        return { adjustment: horizontal, isHorizontal: true };
    }

    return { adjustment: scrolled.getVadjustment(), isHorizontal: false };
};

const scrollBy = async (scrolled: Gtk.ScrolledWindow, axis: ScrollAxis, amount: number): Promise<void> => {
    await userEvent.scroll(scrolled, axis.isHorizontal ? { x: amount } : { y: amount });
};

const scrollThroughFiles = async (hasArrived: () => boolean): Promise<void> => {
    const scrolled = await findScrolledFiles();
    const axis = getScrollAxis(scrolled);
    await scrollBy(scrolled, axis, -axis.adjustment.getUpper());

    for (let step = 0; step < MAX_SCROLL_STEPS; step++) {
        if (hasArrived() || isScrolledToEnd(axis.adjustment)) {
            return;
        }

        await scrollBy(scrolled, axis, SCROLL_STEP);
    }
};

const scrollToEntry = async (grid: Gtk.GridView, name: string): Promise<Gtk.Widget> => {
    await scrollThroughFiles(() => within(grid).queryAllByText(name).length > 0);

    return within(grid).findByText(name);
};

const collectNames = (names: string[], grid: Gtk.GridView): void => {
    for (const name of visibleNames(grid)) {
        if (!names.includes(name)) {
            names.push(name);
        }
    }
};

const orderedNames = async (grid: Gtk.GridView): Promise<string[]> => {
    const names: string[] = [];

    await scrollThroughFiles(() => {
        collectNames(names, grid);

        return false;
    });

    return names;
};

beforeAll(() => {
    process.chdir(repoRoot);
});

afterAll(() => {
    process.chdir(originalCwd);
});

describe("listviewFilebrowserDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewFilebrowserDemo.id).toBe("listview-filebrowser");
        expect(listviewFilebrowserDemo.title).toBe("Lists/File browser");
        expect(listviewFilebrowserDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewFilebrowserDemo.keywords)).toBe(true);
        expect(typeof listviewFilebrowserDemo.sourceCode).toBe("string");
        expect(listviewFilebrowserDemo.defaultWidth).toBe(600);
        expect(listviewFilebrowserDemo.defaultHeight).toBe(400);
        expect(listviewFilebrowserDemo.component).toBeTypeOf("function");
    });
});

describe("listviewFilebrowserDemo header bar", () => {
    it("installs a header bar with the up-button and view-switcher packed into it", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const header = await screen.findByName("filebrowser-header", { as: Gtk.HeaderBar });
        expect(header).toBeInstanceOf(Gtk.HeaderBar);
        expect(within(header).getByName("up-button")).toBeInstanceOf(Gtk.Button);
        expect(within(header).getByName("view-switcher")).toBeInstanceOf(Gtk.ListView);
    });

    it("renders a go-up button in the header bar", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const upButton = await screen.findByName("up-button", { as: Gtk.Button });
        expect(upButton).toBeInstanceOf(Gtk.Button);
        expect(upButton).toHaveObjectProperty("iconName", "go-up-symbolic");
    });

    it("renders a view-mode list view with three entries", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const switcher = await screen.findByName("view-switcher", { as: Gtk.ListView });
        expect(within(switcher).getAllByRole(Gtk.AccessibleRole.IMG)).toHaveLength(3);
    });
});

describe("listviewFilebrowserDemo file grid", () => {
    it("renders the file grid view inside the scrolled window with the working directory listed", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const sw = await screen.findByName("files-scrolled", { as: Gtk.ScrolledWindow });
        const grid = within(sw).getByName("files-grid", { as: Gtk.GridView });
        expect(grid).toBeInstanceOf(Gtk.GridView);
        await waitForPopulatedModel(grid);
        await scrollToEntry(grid, "package.json");
    });

    it("populates the file grid with known entries from the working directory", async () => {
        const grid = await renderPopulatedGrid();
        expect(await scrollToEntry(grid, "package.json")).toBeInstanceOf(Gtk.Label);
        expect(await scrollToEntry(grid, "examples")).toBeInstanceOf(Gtk.Label);
        expect(await scrollToEntry(grid, "packages")).toBeInstanceOf(Gtk.Label);
    });

    it("sorts directories before files, alphabetically within each group", async () => {
        const grid = await renderPopulatedGrid();
        const names = await orderedNames(grid);
        expect(names).toContain("examples");
        expect(names).toContain("packages");
        expect(names).toContain("package.json");
        expect(names.indexOf("examples")).toBeLessThan(names.indexOf("packages"));
        expect(names.indexOf("packages")).toBeLessThan(names.indexOf("package.json"));
    });
});

describe("listviewFilebrowserDemo view modes", () => {
    it("starts in list view orientation (horizontal)", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = await findFilesGrid();
        expect(grid).toHaveObjectProperty("orientation", Gtk.Orientation.HORIZONTAL);
    });

    it("switches to grid view: vertical orientation, wrapped item labels, and switcher selection", async () => {
        const switcher = await selectViewMode(1);
        const grid = await findFilesGrid();

        await waitFor(() => {
            expect(grid).toHaveObjectProperty("orientation", Gtk.Orientation.VERTICAL);
        });

        expect(switcher.getModel()).toHaveObjectProperty("selected", 1);
        const label = await within(grid).findByText("examples", { as: Gtk.Label });
        expect(label).toHaveObjectProperty("wrap", true);
    });

    it("switches to paged view mode rendering the folder and content-type labels", async () => {
        const switcher = await selectViewMode(2);
        const grid = await findFilesGrid();
        await waitForPopulatedModel(grid);
        expect(switcher.getModel()).toHaveObjectProperty("selected", 2);
        await scrollToEntry(grid, "packages");
        expect(within(grid).getAllByText("folder").length).toBeGreaterThan(0);
        expect(within(grid).getAllByText("inode/directory").length).toBeGreaterThan(0);
    });
});

describe("listviewFilebrowserDemo navigation", () => {
    it("navigates to the parent directory when the up button is clicked", async () => {
        const grid = await renderPopulatedGrid();
        const currentDirName = basename(process.cwd());
        expect(within(grid).queryByText(currentDirName)).toBeNull();
        const upButton = await screen.findByName("up-button", { as: Gtk.Button });
        await userEvent.click(upButton);
        await scrollToEntry(grid, currentDirName);
    });

    it("navigates into a directory when a directory entry is activated", async () => {
        const grid = await renderPopulatedGrid();
        const names = await orderedNames(grid);
        const position = names.indexOf("examples");
        expect(position).toBeGreaterThanOrEqual(0);
        grid.grabFocus();
        await fireEvent(grid, "activate", position);
        await within(grid).findByText("gtk-demo");
    });
});
