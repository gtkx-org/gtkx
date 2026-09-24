import type { ColumnViewColumn, ListItem, ListItemRenderArgs, ListSection } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ColumnView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, getWidgetText, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import {
    asCollectionView,
    expectFiltering,
    expectLargeReordering,
    expectReordering,
} from "./helpers/collection-view.js";
import { dataRows } from "./helpers/column-rows.js";
import { renderColumnView } from "./helpers/list-fixtures.js";
import { expectRowTexts } from "./helpers/row-texts.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { getSelectionModel } from "./helpers/selection-model.js";

type Named = { name: string };
type Person = { name: string; salary: number };

const ESTIMATED_HEIGHT = 48;
const LARGE_COLUMN_COUNT = 200_000;
const VISIBLE_ROWS = 10;

const sizedItems: ListItem<Named>[] = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    value: { name: `Item ${String(index)}` },
}));

const people: Person[] = [
    { name: "Charlie", salary: 60_000 },
    { name: "Alice", salary: 50_000 },
    { name: "Bob", salary: 55_000 },
];

const personColumns: ColumnViewColumn<Person>[] = [
    { id: "name", title: "Name", expand: true, isSortable: true, renderCell: renderNamed },
    {
        id: "salary",
        title: "Salary",
        expand: true,
        isSortable: true,
        renderCell: ({ item }) => <GtkLabel>{String(item.salary)}</GtkLabel>,
    },
];

const sections: ListSection<string, Named>[] = [
    {
        id: "s1",
        value: "One",
        data: [
            { id: "p1", value: { name: "Parent 1" }, children: [{ id: "c1", value: { name: "Child 1" } }] },
            { id: "x1", value: { name: "Solo 1" } },
        ],
    },
    {
        id: "s2",
        value: "Two",
        data: [{ id: "p2", value: { name: "Parent 2" }, children: [{ id: "c2", value: { name: "Child 2" } }] }],
    },
];

function renderNamed({ item }: ListItemRenderArgs<Named>): ReactNode {
    return <GtkLabel>{item.name}</GtkLabel>;
}

const cellText = (cell: Gtk.Widget): string => {
    const [label] = within(cell).getAllByRole(Gtk.AccessibleRole.LABEL);

    return label ? (getWidgetText(label) ?? "") : "";
};

const rowCellTexts = (row: Gtk.Widget): string[] =>
    within(row)
        .getAllByRole(Gtk.AccessibleRole.GRID_CELL)
        .map((cell) => cellText(cell));

const firstRowTexts = (columnView: Gtk.ColumnView): string[] => {
    const [firstRow] = dataRows(columnView);

    return firstRow === undefined ? [] : rowCellTexts(firstRow);
};

const firstColumnTexts = (columnView: Gtk.ColumnView): string[] =>
    dataRows(columnView)
        .map((row) => rowCellTexts(row)[0])
        .filter((text): text is string => text !== undefined && text.length > 0);

const primarySort = (columnView: Gtk.ColumnView): [string | null, Gtk.SortType] => {
    const sorter = columnView.getSorter();

    if (!(sorter instanceof Gtk.ColumnViewSorter)) {
        throw new TypeError("Expected the column view to expose a column sorter");
    }

    return [sorter.getPrimarySortColumn()?.getId() ?? null, sorter.getPrimarySortOrder()];
};

const cellSizeRequests = (columnView: Gtk.ColumnView): [number, number][] =>
    within(columnView)
        .getAllByRole(Gtk.AccessibleRole.GRID_CELL)
        .map((cell) => cell.getFirstChild())
        .filter((box): box is Gtk.Widget => box !== null)
        .map((box) => box.getSizeRequest());

const columnViewView = async (items: string[]) => asCollectionView(await renderColumnView(items), firstColumnTexts);

const personRows = (sortColumn: string | null): ListItem<Person>[] => {
    const sorted =
        sortColumn === null ? people : people.toSorted((left, right) => left.name.localeCompare(right.name));

    return sorted.map((person) => ({ id: person.name, value: person }));
};

const renderSizedCells = async (estimatedItemHeight?: number): Promise<Gtk.ColumnView> => {
    const ref = createRef<Gtk.ColumnView>();

    await render(
        <ScrollWrapper minContentHeight={200}>
            <ColumnView<Named>
                ref={ref}
                items={sizedItems}
                estimatedItemHeight={estimatedItemHeight}
                columns={[{ id: "name", title: "Name", renderCell: () => null }]}
            />
        </ScrollWrapper>,
    );

    if (ref.current === null) {
        throw new TypeError("Expected the column view to render");
    }

    return ref.current;
};

