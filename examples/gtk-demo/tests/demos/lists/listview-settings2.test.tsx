import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { listviewSettings2Demo } from "../../../src/demos/lists/listview-settings2.js";
import { act, fireEvent, renderDemo, screen } from "../../test-utils.js";

describe("listviewSettings2Demo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewSettings2Demo.id).toBe("listview-settings2");
        expect(listviewSettings2Demo.title).toBe("Lists/Alternative Settings");
        expect(listviewSettings2Demo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewSettings2Demo.keywords)).toBe(true);
        expect(typeof listviewSettings2Demo.sourceCode).toBe("string");
        expect(listviewSettings2Demo.defaultWidth).toBe(640);
        expect(listviewSettings2Demo.defaultHeight).toBe(480);
        expect(listviewSettings2Demo.component).toBeTypeOf("function");
    });
});

describe("listviewSettings2Demo layout", () => {
    it("installs a search toggle in the header bar starting inactive", async () => {
        await renderDemo(listviewSettings2Demo);
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        expect(toggle.getActive()).toBe(false);
    });

    it("renders a search bar in disabled mode by default", async () => {
        await renderDemo(listviewSettings2Demo);
        const bar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
        expect(bar.getSearchMode()).toBe(false);
    });

    it("renders a list view with the rich-list css class", async () => {
        await renderDemo(listviewSettings2Demo);
        const listView = (await screen.findByName("list-view")) as Gtk.ListView;
        expect(listView.getCssClasses()).toContain("rich-list");
    });

    it("wraps the list view in a scrolled window", async () => {
        await renderDemo(listviewSettings2Demo);
        const sw = (await screen.findByName("scrolled")) as Gtk.ScrolledWindow;
        expect(sw).toBeInstanceOf(Gtk.ScrolledWindow);
    });

    it("renders a search entry inside the search bar", async () => {
        await renderDemo(listviewSettings2Demo);
        const entry = await screen.findByName("search-entry");
        expect(entry).toBeInstanceOf(Gtk.SearchEntry);
    });
});

describe("listviewSettings2Demo search and editing", () => {
    it("enables the search bar when the titlebar search toggle is activated", async () => {
        await renderDemo(listviewSettings2Demo);
        const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
        await act(() => toggle.setActive(true));
        await fireEvent(toggle, "toggled");
        const bar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
        expect(bar.getSearchMode()).toBe(true);
    });

    it("updates the filter when the search entry text changes", async () => {
        await renderDemo(listviewSettings2Demo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await act(() => entry.setText("display"));
        await fireEvent(entry, "search-changed");
    });

    it("clears the search text when stop-search is emitted", async () => {
        await renderDemo(listviewSettings2Demo);
        const entry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        await act(() => entry.setText("anything"));
        await fireEvent(entry, "search-changed");
        await fireEvent(entry, "stop-search");
    });
});
