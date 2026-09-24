import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { assert, describe, expect, it } from "vitest";
import type { Demo } from "../../src/demos/types.js";
import { Sidebar } from "../../src/components/sidebar.js";
import { button, drawSidebar, expander, fixedSlash, intro, standalone } from "../sidebar-fixture.js";

const rowLabels = (sidebar: Gtk.ListView): (string | null)[] =>
    within(sidebar).queryAllByText(/./, { as: Gtk.Inscription }).map((label) => label.getText());

const sidebarWidget = (): Gtk.ListView => screen.getByName("sidebar-list", { as: Gtk.ListView });

const searchWidget = (): Gtk.SearchEntry => screen.getByRole(Gtk.AccessibleRole.SEARCH_BOX, { as: Gtk.SearchEntry });

describe("DemoProvider sidebar presentation", () => {
    it("renders plain and categorized titles in order with the introduction selected", async () => {
        await render(drawSidebar([intro, standalone, button, expander, fixedSlash]));
        const sidebar = sidebarWidget();
        expect(rowLabels(sidebar)).toEqual([
            "GTK Demo", "Buttons", "Button", "Expander", "Layout", "Fixed", "Standalone",
        ]);
        const model = sidebar.getModel();
        assert(model !== null);
        expect(model.getNItems()).toBe(7);
        expect(model.getSelection().getSize()).toBe(1n);
        expect(model.isSelected(0)).toBe(true);
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
        const model = sidebar.getModel();
        assert(model !== null);
        expect(model.getSelection().getSize()).toBe(1n);
        expect(model.isSelected(1)).toBe(true);
    });

    it("renders an empty list without selection before and after a search", async () => {
        await render(drawSidebar([], true));
        const sidebar = sidebarWidget();
        const model = sidebar.getModel();
        assert(model !== null);
        expect(rowLabels(sidebar)).toEqual([]);
        expect(model.getNItems()).toBe(0);
        expect(model.getSelection().getSize()).toBe(0n);
        const search = searchWidget();
        await userEvent.type(search, "missing");
        await userEvent.clear(search);
        expect(rowLabels(sidebar)).toEqual([]);
        expect(model.getNItems()).toBe(0);
        expect(model.getSelection().getSize()).toBe(0n);
    });

    it("moves the native selection when a different demo row is clicked", async () => {
        await render(drawSidebar([intro, button, expander, standalone]));
        const sidebar = sidebarWidget();
        const model = sidebar.getModel();
        assert(model !== null);
        await userEvent.click(within(sidebar).getByText("Standalone"));
        expect(model.getSelection().getSize()).toBe(1n);
        expect(model.isSelected(4)).toBe(true);
        await userEvent.click(within(sidebar).getByText("Button"));
        expect(model.getSelection().getSize()).toBe(1n);
        expect(model.isSelected(2)).toBe(true);
    });

    it("rejects rendering Sidebar without its provider", async () => {
        const searches: string[] = [];
        await expect(render(
            <Sidebar
                isSearchActive={false}
                onSearchChanged={(query) => {
                    searches.push(query);
                }}
            />,
        )).rejects.toThrow();
        expect(searches).toEqual([]);
    });
});

describe("DemoProvider sidebar search", () => {
    it.each([
        ["title", "Expander"],
        ["description", "expandable widget"],
        ["keyword", "disclosure"],
        ["case-insensitive title", "eXpAnDeR"],
    ])("shows only the matching demo and its category for a %s search", async (_field, query) => {
        await render(drawSidebar([intro, button, expander, standalone], true));
        const sidebar = sidebarWidget();
        await userEvent.type(searchWidget(), query);
        await waitFor(() => {
            expect(rowLabels(sidebar)).toEqual(["Buttons", "Expander"]);
        });
        const model = sidebar.getModel();
        assert(model !== null);
        expect(model.getNItems()).toBe(2);
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
        const model = sidebar.getModel();
        assert(model !== null);
        expect(model.getNItems()).toBe(0);
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
