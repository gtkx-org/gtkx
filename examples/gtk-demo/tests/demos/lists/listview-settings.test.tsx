import * as Gio from "@gtkx/gi/gio";
import type * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewSettingsDemo } from "../../../src/demos/lists/listview-settings.js";
import { findInactiveSearchToggle, renderDemo } from "../../test-utils.js";

const readColumns = (cv: Gtk.ColumnView): Map<string, Gtk.ColumnViewColumn> => {
    const out = new Map<string, Gtk.ColumnViewColumn>();
    const columns = cv.getColumns();
    for (let i = 0; i < columns.getNItems(); i++) {
        const col = columns.getItem(i);
        if (col instanceof Gtk.ColumnViewColumn) {
            const title = col.getTitle();
            if (title) out.set(title, col);
        }
    }
    return out;
};

const collectEditableLabels = (widget: Gtk.Widget, out: Gtk.EditableLabel[] = []): Gtk.EditableLabel[] => {
    if (widget instanceof Gtk.EditableLabel) out.push(widget);
    let child = widget.getFirstChild();
    while (child) {
        collectEditableLabels(child, out);
        child = child.getNextSibling();
    }
    return out;
};

const itemCount = (cv: Gtk.ColumnView): number => (cv.getModel() as Gtk.SelectionModel | null)?.getNItems() ?? 0;

const selectFirstSchemaWithKeys = async (): Promise<Gtk.ColumnView> => {
    const sidebar = (await screen.findByName("sidebar")) as Gtk.ListView;
    await userEvent.selectOptions(sidebar, 0);
    const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
    await waitFor(() => expect(itemCount(columnView)).toBeGreaterThan(0));
    return columnView;
};

const openKeySearch = async (): Promise<Gtk.SearchEntry> => {
    const toggle = (await screen.findByName("search-toggle")) as Gtk.ToggleButton;
    await userEvent.click(toggle);
    const searchBar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
    await waitFor(() => expect(searchBar.getSearchMode()).toBe(true));
    return (await screen.findByName("search-entry")) as Gtk.SearchEntry;
};

interface FilteredToZeroState {
    columnView: Gtk.ColumnView;
    full: number;
    entry: Gtk.SearchEntry;
}

const filterKeysToZero = async (): Promise<FilteredToZeroState> => {
    await renderDemo(listviewSettingsDemo);
    const columnView = await selectFirstSchemaWithKeys();
    const full = itemCount(columnView);
    const entry = await openKeySearch();
    await userEvent.type(entry, "zzqqxx");
    await waitFor(() => expect(itemCount(columnView)).toBe(0));
    return { columnView, full, entry };
};

describe("listviewSettingsDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(listviewSettingsDemo.id).toBe("listview-settings");
        expect(listviewSettingsDemo.title).toBe("Lists/Settings");
        expect(listviewSettingsDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(listviewSettingsDemo.keywords)).toBe(true);
        expect(typeof listviewSettingsDemo.sourceCode).toBe("string");
        expect(listviewSettingsDemo.defaultWidth).toBe(640);
        expect(listviewSettingsDemo.defaultHeight).toBe(480);
        expect(listviewSettingsDemo.component).toBeTypeOf("function");
    });
});

describe("listviewSettingsDemo layout", () => {
    it("installs a header bar with a search toggle starting inactive", async () => {
        await renderDemo(listviewSettingsDemo);
        await findInactiveSearchToggle();
    });

    it("splits the sidebar list from the column-view details across the paned", async () => {
        await renderDemo(listviewSettingsDemo);
        const paned = (await screen.findByName("paned")) as Gtk.Paned;
        const start = paned.getStartChild();
        const end = paned.getEndChild();
        expect(start).not.toBeNull();
        expect(end).not.toBeNull();
        expect(within(start as Gtk.Widget).getByName("sidebar")).toBeInstanceOf(Gtk.ListView);
        expect(within(end as Gtk.Widget).getByName("column-view")).toBeInstanceOf(Gtk.ColumnView);
    });

    it("populates the navigation sidebar list with the schema tree", async () => {
        await renderDemo(listviewSettingsDemo);
        const sidebar = (await screen.findByName("sidebar")) as Gtk.ListView;
        expect(sidebar.getCssClasses()).toContain("navigation-sidebar");
        expect((sidebar.getModel() as Gtk.SelectionModel).getNItems()).toBeGreaterThan(0);
    });

    it("renders a search bar starting disabled with an empty search entry inside", async () => {
        await renderDemo(listviewSettingsDemo);
        const searchBar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
        expect(searchBar.getSearchMode()).toBe(false);
        const searchEntry = (await screen.findByName("search-entry")) as Gtk.SearchEntry;
        expect(searchEntry.getText()).toBe("");
    });
});

