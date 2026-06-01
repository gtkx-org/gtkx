import * as Gtk from "@gtkx/gi/gtk";
import { act, fireEvent, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { searchEntryDemo } from "../../../src/demos/input/search-entry.js";
import { renderDemo } from "../../test-utils.js";

describe("searchEntryDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(searchEntryDemo.id).toBe("search-entry");
        expect(searchEntryDemo.title).toBe("Entry/Search Entry");
        expect(searchEntryDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(searchEntryDemo.keywords)).toBe(true);
        expect(typeof searchEntryDemo.sourceCode).toBe("string");
        expect(searchEntryDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(searchEntryDemo.component).toBeTypeOf("function");
    });
});

describe("searchEntryDemo rendering", () => {
    it("renders the search toggle, the search bar with the entry, and the result labels", async () => {
        await renderDemo(searchEntryDemo);
        const toggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON)) as Gtk.ToggleButton;
        expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
        expect(toggle.getIconName()).toBe("system-search-symbolic");
        expect(toggle.getActive()).toBe(false);
        const searchBar = (await screen.findByRole(Gtk.AccessibleRole.SEARCH)) as Gtk.SearchBar;
        expect(searchBar).toBeInstanceOf(Gtk.SearchBar);
        expect(searchBar.getSearchMode()).toBe(false);
        const searchEntry = (await screen.findByRole(Gtk.AccessibleRole.SEARCH_BOX)) as Gtk.SearchEntry;
        expect(searchEntry).toBeInstanceOf(Gtk.SearchEntry);
        expect(await screen.findByText("Searching for:")).toBeInstanceOf(Gtk.Widget);
    });
});

describe("searchEntryDemo interactions", () => {
    it("activates search mode when the toggle is clicked", async () => {
        await renderDemo(searchEntryDemo);
        const toggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON)) as Gtk.ToggleButton;
        const searchBar = (await screen.findByRole(Gtk.AccessibleRole.SEARCH)) as Gtk.SearchBar;
        await userEvent.click(toggle);
        await waitFor(() => {
            expect(toggle.getActive()).toBe(true);
            expect(searchBar.getSearchMode()).toBe(true);
        });
    });

    it("reflects the typed search text in the result label", async () => {
        await renderDemo(searchEntryDemo);
        const entry = (await screen.findByRole(Gtk.AccessibleRole.SEARCH_BOX)) as Gtk.SearchEntry;
        await userEvent.type(entry, "rocket");
        await fireEvent(entry, "search-changed");
        const match = await screen.findByText("Searching for: rocket");
        expect(match).toBeInstanceOf(Gtk.Widget);
    });

    it("syncs the toggle when the search bar reports its mode changed", async () => {
        await renderDemo(searchEntryDemo);
        const toggle = (await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON)) as Gtk.ToggleButton;
        const searchBar = (await screen.findByRole(Gtk.AccessibleRole.SEARCH)) as Gtk.SearchBar;
        await act(() => searchBar.setSearchMode(true));
        await fireEvent(searchBar, "notify::search-mode-enabled");
        expect(searchBar.getSearchMode()).toBe(true);
        expect(toggle.getActive()).toBe(true);
    });
});
