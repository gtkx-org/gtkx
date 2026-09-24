import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { button, drawSidebar, expander, intro } from "../sidebar-fixture.js";

describe("Sidebar", () => {
    it("updates search visibility on the retained sidebar", async () => {
        const view = await render(drawSidebar([intro, button, expander]));
        const sidebar = screen.getByName("sidebar-list", { as: Gtk.ListView });
        const searchBar = screen.getByName("sidebar-search-bar", { as: Gtk.SearchBar });
        expect(searchBar.searchModeEnabled).toBe(false);
        expect(screen.queryByRole(Gtk.AccessibleRole.SEARCH_BOX)).toBeNull();
        await view.rerender(drawSidebar([intro, button, expander], true));
        expect(screen.getByName("sidebar-list")).toBe(sidebar);
        expect(screen.getByName("sidebar-search-bar")).toBe(searchBar);
        expect(searchBar.searchModeEnabled).toBe(true);
        expect(await screen.findByRole(Gtk.AccessibleRole.SEARCH_BOX)).toBeVisible();
        await view.rerender(drawSidebar([intro, button, expander]));
        expect(searchBar.searchModeEnabled).toBe(false);
        await waitFor(() => {
            expect(screen.queryByRole(Gtk.AccessibleRole.SEARCH_BOX)).toBeNull();
        });
    });
});

describe("Sidebar accessibility", () => {
    it("names every expander and describes the expanded category", async () => {
        await render(drawSidebar([intro, button, expander]));
        const list = screen.getByName("sidebar-list", { as: Gtk.ListView });
        const bound = within(list);
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
