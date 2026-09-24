import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { assert, describe, expect, it } from "vitest";
import type { Demo } from "../../src/demos/types.js";
import { Sidebar } from "../../src/components/sidebar.js";
import { button, drawSidebar, expander, fixedSlash, intro, standalone } from "../sidebar-fixture.js";

const rowLabels = (sidebar: Gtk.ListView): (string | null)[] =>
    within(sidebar).queryAllByText(/./, { as: Gtk.Inscription }).map((label) => label.getText());

const sidebarWidget = (): Gtk.ListView =>
    screen.getByRole(Gtk.AccessibleRole.LIST, { name: "Demos", as: Gtk.ListView });

const searchWidget = (): Gtk.SearchEntry => screen.getByRole(Gtk.AccessibleRole.SEARCH_BOX, { as: Gtk.SearchEntry });
const sidebarRow = (sidebar: Gtk.ListView, name: string): Gtk.Widget => {
    const row = within(sidebar).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)
        .find((candidate) => within(candidate).queryByText(name) !== null);
    assert(row !== undefined);

    return row;
};

describe("DemoProvider sidebar presentation", () => {
    it("renders plain and categorized titles in order with the introduction selected", async () => {
        await render(drawSidebar([intro, standalone, button, expander, fixedSlash]));
        const sidebar = sidebarWidget();
        expect(rowLabels(sidebar)).toEqual([
            "GTK Demo", "Buttons", "Button", "Expander", "Layout", "Fixed", "Standalone",
        ]);
        expect(sidebarRow(sidebar, "GTK Demo")).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
    });

    it("keeps the introduction first and sorts top-level demos and categories", async () => {
        const zebra: Demo = { id: "zebra", title: "Zebra", description: "z", keywords: [] };
        const aardvark: Demo = { id: "aardvark", title: "Aardvark", description: "a", keywords: [] };
        await render(drawSidebar([intro, zebra, button, aardvark]));
        expect(rowLabels(sidebarWidget())).toEqual(["GTK Demo", "Aardvark", "Buttons", "Button", "Zebra"]);
    });

    it("selects the first demo inside a category when there is no top-level demo", async () => {
        await render(drawSidebar([button, expander]));
        const sidebar = sidebarWidget();
        expect(rowLabels(sidebar)).toEqual(["Buttons", "Button", "Expander"]);
        expect(sidebarRow(sidebar, "Button")).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
    });

    it("renders an empty list without selection before and after a search", async () => {
        await render(drawSidebar([], true));
        const sidebar = sidebarWidget();
        expect(rowLabels(sidebar)).toEqual([]);
        expect(within(sidebar).queryAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(0);
        const search = searchWidget();
        await userEvent.type(search, "missing");
        await userEvent.clear(search);
        expect(rowLabels(sidebar)).toEqual([]);
        expect(within(sidebar).queryAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(0);
    });

    it("moves the native selection when a different demo row is clicked", async () => {
        await render(drawSidebar([intro, button, expander, standalone]));
        const sidebar = sidebarWidget();
        await userEvent.click(within(sidebar).getByText("Standalone"));
        expect(sidebarRow(sidebar, "Standalone")).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        await userEvent.click(within(sidebar).getByText("Button"));
        expect(sidebarRow(sidebar, "Button")).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        expect(sidebarRow(sidebar, "Standalone")).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, false);
    });

    it("rejects rendering Sidebar without its provider", async () => {
        await expect(render(
            <Sidebar
                isSearchActive={false}
                onDemoActivated={() => null}
                onSearchActiveChange={() => null}
                onSearchChanged={() => null}
            />,
        )).rejects.toThrow();
    });
});

describe("DemoProvider sidebar search", () => {
    it.each([
        ["title", "Expander"],
        ["description", "expandable widget"],
        ["keyword", "disclosure"],
        ["case-insensitive title", "eXpAnDeR"],
        ["padded title", "  Expander  "],
    ])("shows only the matching demo and its category for a %s search", async (_field, query) => {
        await render(drawSidebar([intro, button, expander, standalone], true));
        const sidebar = sidebarWidget();
        await userEvent.type(searchWidget(), query);
        await waitFor(() => {
            expect(rowLabels(sidebar)).toEqual(["Buttons", "Expander"]);
        });
        expect(within(sidebar).getAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(2);
    });

    it("restores every displayed row for a whitespace-only query", async () => {
        await render(drawSidebar([intro, button, expander, standalone], true));
        const sidebar = sidebarWidget();
        const search = searchWidget();
        await userEvent.type(search, "disclosure");
        await waitFor(() => {
            expect(rowLabels(sidebar)).toEqual(["Buttons", "Expander"]);
        });
        await userEvent.clear(search);
        await userEvent.type(search, " ".repeat(3));
        expect(search.getText()).toBe(" ".repeat(3));
        await waitFor(() => {
            expect(rowLabels(sidebar)).toEqual(["GTK Demo", "Buttons", "Button", "Expander", "Standalone"]);
        });
    });

    it("removes all rows for no match and recovers top-level and full results", async () => {
        await render(drawSidebar([intro, button, expander, standalone], true));
        const sidebar = sidebarWidget();
        const search = searchWidget();
        await userEvent.type(search, "zzznevermatch");
        await waitFor(() => {
            expect(rowLabels(sidebar)).toEqual([]);
        });
        expect(within(sidebar).queryAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(0);
        await userEvent.clear(search);
        await userEvent.type(search, "Standalone");
        await waitFor(() => {
            expect(rowLabels(sidebar)).toEqual(["Standalone"]);
        });
        await userEvent.clear(search);
        await waitFor(() => {
            expect(rowLabels(sidebar)).toEqual(["GTK Demo", "Buttons", "Button", "Expander", "Standalone"]);
        });
    });
});
