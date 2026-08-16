import type { ColumnViewColumn, ListItem, ListItemRenderArgs, ListSection } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ColumnView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { getWidgetText, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
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
import { expectNoBoxBetween } from "./helpers/widget-chain.js";

type Named = { name: string };
type Person = { name: string; salary: number };

const ESTIMATED_HEIGHT = 48;
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

const firstRowCells = (columnView: Gtk.ColumnView): Gtk.Widget[] => {
    const [firstRow] = dataRows(columnView);

    if (firstRow === undefined) {
        throw new TypeError("Expected a data row");
    }

    return within(firstRow).getAllByRole(Gtk.AccessibleRole.GRID_CELL);
};

const expectCellHoldsLabel = (cell: Gtk.Widget, columnView: Gtk.ColumnView): void => {
    const [label] = within(cell).getAllByRole(Gtk.AccessibleRole.LABEL);

    if (label === undefined) {
        throw new TypeError("Expected the cell to hold a label");
    }

    expect(cell.getFirstChild()).toBe(label);
    expectNoBoxBetween(label, columnView);
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
    it("renders each cell's content as the cell's direct child", async () => {
        const { ref } = await renderColumnView(personRows(null), { columns: personColumns });
        const cells = firstRowCells(ref.current);
        expect(cells).toHaveLength(2);

        for (const cell of cells) {
            expectCellHoldsLabel(cell, ref.current);
        }
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
        const onSortChanged = vi.fn();
        await renderColumnView(personRows(null), { columns: personColumns, onSortChanged });
        const header = screen.getByRole(Gtk.AccessibleRole.COLUMN_HEADER, { name: "Name" });
        await userEvent.click(header);

        await waitFor(() => {
            expect(onSortChanged).toHaveBeenCalledWith("name", Gtk.SortType.ASCENDING);
        });

        await userEvent.click(header);

        await waitFor(() => {
            expect(onSortChanged).toHaveBeenCalledWith("name", Gtk.SortType.DESCENDING);
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
});

describe("ColumnView selection", () => {
    it("applies a selectedIds change after mount and reports it once", async () => {
        const onSelectionChanged = vi.fn();
        const options = { columns: personColumns, selectionMode: Gtk.SelectionMode.MULTIPLE, onSelectionChanged };
        const { ref, rerender } = await renderColumnView(personRows(null), { ...options, selected: [] });
        onSelectionChanged.mockClear();
        await rerender(personRows(null), { ...options, selected: ["Charlie", "Bob"] });

        await waitFor(() => {
            const model = getSelectionModel(ref);
            expect(model.getSelection().getSize()).toBe(2n);
            expect(model.isSelected(0)).toBe(true);
            expect(model.isSelected(1)).toBe(false);
            expect(model.isSelected(2)).toBe(true);
        });

        expect(onSelectionChanged.mock.calls).toEqual([[["Charlie", "Bob"]]]);
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
