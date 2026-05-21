import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewSettings2Demo } from "../../../src/demos/lists/listview-settings2.js";
import { expectDemoMetadata, renderDemo } from "../../helpers/render-demo.js";
import { findAll, findApplicationWindow, findFirst } from "./helpers.js";

describe("listviewSettings2Demo", () => {
    it("exposes the expected metadata", () => {
        expectDemoMetadata(listviewSettings2Demo, {
            id: "listview-settings2",
            title: "Lists/Alternative Settings",
        });
        expect(typeof listviewSettings2Demo.sourceCode).toBe("string");
        expect(listviewSettings2Demo.keywords).toContain("listview");
        expect(listviewSettings2Demo.keywords).toContain("section");
        expect(listviewSettings2Demo.defaultWidth).toBe(640);
        expect(listviewSettings2Demo.defaultHeight).toBe(480);
        expect(listviewSettings2Demo.component).toBeTypeOf("function");
    });

    it("installs a header bar with a search toggle starting inactive", async () => {
        const { container } = await renderDemo(listviewSettings2Demo);
        const window = findApplicationWindow(container);
        expect(window?.getTitlebar()).toBeInstanceOf(Gtk.HeaderBar);
        const toggle = findAll(window as Gtk.Widget, Gtk.ToggleButton).find(
            (t) => t.getIconName() === "system-search-symbolic",
        );
        expect(toggle?.getActive()).toBe(false);
    });

    it("renders a search bar in disabled mode by default", async () => {
        const { container } = await renderDemo(listviewSettings2Demo);
        const bar = findFirst(container, Gtk.SearchBar);
        expect(bar).toBeInstanceOf(Gtk.SearchBar);
        expect(bar?.getSearchMode()).toBe(false);
    });

    it("renders a GtkListView with the rich-list css class", async () => {
        const { container } = await renderDemo(listviewSettings2Demo);
        const listView = findFirst(container, Gtk.ListView);
        expect(listView).toBeInstanceOf(Gtk.ListView);
        expect(listView?.getCssClasses()).toContain("rich-list");
    });

    it("renders a scrolled window wrapping the list view", async () => {
        const { container } = await renderDemo(listviewSettings2Demo);
        const sw = findFirst(container, Gtk.ScrolledWindow);
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
        const listView = sw && findFirst(sw, Gtk.ListView);
        expect(listView).toBeInstanceOf(Gtk.ListView);
    });

    it("renders a GtkSearchEntry inside the search bar", async () => {
        const { container } = await renderDemo(listviewSettings2Demo);
        const bar = findFirst(container, Gtk.SearchBar);
        const entry = bar && findFirst(bar, Gtk.SearchEntry);
        expect(entry).toBeInstanceOf(Gtk.SearchEntry);
    });
});
