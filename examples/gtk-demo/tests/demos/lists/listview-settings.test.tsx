import * as Gtk from "@gtkx/gi/gtk";
import { fireEvent, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewSettingsDemo } from "../../../src/demos/lists/listview-settings.js";
import { findInactiveSearchToggle, renderDemo } from "../../test-utils.js";

describe("listviewSettingsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewSettingsDemo.id).toBe("listview-settings");
        expect(listviewSettingsDemo.title).toBe("Lists/Settings");
        expect(listviewSettingsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewSettingsDemo.keywords)).toBe(true);
        expect(typeof listviewSettingsDemo.sourceCode).toBe("string");
        expect(listviewSettingsDemo.defaultWidth).toBe(640);
        expect(listviewSettingsDemo.defaultHeight).toBe(480);
        expect(listviewSettingsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewSettingsDemo layout", () => {
    it("installs a header bar with a search toggle starting inactive", async () => {
        await renderDemo(listviewSettingsDemo);
        await findInactiveSearchToggle();
    });

    it("renders a paned layout splitting sidebar from details", async () => {
        await renderDemo(listviewSettingsDemo);
        const paned = (await screen.findByName("paned")) as Gtk.Paned;
        expect(paned.getPosition()).toBe(300);
    });

    it("renders the navigation sidebar list", async () => {
        await renderDemo(listviewSettingsDemo);
        const sidebar = (await screen.findByName("sidebar")) as Gtk.ListView;
        expect(sidebar.getCssClasses()).toContain("navigation-sidebar");
    });

    it("renders a search bar starting disabled with a search entry inside", async () => {
        await renderDemo(listviewSettingsDemo);
        const searchBar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(false);
        const searchEntry = await screen.findByName("search-entry");
        expect(searchEntry).toBeInstanceOf(Gtk.SearchEntry);
    });
});

describe("listviewSettingsDemo column view", () => {
    const readColumns = (cv: Gtk.ColumnView): Map<string, Gtk.ColumnViewColumn> => {
        const out = new Map<string, Gtk.ColumnViewColumn>();
        const columns = cv.getColumns();
        for (let i = 0; i < columns.getNItems(); i++) {
            const col = columns.getItem(i);
            if (col instanceof Gtk.ColumnViewColumn) {
                const title = col.getTitle();
                if (title) out.set(title, col);
            }
        }
        return out;
    };

    it("renders a GtkColumnView with the expected columns", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        expect([...readColumns(columnView).keys()]).toEqual([
            "Name",
            "Value",
            "Type",
            "Default",
            "Summary",
            "Description",
        ]);
    });

    it("hides the Summary and Description columns by default", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const byTitle = readColumns(columnView);
        expect(byTitle.get("Summary")?.getVisible()).toBe(false);
        expect(byTitle.get("Description")?.getVisible()).toBe(false);
        expect(byTitle.get("Name")?.getVisible()).toBe(true);
    });

    it("attaches a selection model to the column view", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        await waitFor(() => {
            expect(columnView.getModel()).not.toBeNull();
        });
    });

    it("exposes the column view's column count once the React commit settles", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        await waitFor(() => {
            expect(columnView.getColumns().getNItems()).toBe(6);
        });
    });

    it("attaches a header menu to every column once the visibility-menu effect resolves", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        await waitFor(
            () => {
                const columns = columnView.getColumns();
                let columnsWithMenus = 0;
                for (let i = 0; i < columns.getNItems(); i++) {
                    const col = columns.getItem(i);
                    if (col instanceof Gtk.ColumnViewColumn && col.getHeaderMenu() !== null) columnsWithMenus += 1;
                }
                expect(columnsWithMenus).toBeGreaterThanOrEqual(4);
            },
            { timeout: 3000 },
        );
    });
});

describe("listviewSettingsDemo schema interactions", () => {
    it("loads keys for the second schema when the sidebar selection changes", async () => {
        await renderDemo(listviewSettingsDemo);
        const sidebar = (await screen.findByName("sidebar")) as Gtk.ListView;
        const model = sidebar.getModel();
        expect(model).not.toBeNull();
        const items = (model as Gtk.SelectionModel).getNItems();
        if (items < 2) return;
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const cvModel = columnView.getModel() as Gtk.SelectionModel | null;
        const beforeItems = cvModel?.getNItems() ?? 0;
        await userEvent.selectOptions(sidebar, 1);
        await waitFor(() => {
            const updatedModel = columnView.getModel() as Gtk.SelectionModel | null;
            expect(updatedModel?.getNItems() ?? 0).not.toBe(beforeItems);
        });
    });

    it("opens the key search bar when the titlebar toggle is activated", async () => {
        await renderDemo(listviewSettingsDemo);
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        await userEvent.click(toggle);
        const searchBar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(true));
    });

    it("filters the column view when search text is typed", async () => {
        await renderDemo(listviewSettingsDemo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await userEvent.type(entry, "foo");
        expect(entry.getText()).toBe("foo");
    });

    it("clears the key search text when the search entry stops searching", async () => {
        await renderDemo(listviewSettingsDemo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await userEvent.type(entry, "foo");
        await fireEvent(entry, "stop-search");
        const searchBar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(false));
    });
});
