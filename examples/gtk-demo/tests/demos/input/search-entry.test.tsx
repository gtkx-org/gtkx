import * as Gtk from "@gtkx/ffi/gtk";
import { act, fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { searchEntryDemo } from "../../../src/demos/input/search-entry.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllByType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new () => T): T[] => {
    const results: T[] = [];
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) results.push(node as T);
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return results;
};

const findFirstByType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new () => T): T | null => {
    const [first] = findAllByType(root, ctor);
    return first ?? null;
};

describe("searchEntryDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(searchEntryDemo.id).toBe("search-entry");
        expect(searchEntryDemo.title).toBe("Entry/Search Entry");
        expect(typeof searchEntryDemo.sourceCode).toBe("string");
        expect(searchEntryDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(searchEntryDemo.component).toBeTypeOf("function");
    });
});

describe("searchEntryDemo rendering", () => {
    it("renders the search toggle, the search bar with the entry, and the result labels", async () => {
        const { container } = await renderDemo(searchEntryDemo);
        const toggle = findFirstByType(container, Gtk.ToggleButton);
        expect(toggle).toBeInstanceOf(Gtk.ToggleButton);
        expect(toggle?.getIconName()).toBe("system-search-symbolic");
        expect(toggle?.getActive()).toBe(false);
        const searchBar = findFirstByType(container, Gtk.SearchBar);
        expect(searchBar).toBeInstanceOf(Gtk.SearchBar);
        expect(searchBar?.getSearchMode()).toBe(false);
        const searchEntry = findFirstByType(container, Gtk.SearchEntry);
        expect(searchEntry).toBeInstanceOf(Gtk.SearchEntry);
        const labels = findAllByType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels).toContain("Searching for:");
    });
});

describe("searchEntryDemo interactions", () => {
    it("activates search mode when the toggle is clicked", async () => {
        const { container } = await renderDemo(searchEntryDemo);
        const toggle = findFirstByType(container, Gtk.ToggleButton);
        if (!toggle) throw new Error("expected toggle button");
        await act(() => toggle.setActive(true));
        await fireEvent(toggle, "toggled");
        expect(toggle.getActive()).toBe(true);
        const searchBar = findFirstByType(container, Gtk.SearchBar);
        expect(searchBar?.getSearchMode()).toBe(true);
    });

    it("reflects the typed search text in the result label", async () => {
        const { container } = await renderDemo(searchEntryDemo);
        const entry = findFirstByType(container, Gtk.SearchEntry);
        if (!entry) throw new Error("expected search entry");
        await act(() => entry.setText("rocket"));
        await fireEvent(entry, "search-changed");
        const labels = findAllByType(container, Gtk.Label).map((l) => l.getLabel());
        expect(labels).toContain("rocket");
    });

    it("syncs the toggle when the search bar reports its mode changed", async () => {
        const { container } = await renderDemo(searchEntryDemo);
        const toggle = findFirstByType(container, Gtk.ToggleButton);
        const searchBar = findFirstByType(container, Gtk.SearchBar);
        if (!toggle || !searchBar) throw new Error("expected toggle and search bar");
        await act(() => searchBar.setSearchMode(true));
        await fireEvent(searchBar, "notify::search-mode-enabled");
        expect(searchBar.getSearchMode()).toBe(true);
        expect(toggle.getActive()).toBe(true);
    });
});
