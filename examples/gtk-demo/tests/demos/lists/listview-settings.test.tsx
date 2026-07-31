import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { listviewSettingsDemo } from "../../../src/demos/lists/listview-settings.js";
import { findInactiveSearchToggle, renderDemo } from "../../test-utils.js";

type FilteredToZeroState = {
    columnView: Gtk.ColumnView;
    full: number;
    entry: Gtk.SearchEntry;
};

const titledColumn = (candidate: unknown): [string, Gtk.ColumnViewColumn] | null => {
    if (!(candidate instanceof Gtk.ColumnViewColumn)) {
        return null;
    }

    const title = candidate.getTitle();

    return title ? [title, candidate] : null;
};

const readColumns = (cv: Gtk.ColumnView): Map<string, Gtk.ColumnViewColumn> => {
    const out: Map<string, Gtk.ColumnViewColumn> = new Map();
    const columns = cv.getColumns();

    for (let i = 0; i < columns.getNItems(); i++) {
        const entry = titledColumn(columns.getItem(i));

        if (entry) {
            out.set(entry[0], entry[1]);
        }
    }

    return out;
};

const collectEditableLabels = (widget: Gtk.Widget, out: Gtk.EditableLabel[] = []): Gtk.EditableLabel[] => {
    if (widget instanceof Gtk.EditableLabel) {
        out.push(widget);
    }

    let child = widget.getFirstChild();

    while (child) {
        collectEditableLabels(child, out);
        child = child.getNextSibling();
    }

    return out;
};

const itemCount = (cv: Gtk.ColumnView): number => (cv.getModel())?.getNItems() ?? 0;

const selectFirstSchemaWithKeys = async (): Promise<Gtk.ColumnView> => {
    const sidebar = await screen.findByName("sidebar", { as: Gtk.ListView });
    await userEvent.selectOptions(sidebar, 0);
    const columnView = await screen.findByName("column-view", { as: Gtk.ColumnView });

    await waitFor(() => {
        expect(itemCount(columnView)).toBeGreaterThan(0);
    });

    return columnView;
};

const booleanEditableIn = (columnView: Gtk.ColumnView): Gtk.EditableLabel | undefined =>
    collectEditableLabels(columnView).find((e) => e.getText() === "true" || e.getText() === "false");

const booleanEditableAtRow = async (sidebar: Gtk.ListView, index: number): Promise<Gtk.EditableLabel | undefined> => {
    await userEvent.selectOptions(sidebar, index);

    return booleanEditableIn(await screen.findByName("column-view", { as: Gtk.ColumnView }));
};

const selectSchemaWithBooleanKey = async (): Promise<Gtk.EditableLabel> => {
    const sidebar = await screen.findByName("sidebar", { as: Gtk.ListView });
    const rowCount = sidebar.getModel()?.getNItems() ?? 0;

    for (let index = 0; index < rowCount; index++) {
        const editable = await booleanEditableAtRow(sidebar, index);

        if (editable !== undefined) {
            return editable;
        }
    }

    throw new Error("No GSettings schema installed on this system exposes a boolean-valued key");
};

const openKeySearch = async (): Promise<Gtk.SearchEntry> => {
    const toggle = await screen.findByName("search-toggle", { as: Gtk.ToggleButton });
    await userEvent.click(toggle);
    const searchBar = await screen.findByName("search-bar", { as: Gtk.SearchBar });

    await waitFor(() => {
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", true);
    });

    return screen.findByName("search-entry", { as: Gtk.SearchEntry });
};

const filterKeysToZero = async (): Promise<FilteredToZeroState> => {
    await renderDemo(listviewSettingsDemo);
    const columnView = await selectFirstSchemaWithKeys();
    const full = itemCount(columnView);
    const entry = await openKeySearch();
    await userEvent.type(entry, "zzqqxx");

    await waitFor(() => {
        expect(itemCount(columnView)).toBe(0);
    });

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
        const toggle = await findInactiveSearchToggle();
        expect(toggle).toHaveObjectProperty("active", false);
    });

    it("splits the sidebar list from the column-view details across the paned", async () => {
        await renderDemo(listviewSettingsDemo);
        const paned = await screen.findByName("paned", { as: Gtk.Paned });
        const start = paned.getStartChild();
        const end = paned.getEndChild();
        expect(start).not.toBeNull();
        expect(end).not.toBeNull();
        expect(within(start as Gtk.Widget).getByName("sidebar")).toBeInstanceOf(Gtk.ListView);
        expect(within(end as Gtk.Widget).getByName("column-view")).toBeInstanceOf(Gtk.ColumnView);
    });

    it("populates the navigation sidebar list with the schema tree", async () => {
        await renderDemo(listviewSettingsDemo);
        const sidebar = await screen.findByName("sidebar", { as: Gtk.ListView });
        expect(sidebar).toHaveClass("navigation-sidebar");
        expect((sidebar.getModel() as Gtk.SelectionModel).getNItems()).toBeGreaterThan(0);
    });

    it("renders a search bar starting disabled with an empty search entry inside", async () => {
        await renderDemo(listviewSettingsDemo);
        const searchBar = await screen.findByName("search-bar", { as: Gtk.SearchBar });
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
        const searchEntry = await screen.findByName("search-entry", { as: Gtk.SearchEntry });
        expect(searchEntry).toHaveObjectProperty("text", "");
    });
});

