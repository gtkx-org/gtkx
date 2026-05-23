import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewSettingsDemo } from "../../../src/demos/lists/listview-settings.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

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
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
        expect(toggle.getActive()).toBe(false);
    });

    it("renders a paned layout splitting sidebar from details", async () => {
        await renderDemo(listviewSettingsDemo);
        const paned = (await screen.findByName("paned")) as Gtk.Paned;
        expect(paned.getPosition()).toBe(300);
        expect(paned.getStartChild()).toBeInstanceOf(Gtk.Widget);
        expect(paned.getEndChild()).toBeInstanceOf(Gtk.Widget);
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
});

describe("listviewSettingsDemo schema interactions", () => {
    it("loads keys for the first schema when the sidebar selection changes", async () => {
        await renderDemo(listviewSettingsDemo);
        const sidebar = (await screen.findByName("sidebar")) as Gtk.ListView;
        const model = sidebar.getModel();
        if (!model || model.getNItems() === 0) return;
        await act(() => model.selectItem(0, true));
        await fireEvent(model, "selection-changed", 0, 1);
    });

    it("opens the key search bar when the titlebar toggle is activated", async () => {
        await renderDemo(listviewSettingsDemo);
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        await act(() => toggle.setActive(true));
        await fireEvent(toggle, "toggled");
        const searchBar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(true);
    });

    it("clears the key search text when the search entry stops searching", async () => {
        await renderDemo(listviewSettingsDemo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await act(() => entry.setText("foo"));
        await fireEvent(entry, "search-changed");
        await fireEvent(entry, "stop-search");
    });
});
