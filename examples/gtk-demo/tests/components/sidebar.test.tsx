import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { button, drawSidebar, expander, intro } from "../sidebar-fixture.js";

describe("Sidebar", () => {
    it("updates search visibility across rerenders", async () => {
        const view = await render(drawSidebar([intro, button, expander]));
        const searchBar = screen.getByName("sidebar-search-bar", { as: Gtk.SearchBar });
        expect(searchBar.searchModeEnabled).toBe(false);
        expect(screen.queryByRole(Gtk.AccessibleRole.SEARCH_BOX)).toBeNull();
        await view.rerender(drawSidebar([intro, button, expander], true));
        expect(screen.getByName("sidebar-search-bar", { as: Gtk.SearchBar }).searchModeEnabled).toBe(true);
        expect(await screen.findByRole(Gtk.AccessibleRole.SEARCH_BOX)).toBeVisible();
        await view.rerender(drawSidebar([intro, button, expander]));
        expect(screen.getByName("sidebar-search-bar", { as: Gtk.SearchBar }).searchModeEnabled).toBe(false);
        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.SEARCH_BOX)).toBeNull();
        });
    });
});

describe("Sidebar accessibility", () => {
    it("names every expander and describes the expanded category", async () => {
        await render(drawSidebar([intro, button, expander], true));
        const list = screen.getByRole(Gtk.AccessibleRole.LIST, { name: "Demos", as: Gtk.ListView });
        const bound = within(list);
        expect(list).toHaveAccessibleName("Demos");
        expect(screen.getByRole(Gtk.AccessibleRole.SEARCH_BOX)).toHaveAccessibleName("Search demos");
        const expanders = bound.getAllByRole(Gtk.AccessibleRole.BUTTON);
        expect(expanders).toHaveLength(4);

        for (const item of expanders) {
            expect(item).toHaveAccessibleName();
        }

        const category = bound.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Buttons" });
        expect(category).toHaveAccessibleDescription("Collapse");
        expect(bound.getByText("Button")).toBeVisible();
        expect(bound.getByText("Expander")).toBeVisible();
    });
});

describe("Sidebar expansion", () => {
    it("preserves a user-collapsed category across rerenders and searches", async () => {
        const view = await render(drawSidebar([intro, button, expander]));
        const list = screen.getByRole(Gtk.AccessibleRole.LIST, { name: "Demos", as: Gtk.ListView });
        const category = within(list).getByRole(Gtk.AccessibleRole.BUTTON, { name: "Buttons" });
        await userEvent.click(category);

        await waitFor(() => {
            expect(within(list).queryByText("Button")).toBeNull();
            expect(within(list).queryByText("Expander")).toBeNull();
        });

        await view.rerender(drawSidebar([intro, button, expander], true));
        const rerenderedList = screen.getByRole(Gtk.AccessibleRole.LIST, { name: "Demos" });
        expect(within(rerenderedList).queryByText("Button")).toBeNull();
        expect(within(rerenderedList).queryByText("Expander")).toBeNull();

        const search = screen.getByRole(Gtk.AccessibleRole.SEARCH_BOX, { as: Gtk.SearchEntry });
        await userEvent.type(search, "Expander");
        await waitFor(() => {
            expect(within(rerenderedList).getByText("Expander")).toBeVisible();
        });

        await userEvent.clear(search);
        await waitFor(() => {
            expect(within(rerenderedList).queryByText("Button")).toBeNull();
            expect(within(rerenderedList).queryByText("Expander")).toBeNull();
        });
    });
});
