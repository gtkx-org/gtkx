import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { listviewSettings2Demo } from "../../../src/demos/lists/listview-settings2.js";
import { activateSearchBar, openSearchEntry, renderDemo } from "../../test-utils.js";

const listModel = async (): Promise<Gtk.SelectionModel> => {
    const listView = await screen.findByName("list-view", { as: Gtk.ListView });

    return listView.getModel() as Gtk.SelectionModel;
};

const schemaHeaderLabels = (): string[] =>
    screen
        .queryAllByText(/^[^\s.]+\.\S+$/, { as: Gtk.Label })
        .map((l) => l.getLabel())
        .filter((text) => !text.includes(" "));

const renderListModel = async (): Promise<Gtk.SelectionModel> => {
    await renderDemo(listviewSettings2Demo);

    return await listModel();
};

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
        const toggle = await screen.findByName("search-toggle", { as: Gtk.ToggleButton });
        expect(toggle).not.toBePressed();
    });

    it("renders a search bar in disabled mode by default", async () => {
        await renderDemo(listviewSettings2Demo);
        const bar = await screen.findByName("search-bar", { as: Gtk.SearchBar });
        expect(bar).toHaveObjectProperty("searchModeEnabled", false);
    });

    it("renders a list view with the rich-list css class", async () => {
        await renderDemo(listviewSettings2Demo);
        const listView = await screen.findByName("list-view", { as: Gtk.ListView });
        expect(listView).toHaveClass("rich-list");
    });

    it("wraps the list view directly inside the scrolled window", async () => {
        await renderDemo(listviewSettings2Demo);
        const sw = await screen.findByName("scrolled", { as: Gtk.ScrolledWindow });
        const listView = await screen.findByName("list-view", { as: Gtk.ListView });
        expect(sw).toHaveObjectProperty("child", listView);
    });

    it("places the search entry inside the search bar", async () => {
        await renderDemo(listviewSettings2Demo);
        const bar = await screen.findByName("search-bar", { as: Gtk.SearchBar });
        expect(within(bar).queryByName("search-entry")).toBeNull();
        const entry = await openSearchEntry();
        await within(bar).findByName("search-entry");
        expect(entry).toBeInstanceOf(Gtk.SearchEntry);
    });

    it("groups the keys into per-schema sections with schema-id headings", async () => {
        await renderDemo(listviewSettings2Demo);
        await screen.findByName("list-view");
        const headers = schemaHeaderLabels();
        expect(headers.length).toBeGreaterThan(0);
    });
});

describe("listviewSettings2Demo search and editing", () => {
    it("enables the search bar when the titlebar search toggle is activated", async () => {
        await renderDemo(listviewSettings2Demo);
        const { bar } = await activateSearchBar();
        expect(bar).toHaveObjectProperty("searchModeEnabled", true);
    });

    it("narrows the list model to the matching schema when the search term matches a subset", async () => {
        const model = await renderListModel();
        const initial = model.getNItems();
        const headers = schemaHeaderLabels();
        expect(headers.length).toBeGreaterThan(0);
        const token = (headers[0]?.split(".").pop() ?? "").toLowerCase();
        expect(token.length).toBeGreaterThan(0);
        const entry = await openSearchEntry();
        await userEvent.type(entry, token);
        expect(entry).toHaveDisplayValue(token);

        await waitFor(() => {
            expect(model.getNItems()).toBeLessThan(initial);
        });

        expect(model.getNItems()).toBeGreaterThan(0);
        expect(schemaHeaderLabels().every((header) => header.toLowerCase().includes(token))).toBe(true);
    });

    it("clears the list model to zero when the search text matches no key", async () => {
        const model = await renderListModel();
        const entry = await openSearchEntry();
        await userEvent.type(entry, "zzqxnomatchforanyschemaorkey");

        await waitFor(() => {
            expect(model).toHaveObjectProperty("nItems", 0);
        });
    });
});

describe("listviewSettings2Demo search reset and editing", () => {
    it("restores the full list model when stop-search is emitted", async () => {
        const model = await renderListModel();
        const initial = model.getNItems();
        const entry = await openSearchEntry();
        await userEvent.type(entry, "zzqxnomatchforanyschemaorkey");

        await waitFor(() => {
            expect(model).toHaveObjectProperty("nItems", 0);
        });

        await userEvent.keyboard(entry, "{Escape}");

        await waitFor(() => {
            expect(model).toHaveObjectProperty("nItems", initial);
        });
    });

    it("turns the search bar off when the search toggle is deactivated", async () => {
        await renderDemo(listviewSettings2Demo);
        const { toggle, bar } = await activateSearchBar();
        await userEvent.click(toggle);

        await waitFor(() => {
            expect(bar).toHaveObjectProperty("searchModeEnabled", false);
        });
    });

    it(
        "does not blow the trampoline stack when typing invalid characters into a numeric schema-key entry",
        async () => {
            await renderDemo(listviewSettings2Demo);
            const entries = await screen.findAllByRole(Gtk.AccessibleRole.TEXT_BOX);
            const entry = entries[0] as Gtk.Entry;
            const initial = entry.getText();
            await userEvent.clear(entry);
            await userEvent.type(entry, "x");
            expect(entry).toHaveDisplayValue(initial);
        },
    );
});
