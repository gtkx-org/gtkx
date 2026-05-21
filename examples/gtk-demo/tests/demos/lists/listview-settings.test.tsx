import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewSettingsDemo } from "../../../src/demos/lists/listview-settings.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findApplicationWindow, findFirst } from "./helpers.js";

describe("listviewSettingsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewSettingsDemo, { id: "listview-settings", title: "Lists/Settings" });
        expect(typeof listviewSettingsDemo.sourceCode).toBe("string");
        expect(listviewSettingsDemo.keywords).toContain("listview");
        expect(listviewSettingsDemo.keywords).toContain("settings");
        expect(listviewSettingsDemo.defaultWidth).toBe(640);
        expect(listviewSettingsDemo.defaultHeight).toBe(480);
        expect(listviewSettingsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewSettingsDemo layout", () => {
    it("installs a header bar with a search toggle", async () => {
        const { container } = await renderDemo(listviewSettingsDemo);
        const window = findApplicationWindow(container);
        expect(window?.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
        const toggle = findAll(window as Gtk.Widget, Gtk.ToggleButton).find(
            (t) => t.getIconName() === "system-search-symbolic",
        );
        expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
        expect(toggle?.getActive()).toBe(false);
    });

    it("renders a paned layout with sidebar and details", async () => {
        const { container } = await renderDemo(listviewSettingsDemo);
        const paned = findFirst(container, Gtk.Paned);
        expect(paned).toBeInstanceOf(Gtk.Paned);
        expect(paned?.getPosition()).toBe(300);
        expect(paned?.getStartChild()).toBeInstanceOf(Gtk.Widget);
        expect(paned?.getEndChild()).toBeInstanceOf(Gtk.Widget);
    });

    it("renders the navigation sidebar with a list view", async () => {
        const { container } = await renderDemo(listviewSettingsDemo);
        const paned = findFirst(container, Gtk.Paned);
        const sidebar = paned?.getStartChild() as Gtk.Widget | null;
        if (!sidebar) throw new Error("sidebar missing");
        const sidebarList = findFirst(sidebar, Gtk.ListView);
        expect(sidebarList).toBeInstanceOf(Gtk.ListView);
        expect(sidebarList?.getCssClasses()).toContain("navigation-sidebar");
    });

    it("renders a search bar wired to the column view", async () => {
        const { container } = await renderDemo(listviewSettingsDemo);
        const searchBar = findFirst(container, Gtk.SearchBar);
        expect(searchBar).toBeInstanceOf(Gtk.SearchBar);
        expect(searchBar?.getSearchMode()).toBe(false);
        const searchEntry = findFirst(container, Gtk.SearchEntry);
        expect(searchEntry).toBeInstanceOf(Gtk.SearchEntry);
    });
});

describe("listviewSettingsDemo column view", () => {
    it("renders a GtkColumnView with the expected columns", async () => {
        const { container } = await renderDemo(listviewSettingsDemo);
        const columnView = findFirst(container, Gtk.ColumnView);
        expect(columnView).toBeInstanceOf(Gtk.ColumnView);
        const columns = columnView?.getColumns();
        if (!columns) throw new Error("column list missing");
        const titles: string[] = [];
        for (let i = 0; i < columns.getNItems(); i++) {
            const col = columns.getItem(i);
            if (col instanceof Gtk.ColumnViewColumn) {
                const t = col.getTitle();
                if (t) titles.push(t);
            }
        }
        expect(titles).toEqual(["Name", "Value", "Type", "Default", "Summary", "Description"]);
    });

    it("hides the Summary and Description columns by default", async () => {
        const { container } = await renderDemo(listviewSettingsDemo);
        const columnView = findFirst(container, Gtk.ColumnView);
        const columns = columnView?.getColumns();
        if (!columns) throw new Error("column list missing");
        const byTitle = new Map<string, Gtk.ColumnViewColumn>();
        for (let i = 0; i < columns.getNItems(); i++) {
            const col = columns.getItem(i);
            if (col instanceof Gtk.ColumnViewColumn) {
                const t = col.getTitle();
                if (t) byTitle.set(t, col);
            }
        }
        expect(byTitle.get("Summary")?.getVisible()).toBe(false);
        expect(byTitle.get("Description")?.getVisible()).toBe(false);
        expect(byTitle.get("Name")?.getVisible()).toBe(true);
    });
});