describe("listviewSettingsDemo column view", () => {
    it("renders a GtkColumnView with the expected columns", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = await screen.findByName("column-view", { as: Gtk.ColumnView });

        expect(readColumns(columnView).keys().toArray()).toEqual([
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
        const columnView = await screen.findByName("column-view", { as: Gtk.ColumnView });
        const byTitle = readColumns(columnView);
        expect(byTitle.get("Summary")).toHaveObjectProperty("visible", false);
        expect(byTitle.get("Description")).toHaveObjectProperty("visible", false);
        expect(byTitle.get("Name")).toHaveObjectProperty("visible", true);
    });

    it("attaches a selection model to the column view", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = await screen.findByName("column-view", { as: Gtk.ColumnView });

        await waitFor(() => {
            expect(columnView.getModel()).toBeInstanceOf(Gtk.SelectionModel);
        });
    });

    it("exposes the column view's column count once the React commit settles", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = await screen.findByName("column-view", { as: Gtk.ColumnView });

        await waitFor(() => {
            expect(columnView.getColumns()).toHaveObjectProperty("nItems", 6);
        });
    });
});

describe("listviewSettingsDemo column header menus", () => {
    it("attaches a header menu only to the four toggleable columns", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = await screen.findByName("column-view", { as: Gtk.ColumnView });

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
        const withMenus = byTitle.values().filter((col) => col.getHeaderMenu() !== null).toArray();
        expect(withMenus).toHaveLength(4);
    });

    it("shows a column when its visibility menu action is activated", async () => {
        await renderDemo(listviewSettingsDemo);
        const columnView = await screen.findByName("column-view", { as: Gtk.ColumnView });
        expect(readColumns(columnView).get("Summary")).toHaveObjectProperty("visible", false);
        columnView.activateAction("columnview.show-summary", null);

        await waitFor(() => {
            expect(readColumns(columnView).get("Summary")).toHaveObjectProperty("visible", true);
        });
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
        const searchBar = await screen.findByName("search-bar", { as: Gtk.SearchBar });
        expect(searchBar).toHaveObjectProperty("searchModeEnabled", true);
    });

    it("filters the column view to zero rows for a non-matching query and restores on clear", async () => {
        const { columnView, full, entry } = await filterKeysToZero();
        await userEvent.clear(entry);

        await waitFor(() => {
            expect(itemCount(columnView)).toBe(full);
        });
    });

    it("clears the key search filter when the search entry stops searching", async () => {
        const { columnView, full, entry } = await filterKeysToZero();
        await userEvent.keyboard(entry, "{Escape}");
        const searchBar = await screen.findByName("search-bar", { as: Gtk.SearchBar });

        await waitFor(() => {
            expect(searchBar).toHaveObjectProperty("searchModeEnabled", false);
        });

        await waitFor(() => {
            expect(itemCount(columnView)).toBe(full);
        });
    });
});

describe("listviewSettingsDemo value editing", () => {
    it("commits a valid edited boolean value to GSettings and reflects it in the row", async () => {
        const setValueSpy = vi.spyOn(Gio.Settings.prototype, "setValue").mockReturnValue(true);

        try {
            await renderDemo(listviewSettingsDemo);
            const target = await selectSchemaWithBooleanKey();
            const flipped = target.getText() === "true" ? "false" : "true";
            setValueSpy.mockClear();
            target.setText(flipped);

            await waitFor(() => {
                expect(target).toHaveObjectProperty("text", flipped);
            });

            expect(setValueSpy).toHaveBeenCalled();
            const isCommitted = setValueSpy.mock.calls.some((call) => (call[1]).print(false) === flipped);
            expect(isCommitted).toBe(true);
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

            await waitFor(() => {
                expect(errorBellSpy).toHaveBeenCalled();
            });

            expect(setValueSpy).not.toHaveBeenCalled();
            errorBellSpy.mockRestore();
        } finally {
            setValueSpy.mockRestore();
        }
    });
});