const drawSections = (ref: RefObject<Gtk.ColumnView | null>, groups: ListSection<string, Named>[]): ReactNode => (
    <ScrollWrapper minContentHeight={500}>
        <ColumnView<Named, string>
            ref={ref}
            sections={groups}
            expandedIds={["p1", "p2"]}
            columns={[{ id: "name", title: "Name", renderCell: renderNamed }]}
            renderHeader={({ section }: { section: string }) => <GtkLabel>{`H:${section}`}</GtkLabel>}
        />
    </ScrollWrapper>
);

describe("ColumnView", () => {
    it("draws a cell per column and follows insertions, removals and value changes", async () => {
        const { ref, rerender } = await renderColumnView(personRows(null), { columns: personColumns });
        expect(firstRowTexts(ref.current)).toEqual(["Charlie", "60000"]);
        expect(firstColumnTexts(ref.current)).toEqual(["Charlie", "Alice", "Bob"]);

        await rerender(
            [
                { id: "Charlie", value: { name: "Charlie", salary: 65_000 } },
                { id: "Bob", value: { name: "Bob", salary: 55_000 } },
            ],
            { columns: personColumns },
        );

        expect(firstColumnTexts(ref.current)).toEqual(["Charlie", "Bob"]);
        expect(firstRowTexts(ref.current)).toEqual(["Charlie", "65000"]);
    });

    it("reorders rows to match the items array", async () => {
        await expectReordering(columnViewView);
    });

    it("keeps a filtered list and a large list in the order they are given", async () => {
        await expectFiltering(columnViewView);
        await expectLargeReordering(columnViewView);
    });
});

describe("ColumnView cells", () => {
    it("displays updated cells and appended rows in a large flat source", async () => {
        const items: ListItem<Named>[] = Array.from({ length: LARGE_COLUMN_COUNT }, (_, index) => ({
            id: String(index),
            value: { name: `Item ${String(index)}` },
        }));
        const options = {
            columns: Array.from({ length: 5 }, (_, index) => ({
                id: `column-${String(index)}`,
                title: `Column ${String(index)}`,
                renderCell: renderNamed,
            })),
            rowProps: ({ item }: ListItemRenderArgs<Named>) => ({ accessibleLabel: `Row: ${item.name}` }),
            isFlat: true,
            estimatedItemHeight: 40,
            minContentHeight: 200,
            maxContentHeight: 200,
        };
        const { ref, rerender } = await renderColumnView(items, options);
        expect(dataRows(ref.current)[0]).toHaveAccessibleName("Row: Item 0");

        const appended = [...items, { id: "appended", value: { name: "Appended" } }];
        await rerender(appended);
        expect(dataRows(ref.current)[0]).toHaveAccessibleName("Row: Item 0");

        await rerender(appended.with(0, { id: "replacement", value: { name: "Replacement" } }));
        expect(screen.getAllByText("Replacement")).toHaveLength(options.columns.length);
        expect(dataRows(ref.current)[0]).toHaveAccessibleName("Row: Replacement");
        expect(screen.queryAllByText("Item 0")).toHaveLength(0);

        await act(() => {
            ref.current.scrollTo(LARGE_COLUMN_COUNT, null, Gtk.ListScrollFlags.NONE, null);
        });
        await waitFor(() => {
            expect(screen.getByRole(Gtk.AccessibleRole.ROW, { name: "Row: Appended" })).toBeVisible();
        });
    });
});

describe("ColumnView row accessibility", () => {
    it("updates the row label and description when its item changes", async () => {
        const { ref, rerender } = await renderColumnView([{ id: "person", value: { name: "Alice" } }], {
            rowProps: ({ item }) => ({
                accessibleLabel: `Row: ${item.name}`,
                accessibleDescription: `Details for ${item.name}`,
            }),
        });
        const row = within(ref.current).getByRole(Gtk.AccessibleRole.ROW, { name: "Row: Alice" });
        expect(row).toHaveAccessibleDescription("Details for Alice");

        await rerender([{ id: "person", value: { name: "Bob" } }]);

        expect(row).toHaveAccessibleName("Row: Bob");
        expect(row).toHaveAccessibleDescription("Details for Bob");
    });

    it("clears omitted row labels and descriptions", async () => {
        const items = [{ id: "person", value: { name: "Alice" } }];
        const { ref, rerender } = await renderColumnView(items, {
            rowProps: () => ({ accessibleLabel: "Person", accessibleDescription: "Person details" }),
        });
        const row = within(ref.current).getByRole(Gtk.AccessibleRole.ROW, { name: "Person" });
        expect(row).toHaveAccessibleDescription("Person details");

        await rerender(items, { rowProps: () => ({}) });

        expect(row).toHaveAccessibleName("Alice");
        expect(row).not.toHaveAccessibleDescription();
    });

    it("propagates a failed row property resolver", async () => {
        await expect(renderColumnView([{ id: "person", value: { name: "Alice" } }], {
            rowProps: () => {
                throw new Error("Row properties unavailable");
            },
        })).rejects.toThrow();
    });
});

