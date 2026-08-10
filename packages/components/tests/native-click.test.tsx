import type { ListItem, ListItemRenderArgs } from "@gtkx/components";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel, GtkListBox, GtkListBoxRow } from "@gtkx/jsx/gtk";
import { render, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    firstSecondItems,
    type NamedValue,
    renderColumnView,
    renderStatefulListView,
} from "./helpers/list-fixtures.js";

type Named = { name: string };
type SortListener = (column: string | null, order: Gtk.SortType) => void;

const treeItems: ListItem<Named>[] = [
    { id: "parent", value: { name: "Parent" }, children: [{ id: "child", value: { name: "Child" } }] },
    { id: "leaf", value: { name: "Leaf" } },
];

const renderName = ({ item }: ListItemRenderArgs<Named>): ReactNode => <GtkLabel>{item.name}</GtkLabel>;
const renderNamedValue = ({ item }: { item: unknown }): ReactNode => <GtkLabel>{(item as NamedValue).name}</GtkLabel>;

const secondRow = async (): Promise<Gtk.Widget> => {
    const [, row] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);

    if (row === undefined) {
        throw new TypeError("Expected a second list row");
    }

    return row;
};

const expanderNamed = (name: string): Gtk.TreeExpander =>
    screen.getByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.TreeExpander });

const renderSortableColumns = async (onSortChanged: SortListener): Promise<Gtk.Widget> => {
    await renderColumnView(firstSecondItems, {
        columns: [{ id: "name", title: "Name", renderCell: renderNamedValue, isSortable: true }],
        onSortChanged,
    });

    return screen.getByRole(Gtk.AccessibleRole.COLUMN_HEADER, { name: "Name" });
};

describe("clicking a ListView row", () => {
    it("moves the controlled selection to the clicked row", async () => {
        await renderStatefulListView(firstSecondItems);
        await userEvent.click(await secondRow());

        await waitFor(() => {
            expect(screen.queryAllByText("selected:2")).toHaveLength(1);
        });
    });

    it("moves the controlled selection when the label inside the row is clicked", async () => {
        await renderStatefulListView(firstSecondItems);
        await userEvent.click(screen.getByText("First"));

        await waitFor(() => {
            expect(screen.queryAllByText("selected:1")).toHaveLength(1);
        });
    });
});

describe("clicking a tree expander inside a ListView", () => {
    it("expands the row it belongs to", async () => {
        await renderStatefulListView(treeItems, { renderItem: renderName });
        await userEvent.click(expanderNamed("Parent"));

        await waitFor(() => {
            expect(screen.queryAllByText("Child")).toHaveLength(1);
        });
    });

    it("collapses the row again on a second click", async () => {
        await renderStatefulListView(treeItems, { renderItem: renderName, expandedIds: ["parent"] });
        await userEvent.click(expanderNamed("Parent"));

        await waitFor(() => {
            expect(screen.queryAllByText("Child")).toHaveLength(0);
        });
    });
});

describe("clicking a sortable ColumnView header", () => {
    it("reports the column and an ascending order", async () => {
        const onSortChanged = vi.fn();
        await userEvent.click(await renderSortableColumns(onSortChanged));

        await waitFor(() => {
            expect(onSortChanged).toHaveBeenCalledWith("name", Gtk.SortType.ASCENDING);
        });
    });

    it("inverts the order on a second click", async () => {
        const onSortChanged = vi.fn();
        const header = await renderSortableColumns(onSortChanged);
        await userEvent.click(header);
        await userEvent.click(header);

        await waitFor(() => {
            expect(onSortChanged).toHaveBeenCalledWith("name", Gtk.SortType.DESCENDING);
        });
    });
});

describe("clicking widgets whose click path is unchanged", () => {
    it("still emits clicked on a plain button", async () => {
        const onClicked = vi.fn();
        await render(<GtkButton label="Save" onClicked={onClicked} />);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" }));
        expect(onClicked).toHaveBeenCalledTimes(1);
    });

    it("still activates and selects a list box row", async () => {
        const onRowActivated = vi.fn();

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkListBox onRowActivated={onRowActivated} selectionMode={Gtk.SelectionMode.SINGLE}>
                    <GtkListBoxRow>
                        <GtkLabel label="Alpha" />
                    </GtkListBoxRow>
                    <GtkListBoxRow>
                        <GtkLabel label="Beta" />
                    </GtkListBoxRow>
                </GtkListBox>
            </GtkBox>,
        );

        const rows = screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM);
        const row = rows[1];

        if (!(row instanceof Gtk.ListBoxRow)) {
            throw new TypeError("Expected a list box row");
        }

        await userEvent.click(row);
        expect(onRowActivated).toHaveBeenCalledTimes(1);
        expect(row.isSelected()).toBe(true);
    });

    it("still activates an Adwaita action row", async () => {
        const onActivated = vi.fn();

        await render(
            <AdwPreferencesGroup>
                <AdwActionRow title="Open" activatable onActivated={onActivated} />
            </AdwPreferencesGroup>,
        );

        await userEvent.click(screen.getByText("Open"));
        expect(onActivated).toHaveBeenCalledTimes(1);
    });
});