describe("listviewSettingsDemo column view", () => {
    it("renders a GtkColumnView with the expected columns", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        expect([...readColumns(columnView).keys()]).toEqual([
            "Name",
            "Value",
            "Type",
            "Default",
            "Summary",
            "Description",
        ]);
    });

    it("hides the Summary and Description columns by default", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        const byTitle = readColumns(columnView);
        expect(byTitle.get("Summary")?.getVisible()).toBe(false);
        expect(byTitle.get("Description")?.getVisible()).toBe(false);
        expect(byTitle.get("Name")?.getVisible()).toBe(true);
    });

    it("attaches a selection model to the column view", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        await waitFor(() => expect(columnView.getModel()).toBeInstanceOf(Gtk.SelectionModel));
    });

    it("exposes the column view's column count once the React commit settles", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        await waitFor(() => {
            expect(columnView.getColumns().getNItems()).toBe(6);
        });
    });

    it("attaches a header menu only to the four toggleable columns", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        await waitFor(
            () => {
                const byTitle = readColumns(columnView);
                for (const title of ["Type", "Default", "Summary", "Description"]) {
                    expect(byTitle.get(title)?.getHeaderMenu()).not.toBeNull();
                }
            },
            { timeout: 3000 },
        );
        const byTitle = readColumns(columnView);
        expect(byTitle.get("Name")?.getHeaderMenu()).toBeNull();
        expect(byTitle.get("Value")?.getHeaderMenu()).toBeNull();
        const withMenus = [...byTitle.values()].filter((col) => col.getHeaderMenu() !== null);
        expect(withMenus).toHaveLength(4);
    });

    it("shows a column when its visibility menu action is activated", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = (await screen.findByName("column-view")) as Gtk.ColumnView;
        expect(readColumns(columnView).get("Summary")?.getVisible()).toBe(false);
        columnView.activateAction("columnview.show-summary", null);
        await waitFor(() => expect(readColumns(columnView).get("Summary")?.getVisible()).toBe(true));
    });
});

describe("listviewSettingsDemo schema interactions", () => {
    it("loads keys into the column view when a schema is selected", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = await selectFirstSchemaWithKeys();
        expect(itemCount(columnView)).toBeGreaterThan(0);
    });

    it("opens the key search bar when the titlebar toggle is activated", async () => {
        await renderDemo(listviewSettingsDemo);
        await openKeySearch();
    });

    it("filters the column view to zero rows for a non-matching query and restores on clear", async () => {
        const { columnView, full, entry } = await filterKeysToZero();
        await userEvent.clear(entry);
        await waitFor(() => expect(itemCount(columnView)).toBe(full));
    });

    it("clears the key search filter when the search entry stops searching", async () => {
        const { columnView, full, entry } = await filterKeysToZero();
        await userEvent.keyboard(entry, "{Escape}");
        const searchBar = (await screen.findByName("search-bar")) as Gtk.SearchBar;
        await waitFor(() => expect(searchBar.getSearchMode()).toBe(false));
        await waitFor(() => expect(itemCount(columnView)).toBe(full));
    });
});

describe("listviewSettingsDemo value editing", () => {
    it("commits a valid edited boolean value to GSettings and reflects it in the row", async () => {
        const setValueSpy = vi.spyOn(Gio.Settings.prototype, "setValue").mockReturnValue(true);
        try {
            await renderDemo(listviewSettingsDemo);
            const columnView = await selectFirstSchemaWithKeys();
            const editables = collectEditableLabels(columnView);
            const boolEditable = editables.find((e) => e.getText() === "true" || e.getText() === "false");
            expect(boolEditable, "expected a boolean-valued key in the first schema").toBeDefined();
            const target = boolEditable as Gtk.EditableLabel;
            const flipped = target.getText() === "true" ? "false" : "true";
            setValueSpy.mockClear();
            target.setText(flipped);
            await waitFor(() => expect(target.getText()).toBe(flipped));
            expect(setValueSpy).toHaveBeenCalled();
            const committed = setValueSpy.mock.calls.some((call) => (call[1] as GLib.Variant).print(false) === flipped);
            expect(committed).toBe(true);
        } finally {
            setValueSpy.mockRestore();
        }
    });

    it("rejects an unparseable edited value with an error bell and writes nothing", async () => {
        const setValueSpy = vi.spyOn(Gio.Settings.prototype, "setValue").mockReturnValue(true);
        try {
            await renderDemo(listviewSettingsDemo);
            const columnView = await selectFirstSchemaWithKeys();
            const [target] = collectEditableLabels(columnView);
            expect(target).toBeDefined();
            const editable = target as Gtk.EditableLabel;
            const errorBellSpy = vi.spyOn(editable, "errorBell");
            setValueSpy.mockClear();
            editable.setText("!!not-a-valid-variant!!");
            await waitFor(() => expect(errorBellSpy).toHaveBeenCalled());
            expect(setValueSpy).not.toHaveBeenCalled();
            errorBellSpy.mockRestore();
        } finally {
            setValueSpy.mockRestore();
        }
    });
});