describe("ColumnView estimated item size", () => {
    it("sizes the data-row cells from estimatedItemHeight and leaves them unsized without it", async () => {
        const sized = cellSizeRequests(await renderSizedCells(ESTIMATED_HEIGHT));
        expect(sized).toHaveLength(VISIBLE_ROWS);

        for (const [width, height] of sized) {
            expect(width).toBe(-1);
            expect(height).toBe(ESTIMATED_HEIGHT);
        }

        const unsized = cellSizeRequests(await renderSizedCells());
        expect(unsized).toHaveLength(sizedItems.length);

        for (const [width, height] of unsized) {
            expect(width).toBe(-1);
            expect(height).toBe(-1);
        }
    });
});

describe("ColumnView sorting", () => {
    it("reports the column and the order when the user clicks a sortable header", async () => {
        const sortChanges: [string | null, Gtk.SortType][] = [];
        const onSortChanged = (column: string | null, order: Gtk.SortType): void => {
            sortChanges.push([column, order]);
        };
        await renderColumnView(personRows(null), { columns: personColumns, onSortChanged });
        const header = screen.getByRole(Gtk.AccessibleRole.COLUMN_HEADER, { name: "Name" });
        await userEvent.click(header);

        await waitFor(() => {
            expect(sortChanges.at(-1)).toEqual(["name", Gtk.SortType.ASCENDING]);
        });

        await userEvent.click(header);

        await waitFor(() => {
            expect(sortChanges.at(-1)).toEqual(["name", Gtk.SortType.DESCENDING]);
        });
    });

    it("draws the order the caller sorts into and back to declaration order", async () => {
        const options = { columns: personColumns, sortOrder: Gtk.SortType.ASCENDING };
        const { ref, rerender } = await renderColumnView(personRows(null), { ...options, sortColumn: null });
        expect(firstColumnTexts(ref.current)).toEqual(["Charlie", "Alice", "Bob"]);
        await rerender(personRows("name"), { ...options, sortColumn: "name" });
        expect(firstColumnTexts(ref.current)).toEqual(["Alice", "Bob", "Charlie"]);
        expect(primarySort(ref.current)).toEqual(["name", Gtk.SortType.ASCENDING]);
        await rerender(personRows(null), { ...options, sortColumn: null });
        expect(firstColumnTexts(ref.current)).toEqual(["Charlie", "Alice", "Bob"]);
        expect(primarySort(ref.current)).toEqual([null, Gtk.SortType.ASCENDING]);
    });

    it("restores the controlled sort after the user selects another column", async () => {
        const sortChanges: [string | null, Gtk.SortType][] = [];
        const onSortChanged = (column: string | null, order: Gtk.SortType): void => {
            sortChanges.push([column, order]);
        };
        const { ref } = await renderColumnView(personRows("name"), {
            columns: personColumns,
            sortColumn: "name",
            sortOrder: Gtk.SortType.ASCENDING,
            onSortChanged,
        });
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.COLUMN_HEADER, { name: "Salary" }));

        await waitFor(() => {
            expect(sortChanges).toEqual([["salary", Gtk.SortType.ASCENDING]]);
            expect(primarySort(ref.current)).toEqual(["name", Gtk.SortType.ASCENDING]);
        });
    });
});

describe("ColumnView selection", () => {
    it("applies a selectedIds change after mount and reports it once", async () => {
        const selectionChanges: string[][] = [];
        const onSelectionChanged = (ids: string[]): void => {
            selectionChanges.push(ids);
        };
        const options = { columns: personColumns, selectionMode: Gtk.SelectionMode.MULTIPLE, onSelectionChanged };
        const { ref, rerender } = await renderColumnView(personRows(null), { ...options, selected: [] });
        selectionChanges.length = 0;
        await rerender(personRows(null), { ...options, selected: ["Charlie", "Bob"] });

        await waitFor(() => {
            const model = getSelectionModel(ref);
            expect(model.getSelection().getSize()).toBe(2n);
            expect(model.isSelected(0)).toBe(true);
            expect(model.isSelected(1)).toBe(false);
            expect(model.isSelected(2)).toBe(true);
        });

        expect(selectionChanges).toEqual([["Charlie", "Bob"]]);
    });
});

describe("ColumnView sections", () => {
    it("expands rows nested under a section and keeps a later section expanded when an earlier one goes", async () => {
        const ref = createRef<Gtk.ColumnView>();
        const { rerender } = await render(drawSections(ref, sections));
        await expectRowTexts(ref, ["Name", "H:One", "Parent 1", "Child 1", "Solo 1", "H:Two", "Parent 2", "Child 2"]);
        await rerender(drawSections(ref, sections.slice(1)));
        await expectRowTexts(ref, ["Name", "H:Two", "Parent 2", "Child 2"]);
    });
});
