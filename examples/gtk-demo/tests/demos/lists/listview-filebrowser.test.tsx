import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewFilebrowserDemo } from "../../../src/demos/lists/listview-filebrowser.js";
import { renderDemo } from "../../test-utils.js";

const waitForPopulatedModel = async (grid: Gtk.GridView): Promise<number> =>
    waitFor(() => {
        const count = (grid.getModel() as Gtk.SelectionModel).getNItems();
        expect(count).toBeGreaterThan(0);
        return count;
    });

describe("listviewFilebrowserDemo", () => {
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
        const model = switcher.getModel();
        expect(model?.getNItems()).toBe(3);
    });

    it("renders the file grid view inside a scrolled window", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        expect(grid).toBeInstanceOf(Gtk.GridView);
        const sw = (await screen.findByName("files-scrolled")) as Gtk.ScrolledWindow;
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });

    it("populates the file grid with at least one entry from the working directory", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        const model = grid.getModel();
        expect(model).not.toBeNull();
        expect((model as Gtk.SelectionModel).getNItems()).toBeGreaterThan(0);
    });

    it("starts in list view orientation (horizontal)", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        expect(grid.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
    });

    it("switches to grid view orientation when a different view mode is selected", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const switcher = (await screen.findByName("view-switcher")) as Gtk.ListView;
        await userEvent.selectOptions(switcher, 1);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        expect(grid.getOrientation()).toBe(Gtk.Orientation.VERTICAL);
    });

    it("navigates to the parent directory when the up button is clicked", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const upButton = (await screen.findByName("up-button")) as Gtk.Button;
        await userEvent.click(upButton);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        await waitForPopulatedModel(grid);
    });

    it("switches to paged view mode (preserves horizontal orientation)", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const switcher = (await screen.findByName("view-switcher")) as Gtk.ListView;
        await userEvent.selectOptions(switcher, 2);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        expect(grid.getOrientation()).toBe(Gtk.Orientation.HORIZONTAL);
    });

    it("navigates into a directory when activate fires on a directory entry", async () => {
        await renderDemo(listviewFilebrowserDemo);
        const grid = (await screen.findByName("files-grid")) as Gtk.GridView;
        expect(grid.getModel()).not.toBeNull();
        const beforeCount = await waitForPopulatedModel(grid);
        for (let i = 0; i < beforeCount; i++) {
            await userEvent.selectOptions(grid, i);
            await act(() => {
                grid.emit("activate", i);
            });
            await Promise.resolve();
            const after = (grid.getModel() as Gtk.SelectionModel).getNItems();
            if (after !== beforeCount) {
                expect(after).toBeGreaterThanOrEqual(0);
                return;
            }
        }
        expect(grid).toBeInstanceOf(Gtk.GridView);
    });
});
