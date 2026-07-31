import * as Gtk from "@gtkx/gi/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { searchEntryDemo } from "../../../src/demos/input/search-entry.js";
import { renderDemo } from "../../test-utils.js";

const enableSearchMode = async (): Promise<{ toggle: Gtk.ToggleButton; searchBar: Gtk.SearchBar }> => {
    const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { as: Gtk.ToggleButton });
    const searchBar = await screen.findByRole(Gtk.AccessibleRole.SEARCH, { as: Gtk.SearchBar });
    await userEvent.click(toggle);

    await waitFor(() => {
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", true);
    });

    return { toggle, searchBar };
};

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
        const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { as: Gtk.ToggleButton });
        expect(toggle).toHaveObjectProperty("iconName", "system-search-symbolic");
        expect(screen.getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: false })).toBe(toggle);
        const searchBar = await screen.findByRole(Gtk.AccessibleRole.SEARCH, { as: Gtk.SearchBar });
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
        const searchEntry = await screen.findByRole(Gtk.AccessibleRole.SEARCH_BOX, { as: Gtk.SearchEntry });
        expect(searchEntry).toHaveObjectProperty("text", "");
        expect(await screen.findByText("Searching for:")).toHaveTextContent("Searching for:");
    });
});

describe("searchEntryDemo interactions", () => {
    it("activates search mode when the toggle is clicked", async () => {
        await renderDemo(searchEntryDemo);
        const { toggle } = await enableSearchMode();
        expect(await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: true })).toBe(toggle);
    });

    it("deactivates search mode when the toggle is clicked a second time", async () => {
        await renderDemo(searchEntryDemo);
        const { toggle, searchBar } = await enableSearchMode();
        await userEvent.click(toggle);
        await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: false });

        await waitFor(() => {
            expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
        });
    });

    it("reflects the typed search text in the result label", async () => {
        await renderDemo(searchEntryDemo);
        await enableSearchMode();
        const entry = await screen.findByRole(Gtk.AccessibleRole.SEARCH_BOX, { as: Gtk.SearchEntry });
        await userEvent.type(entry, "rocket");
        const match = await screen.findByText("Searching for: rocket");
        expect(match).toHaveTextContent("Searching for: rocket");
    });

    it("syncs the toggle when the search bar reports its mode changed", async () => {
        await renderDemo(searchEntryDemo);
        const toggle = await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { as: Gtk.ToggleButton });
        const searchBar = await screen.findByRole(Gtk.AccessibleRole.SEARCH, { as: Gtk.SearchBar });

        await act(() => {
            searchBar.setSearchMode(true);
        });

        expect(searchBar).toHaveObjectProperty("searchModeEnabled", true);
        expect(screen.getByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: true })).toBe(toggle);
    });
});
