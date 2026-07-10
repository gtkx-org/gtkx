import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listviewFilebrowserDemo } from "../../../src/demos/lists/listview-filebrowser.js";
import { renderDemo } from "../../test-utils.js";

const waitForPopulatedModel = async (grid: Gtk.GridView): Promise<number> =>
    waitFor(() => {
        const count = (grid.getModel() as Gtk.SelectionModel).getNItems();
        expect(count).toBeGreaterThan(0);
        return count;
    });

const orderedNames = (grid: Gtk.GridView): string[] =>
    within(grid)
        .getAllByRole(Gtk.AccessibleRole.LABEL)
        .map((label) => (label as Gtk.Label).getText());

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("listviewFilebrowserDemo", () => {
    const originalCwd = process.cwd();
    beforeAll(() => process.chdir(repoRoot));
    afterAll(() => process.chdir(originalCwd));

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

    it("installs a header bar with the up-button and view-switcher packed into it", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const header = (await screen.findByName("filebrowser-header")) as Gtk.HeaderBar;
        expect(header).toBeInstanceOf(Gtk.HeaderBar);
        expect(within(header).getByName("up-button")).toBeInstanceOf(Gtk.Button);
        expect(within(header).getByName("view-switcher")).toBeInstanceOf(Gtk.ListView);
    });

    it("renders a go-up button in the header bar", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const upButton = (await screen.findByName("up-button")) as Gtk.Button;
        expect(upButton).toBeInstanceOf(Gtk.Button);
        expect(upButton.getIconName()).toBe("go-up-symbolic");
    });

    it("renders a view-mode list view with three entries", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const switcher = (await screen.findByName("view-switcher")) as Gtk.ListView;
        expect(within(switcher).getAllByRole(Gtk.AccessibleRole.IMG)).toHaveLength(3);
    });

    it("renders the file grid view inside the scrolled window with the working directory listed", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const sw = (await screen.findByName("files-scrolled")) as Gtk.ScrolledWindow;
        const grid = within(sw).getByName("files-grid") as Gtk.GridView;
        expect(grid).toBeInstanceOf(Gtk.GridView);
        await waitForPopulatedModel(grid);
        await within(grid).findByText("package.json");
    });

    it("populates the file grid with known entries from the working directory", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        await waitForPopulatedModel(grid);
        await within(grid).findByText("package.json");
        within(grid).getByText("examples");
        within(grid).getByText("packages");
    });

    it("sorts directories before files, alphabetically within each group", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        await waitForPopulatedModel(grid);
        const names = orderedNames(grid);
        expect(names.indexOf("examples")).toBeLessThan(names.indexOf("packages"));
        expect(names.indexOf("packages")).toBeLessThan(names.indexOf("package.json"));
    });

    it("starts in list view orientation (horizontal)", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        expect(grid.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
    });

    it("switches to grid view: vertical orientation, wrapped item labels, and switcher selection", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const switcher = (await screen.findByName("view-switcher")) as Gtk.ListView;
        await userEvent.selectOptions(switcher, 1);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        await waitFor(() => expect(grid.getOrientation()).toBe(Gtk.Orientation.VERTICAL));
        expect((switcher.getModel() as Gtk.SingleSelection).getSelected()).toBe(1);
        const label = (await within(grid).findByText("examples")) as Gtk.Label;
        expect(label.getWrap()).toBe(true);
    });

    it("switches to paged view mode rendering the folder and content-type labels", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const switcher = (await screen.findByName("view-switcher")) as Gtk.ListView;
        await userEvent.selectOptions(switcher, 2);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        await waitForPopulatedModel(grid);
        expect((switcher.getModel() as Gtk.SingleSelection).getSelected()).toBe(2);
        await within(grid).findByText("packages");
        expect(within(grid).getAllByText("folder").length).toBeGreaterThan(0);
        expect(within(grid).getAllByText("inode/directory").length).toBeGreaterThan(0);
    });

    it("navigates to the parent directory when the up button is clicked", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        await waitForPopulatedModel(grid);
        const currentDirName = basename(process.cwd());
        expect(within(grid).queryByText(currentDirName)).toBeNull();
        const upButton = (await screen.findByName("up-button")) as Gtk.Button;
        await userEvent.click(upButton);
        await within(grid).findByText(currentDirName);
    });

    it("navigates into a directory when a directory entry is activated", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        await waitForPopulatedModel(grid);
        const position = orderedNames(grid).indexOf("examples");
        expect(position).toBeGreaterThanOrEqual(0);
        grid.grabFocus();
        await fireEvent(grid, "activate", position);
        await within(grid).findByText("gtk-demo");
    });
});
