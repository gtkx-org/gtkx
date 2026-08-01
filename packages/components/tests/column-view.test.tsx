import { ColumnView, type ListItemRenderer } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, getWidgetNodeText, render, screen, within } from "@gtkx/testing";
import { createRef, useCallback, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
    type CollectionView,
    COUNTER_BASELINE_TEXTS,
    COUNTER_SINGLE_UPDATE_TEXTS,
    counterBaselineRows,
    counterSingleUpdateRows,
    expectFilteredViewReorder,
    expectInitialOrder,
    expectLargeDatasetReorder,
    expectRapidReorder,
    expectReorder,
    namedLabelRenderItem,
    namedRows,
    RAPID_REORDER_ORDERS,
} from "./helpers/list-collection-render.js";
import {
    type ColumnViewColumn,
    firstSecondItems,
    firstSecondThirdItems,
    renderColumnView,
} from "./helpers/list-fixtures.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { expectNoBoxBetween } from "./helpers/widget-chain.js";

type TitledColumnViewFixture = {
    ref: React.RefObject<Gtk.ColumnView>;
    rerenderTitles: (titles: string[]) => Promise<void>;
};

type Employee = {
    id: string;
    name: string;
    salary: number;
};

type SortColumn = "name" | "salary" | null;

type SortableColumnViewFixture = {
    ref: React.RefObject<Gtk.ColumnView | null>;
    employees: Employee[];
    renderOrders: string[][];
    latestOrder: () => string[] | undefined;
};

const singleNamedRow = [{ id: "1", value: { name: "First" } }];

const estimatedSizeItems = Array.from({ length: 20 }, (_, index) => ({
    id: String(index),
    value: { name: `Item ${String(index)}` },
}));

const employeeColumns: ColumnViewColumn<Employee>[] = [
    {
        id: "name",
        title: "Name",
        expand: true,
        isSortable: true,
        renderCell: ({ item }) => <GtkLabel>{item.name}</GtkLabel>,
    },
    {
        id: "salary",
        title: "Salary",
        expand: true,
        isSortable: true,
        renderCell: ({ item }) => <GtkLabel>{`$${String(item.salary)}`}</GtkLabel>,
    },
];

const cellText = (cell: Gtk.Widget): string => {
    const [label] = within(cell).getAllByRole(Gtk.AccessibleRole.LABEL);

    return label ? (getWidgetNodeText(label) ?? "") : "";
};

const rowCellTexts = (row: Gtk.Widget): string[] =>
    within(row)
        .getAllByRole(Gtk.AccessibleRole.GRID_CELL)
        .map((cell) => cellText(cell));

const dataRows = (columnView: Gtk.ColumnView): Gtk.Widget[] =>
    within(columnView).getAllByRole(Gtk.AccessibleRole.ROW).slice(1);

const getColumnViewItemTexts = (columnView: Gtk.ColumnView): string[] =>
    dataRows(columnView)
        .map((row) => rowCellTexts(row)[0])
        .filter((text): text is string => Boolean(text));

const getFirstRowCellTexts = (columnView: Gtk.ColumnView): string[] => {
    const [firstRow] = dataRows(columnView);

    return firstRow ? rowCellTexts(firstRow) : [];
};

const collectBoxSizeRequests = (columnView: Gtk.ColumnView): [number, number][] =>
    within(columnView)
        .getAllByRole(Gtk.AccessibleRole.GRID_CELL)
        .map((cell) => cell.getFirstChild())
        .filter((box): box is Gtk.Widget => box !== null)
        .map((box) => box.getSizeRequest());

const columnViewView = async (items: Parameters<typeof renderColumnView>[0]): Promise<CollectionView> => {
    const { ref, rerender } = await renderColumnView(items);

    return { texts: () => getColumnViewItemTexts(ref.current), rerender };
};

const labelCell: ListItemRenderer<{ name: string }> = ({ item }) => <GtkLabel>{item.name}</GtkLabel>;

const titleColumns = (titles: string[]): ColumnViewColumn<{ name: string }>[] =>
    titles.map((title) => ({ id: title, title, renderCell: labelCell }));

const renderTitledColumnView = async (titles: string[]): Promise<TitledColumnViewFixture> => {
    const { ref, rerender } = await renderColumnView(singleNamedRow, { columns: titleColumns(titles) });

    return {
        ref,
        rerenderTitles: (nextTitles) => rerender(singleNamedRow, { columns: titleColumns(nextTitles) }),
    };
};

const renderAbcThenReorder = async (nextTitles: string[]): Promise<TitledColumnViewFixture> => {
    const fixture = await renderTitledColumnView(["A", "B", "C"]);
    await fixture.rerenderTitles(nextTitles);

    return fixture;
};

const orderedColumns = (ids: string[]): ColumnViewColumn<{ name: string }>[] =>
    ids.map((id) => ({
        id,
        title: id,
        renderCell: ({ item }) => <GtkLabel>{`${id}:${item.name}`}</GtkLabel>,
    }));

const generateEmployees = (count: number): Employee[] => {
    const employees: Employee[] = [];

    for (let i = 0; i < count; i++) {
        employees.push({
            id: String(i + 1),
            name: `Employee ${String(i + 1).padStart(3, "0")}`,
            salary: 50_000 + ((i * 7919) % 80_000),
        });
    }

    return employees;
};

const compareBySort = (
    a: { name: string; salary: number },
    b: { name: string; salary: number },
    sortColumn: SortColumn,
    sortOrder: Gtk.SortType,
): number => {
    const comparison = sortColumn === "name" ? a.name.localeCompare(b.name) : a.salary - b.salary;

    return sortOrder === Gtk.SortType.ASCENDING ? comparison : -comparison;
};

const expectCellsAreDirectChildLabels = (view: Gtk.ColumnView, expectedCount: number): void => {
    const [firstRow] = dataRows(view);

    if (firstRow === undefined) {
        throw new Error("Expected a data row to render");
    }

    const cells = within(firstRow).getAllByRole(Gtk.AccessibleRole.GRID_CELL);
    expect(cells).toHaveLength(expectedCount);

    for (const cell of cells) {
        const [label] = within(cell).getAllByRole(Gtk.AccessibleRole.LABEL);

        if (label === undefined) {
            throw new Error("Expected the cell to contain a label");
        }

        expect(cell.getFirstChild()).toBe(label);
        expectNoBoxBetween(label, view);
    }
};

const getExpectedColumnTitle = (columnId: string): string => `${columnId.charAt(0).toUpperCase()}${columnId.slice(1)}`;

const sortByColumnHeader = async (columnView: Gtk.ColumnView, columnId: string, order: Gtk.SortType): Promise<void> => {
    const title = getExpectedColumnTitle(columnId);
    const headers = within(columnView).getAllByRole(Gtk.AccessibleRole.COLUMN_HEADER);
    const index = headers.findIndex((header) => cellText(header) === title);
    const column = columnView.getColumns().getItem(index);

    if (column instanceof Gtk.ColumnViewColumn) {
        await act(() => {
            columnView.sortByColumn(column, order);
        });
    }
};

function SortableColumnView({
    employees,
    columnViewRef,
    onRenderOrder,
}: {
    employees: Employee[];
    columnViewRef: React.RefObject<Gtk.ColumnView | null>;
    onRenderOrder?: (ids: string[]) => void;
}) {
    const [sortColumn, setSortColumn] = useState<SortColumn>(null);
    const [sortOrder, setSortOrder] = useState<Gtk.SortType>(Gtk.SortType.ASCENDING);

    const handleSortChange = useCallback((column: string | null, order: Gtk.SortType) => {
        setSortColumn(column as SortColumn);
        setSortOrder(order);
    }, []);

    const sortedEmployees = useMemo(() => {
        if (!sortColumn) {
            return employees;
        }

        return employees.toSorted((a, b) => compareBySort(a, b, sortColumn, sortOrder));
    }, [employees, sortColumn, sortOrder]);

    if (onRenderOrder) {
        onRenderOrder(sortedEmployees.map((e) => e.id));
    }

    return (
        <ScrollWrapper minContentHeight={500}>
            <ColumnView
                ref={columnViewRef}
                sortColumn={sortColumn}
                sortOrder={sortOrder}
                onSortChanged={handleSortChange}
                items={sortedEmployees.map((emp) => ({ id: emp.id, value: emp }))}
                columns={employeeColumns}
            />
        </ScrollWrapper>
    );
}

const renderSortableColumnView = async (count: number): Promise<SortableColumnViewFixture> => {
    const employees = generateEmployees(count);
    const renderOrders: string[][] = [];
    const ref = createRef<Gtk.ColumnView>();

    await render(
        <SortableColumnView
            employees={employees}
            columnViewRef={ref}
            onRenderOrder={(ids) => {
                renderOrders.push(ids);
            }}
        />,
    );

    return { ref, employees, renderOrders, latestOrder: () => renderOrders.at(-1) };
};

const getColumnTitles = (columnView: Gtk.ColumnView): string[] =>
    within(columnView)
        .getAllByRole(Gtk.AccessibleRole.COLUMN_HEADER)
        .map((header) => cellText(header));

const createItems = (offset: number) => [
    { id: "1", value: { name: "A", count: offset } },
    { id: "2", value: { name: "B", count: offset } },
    { id: "3", value: { name: "C", count: offset } },
];

const renderEmptyCells = async (estimatedItemHeight?: number): Promise<Gtk.ColumnView> => {
    const ref = createRef<Gtk.ColumnView>();

    await render(
        <ScrollWrapper minContentHeight={200}>
            <ColumnView
                ref={ref}
                items={estimatedSizeItems}
                estimatedItemHeight={estimatedItemHeight}
                columns={[{ id: "name", title: "Name", renderCell: () => null }]}
            />
        </ScrollWrapper>,
    );

    const columnView = ref.current;

    if (columnView === null) {
        throw new Error("Expected ColumnView to render");
    }

    return columnView;
};

describe("render - ColumnView (1)", () => {
    describe("GtkColumnView", () => {
        it("creates ColumnView widget", async () => {
            const { ref } = await renderColumnView(singleNamedRow);
            expect(ref.current).not.toBeNull();
        });
    });
});

describe("render - ColumnView (2)", () => {
    describe("ColumnViewColumn", () => {
        it("adds column with title", async () => {
            const { ref } = await renderTitledColumnView(["Column Title"]);
            expect(ref.current.getColumns()).not.toBeNull();
        });

        it("inserts column before existing column", async () => {
            const { ref, rerenderTitles } = await renderTitledColumnView(["First", "Last"]);
            await rerenderTitles(["First", "Middle", "Last"]);
            expect(ref.current.getColumns()).not.toBeNull();
        });

        it("keeps cells in column order after inserting a column mid-list", async () => {
            const rows = [{ id: "1", value: { name: "r1" } }];
            const { ref, rerender } = await renderColumnView(rows, { columns: orderedColumns(["A", "C"]) });
            expect(getFirstRowCellTexts(ref.current)).toEqual(["A:r1", "C:r1"]);
            await rerender(rows, { columns: orderedColumns(["A", "B", "C"]) });
            expect(getFirstRowCellTexts(ref.current)).toEqual(["A:r1", "B:r1", "C:r1"]);
        });

        it("renders each cell's label as the cell's direct child with no wrapper container", async () => {
            const { ref } = await renderColumnView(["r1"], { columns: orderedColumns(["A", "B"]) });
            expectCellsAreDirectChildLabels(ref.current, 2);
        });

        it("removes column", async () => {
            const { ref } = await renderAbcThenReorder(["A", "C"]);
            expect(ref.current.getColumns()).not.toBeNull();
        });

        it("sets column properties (expand, fixedWidth)", async () => {
            const { ref } = await renderColumnView(singleNamedRow, {
                columns: [{ id: "props", title: "Props", expand: true, fixedWidth: 100, renderCell: labelCell }],
            });

            expect(ref.current.getColumns()).not.toBeNull();
        });

        it("updates column properties when props change", async () => {
            const { ref, rerenderTitles } = await renderTitledColumnView(["Initial"]);
            await rerenderTitles(["Updated"]);
            expect(ref.current.getColumns()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (3)", () => {
    describe("ListItem", () => {
        it("adds item to list model", async () => {
            const { ref } = await renderColumnView(
                namedRows([
                    ["1", "First"],
                    ["2", "Second"],
                ]),
            );

            expect(ref.current.getModel()).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            const { ref, rerender } = await renderColumnView(
                namedRows([
                    ["1", "First"],
                    ["3", "Third"],
                ]),
            );

            await rerender(
                namedRows([
                    ["1", "First"],
                    ["2", "Second"],
                    ["3", "Third"],
                ]),
            );

            expect(ref.current.getModel()).not.toBeNull();
        });

        it("removes item", async () => {
            const { ref, rerender } = await renderColumnView(
                namedRows([
                    ["1", "A"],
                    ["2", "B"],
                    ["3", "C"],
                ]),
            );

            await rerender(
                namedRows([
                    ["1", "A"],
                    ["3", "C"],
                ]),
            );

            expect(ref.current.getModel()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (4)", () => {
    describe("renderItem", () => {
        it("receives item data in renderItem", async () => {
            const renderItem = namedLabelRenderItem();

            await renderColumnView([{ id: "1", value: { name: "Test" } }], {
                columns: [{ id: "name", title: "Name", renderCell: renderItem }],
            });

            expect(renderItem).toHaveBeenCalledWith({ item: { name: "Test" }, index: 0 });
        });
    });
});

describe("render - ColumnView (5)", () => {
    describe("sorting", () => {
        it("sets sort column via sortColumn prop", async () => {
            const { ref } = await renderColumnView(singleNamedRow, { sortColumn: "name" });
            expect(ref.current.getSorter()).not.toBeNull();
        });

        it("sets sort order via sortOrder prop", async () => {
            const { ref } = await renderColumnView(singleNamedRow, {
                sortColumn: "name",
                sortOrder: Gtk.SortType.DESCENDING,
            });

            expect(ref.current.getSorter()).not.toBeNull();
        });

        it("calls onSortChanged when sort changes", async () => {
            const onSortChanged = vi.fn();
            const { ref } = await renderColumnView(singleNamedRow, { onSortChanged });
            expect(ref.current).not.toBeNull();
        });

        it("updates sort indicator when props change", async () => {
            const columns: ColumnViewColumn<{ name: string }>[] = [
                { id: "name", title: "Name", renderCell: labelCell },
                { id: "age", title: "Age", renderCell: labelCell },
            ];

            const { ref, rerender } = await renderColumnView(singleNamedRow, {
                columns,
                sortColumn: "name",
            });

            await rerender(singleNamedRow, { columns, sortColumn: "age" });
            expect(ref.current.getSorter()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (6)", () => {
    describe("selection", () => {
        it("supports single selection", async () => {
            const { ref } = await renderColumnView(firstSecondItems, { selected: ["1"] });
            expect(ref.current.getModel()).not.toBeNull();
        });

        it("supports multiple selection", async () => {
            const { ref } = await renderColumnView(firstSecondThirdItems, {
                selectionMode: Gtk.SelectionMode.MULTIPLE,
                selected: ["1", "2"],
            });

            expect(ref.current.getModel()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (7)", () => {
    describe("React-side sorting with large dataset (1)", () => {
        it("renders 200 rows in initial order", async () => {
            const { latestOrder } = await renderSortableColumnView(200);
            const initialOrder = latestOrder();
            expect(initialOrder).toBeDefined();
            expect(initialOrder?.length).toBe(200);
            expect(initialOrder?.[0]).toBe("1");
            expect(initialOrder?.[199]).toBe("200");
        });

        it("sorts 200 rows when clicking salary column header", async () => {
            const { ref, employees, latestOrder } = await renderSortableColumnView(200);
            const unsortedOrder = latestOrder();
            expect(unsortedOrder?.[0]).toBe("1");
            await sortByColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);
            const sortedBySalary = latestOrder();
            expect(sortedBySalary).toBeDefined();
            const firstItemId = sortedBySalary?.[0];
            const lastItemId = sortedBySalary?.[199];
            expect(firstItemId).toBeDefined();
            expect(lastItemId).toBeDefined();
            const firstEmployee = employees.find((e) => e.id === firstItemId);
            const lastEmployee = employees.find((e) => e.id === lastItemId);
            expect(firstEmployee).toBeDefined();
            expect(lastEmployee).toBeDefined();
            expect(firstEmployee?.salary).toBeLessThanOrEqual(lastEmployee?.salary ?? 0);
        });
    });
});

describe("render - ColumnView (8)", () => {
    describe("React-side sorting with large dataset (2)", () => {
        it("sorts 200 rows descending when clicking column header with DESC order", async () => {
            const { ref, employees, latestOrder } = await renderSortableColumnView(200);
            await sortByColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);
            const ascendingOrder = latestOrder();
            const firstInAsc = employees.find((e) => e.id === ascendingOrder?.[0]);
            const lastInAsc = employees.find((e) => e.id === ascendingOrder?.[199]);
            await sortByColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.DESCENDING);
            const descendingOrder = latestOrder();
            const firstInDesc = employees.find((e) => e.id === descendingOrder?.[0]);
            const lastInDesc = employees.find((e) => e.id === descendingOrder?.[199]);
            expect(firstInDesc?.salary).toBeGreaterThanOrEqual(lastInDesc?.salary ?? 0);
            expect(firstInDesc?.id).toBe(lastInAsc?.id);
            expect(lastInDesc?.id).toBe(firstInAsc?.id);
        });

        it("switches sort column when clicking different column header", async () => {
            const { ref, latestOrder } = await renderSortableColumnView(200);
            await sortByColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);
            const sortedBySalary = [...(latestOrder() ?? [])];
            await sortByColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.ASCENDING);
            const sortedByName = latestOrder();
            expect(sortedByName).not.toEqual(sortedBySalary);
            expect(sortedByName?.[0]).toBe("1");
            expect(sortedByName?.[99]).toBe("100");
        });
    });
});

describe("render - ColumnView (9)", () => {
    describe("React-side sorting with large dataset (3)", () => {
        it("maintains model integrity after multiple sort operations on 200 rows", async () => {
            const { ref } = await renderSortableColumnView(200);
            expect(ref.current?.getModel()).not.toBeNull();
            await sortByColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.ASCENDING);
            expect(ref.current?.getModel()).not.toBeNull();
            await sortByColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.DESCENDING);
            expect(ref.current?.getModel()).not.toBeNull();
            await sortByColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.DESCENDING);
            expect(ref.current?.getModel()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (10)", () => {
    describe("item reordering (1)", () => {
        it("respects React declaration order on initial render", async () => {
            await expectInitialOrder(columnViewView, ["C", "A", "B"]);
        });

        it("handles complete reversal of items", async () => {
            await expectReorder(columnViewView, ["A", "B", "C", "D", "E"], ["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            await expectReorder(columnViewView, ["A", "B", "C", "D"], ["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            await expectReorder(columnViewView, ["A", "B", "C"], ["D", "B", "E"]);
        });

        it("handles insert at beginning", async () => {
            await expectReorder(columnViewView, ["B", "C"], ["A", "B", "C"]);
        });

        it("handles single item to multiple items", async () => {
            await expectReorder(columnViewView, ["A"], ["X", "A", "Y"]);
        });
    });
});

describe("render - ColumnView (11)", () => {
    describe("item reordering (2)", () => {
        it("handles rapid reordering", async () => {
            await expectRapidReorder(columnViewView, RAPID_REORDER_ORDERS);
        });

        it("handles large dataset reordering (200 items)", async () => {
            await expectLargeDatasetReorder(columnViewView);
        });

        it("handles move first item to last position", async () => {
            await expectReorder(columnViewView, ["A", "B", "C", "D"], ["B", "C", "D", "A"]);
        });

        it("handles move last item to first position", async () => {
            await expectReorder(columnViewView, ["A", "B", "C", "D"], ["D", "A", "B", "C"]);
        });

        it("handles swap of two items", async () => {
            await expectReorder(columnViewView, ["A", "B", "C", "D"], ["A", "C", "B", "D"]);
        });
    });
});

describe("render - ColumnView (12)", () => {
    describe("item reordering (3)", () => {
        it("handles filtered view reordering", async () => {
            await expectFilteredViewReorder(columnViewView);
        });
    });
});

describe("render - ColumnView (13)", () => {
    describe("item reordering (4)", () => {
        it("preserves React declaration order after sorting resets", async () => {
            type ListItem = {
                id: string;
                name: string;
                salary: number;
            };

            const items: ListItem[] = [
                { id: "3", name: "Charlie", salary: 60_000 },
                { id: "1", name: "Alice", salary: 50_000 },
                { id: "2", name: "Bob", salary: 55_000 },
            ];

            const columns: ColumnViewColumn<ListItem>[] = [
                {
                    id: "name",
                    title: "Name",
                    isSortable: true,
                    renderCell: ({ item }) => <GtkLabel>{item.name}</GtkLabel>,
                },
                {
                    id: "salary",
                    title: "Salary",
                    isSortable: true,
                    renderCell: ({ item }) => <GtkLabel>{String(item.salary)}</GtkLabel>,
                },
            ];

            const sortBy = (sortColumn: SortColumn, sortOrder: Gtk.SortType): ListItem[] => {
                if (!sortColumn) {
                    return items;
                }

                return items.toSorted((a, b) => compareBySort(a, b, sortColumn, sortOrder));
            };

            const toRows = (rows: ListItem[]) => rows.map((item) => ({ id: item.id, value: item }));
            const createRows = (sortColumn: SortColumn) => toRows(sortBy(sortColumn, Gtk.SortType.ASCENDING));

            const createOptions = (sortColumn: SortColumn) => ({
                columns,
                sortColumn,
                sortOrder: Gtk.SortType.ASCENDING,
            });

            const { ref, rerender } = await renderColumnView(createRows(null), createOptions(null));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Charlie", "Alice", "Bob"]);
            await rerender(createRows("name"), createOptions("name"));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Alice", "Bob", "Charlie"]);
            await rerender(createRows(null), createOptions(null));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Charlie", "Alice", "Bob"]);
        });
    });
});

describe("render - ColumnView (14)", () => {
    describe("item reordering (5)", () => {
        it("preserves order when only item values change", async () => {
            const { ref, rerender } = await renderColumnView(
                namedRows([
                    ["1", "Alice"],
                    ["2", "Bob"],
                    ["3", "Charlie"],
                ]),
            );

            expect(getColumnViewItemTexts(ref.current)).toEqual(["Alice", "Bob", "Charlie"]);

            await rerender(
                namedRows([
                    ["1", "Alice Updated"],
                    ["2", "Bob Updated"],
                    ["3", "Charlie Updated"],
                ]),
            );

            expect(getColumnViewItemTexts(ref.current)).toEqual(["Alice Updated", "Bob Updated", "Charlie Updated"]);
        });

        it("preserves order when updating a single item value", async () => {
            type ListItem = { name: string; count: number };

            const columns: ColumnViewColumn<ListItem>[] = [
                {
                    id: "name",
                    title: "Name",
                    renderCell: ({ item }) => <GtkLabel>{`${item.name}: ${String(item.count)}`}</GtkLabel>,
                },
            ];

            const { ref, rerender } = await renderColumnView(counterBaselineRows(), { columns });
            expect(getColumnViewItemTexts(ref.current)).toEqual(COUNTER_BASELINE_TEXTS);
            await rerender(counterSingleUpdateRows(), { columns });
            expect(getColumnViewItemTexts(ref.current)).toEqual(COUNTER_SINGLE_UPDATE_TEXTS);
        });
    });
});

describe("render - ColumnView (15)", () => {
    describe("item reordering (6)", () => {
        it("preserves order with frequent value updates", async () => {
            const { ref, rerender } = await renderColumnView(createItems(0));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C"]);

            for (let i = 1; i <= 10; i++) {
                await rerender(createItems(i));
                expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C"]);
            }
        });
    });
});

describe("render - ColumnView (16)", () => {
    describe("column reordering", () => {
        it("respects React declaration order for columns", async () => {
            const { ref } = await renderTitledColumnView(["C", "A", "B"]);
            expect(getColumnTitles(ref.current)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of columns", async () => {
            const { ref, rerenderTitles } = await renderTitledColumnView(["A", "B", "C", "D", "E"]);
            expect(getColumnTitles(ref.current)).toEqual(["A", "B", "C", "D", "E"]);
            await rerenderTitles(["E", "D", "C", "B", "A"]);
            expect(getColumnTitles(ref.current)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved column reordering", async () => {
            const { ref, rerenderTitles } = await renderTitledColumnView(["A", "B", "C", "D"]);
            expect(getColumnTitles(ref.current)).toEqual(["A", "B", "C", "D"]);
            await rerenderTitles(["B", "D", "A", "C"]);
            expect(getColumnTitles(ref.current)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles rapid column reordering", async () => {
            const { ref, rerenderTitles } = await renderAbcThenReorder(["C", "A", "B"]);
            await rerenderTitles(["B", "C", "A"]);
            await rerenderTitles(["A", "B", "C"]);
            expect(getColumnTitles(ref.current)).toEqual(["A", "B", "C"]);
        });
    });
});

describe("render - ColumnView (columns with inferred item type)", () => {
    type Person = {
        id: string;
        name: string;
        role: string;
    };

    it("renders columns from the columns prop with an inferred item type", async () => {
        const people: Person[] = [
            { id: "1", name: "Ada", role: "Engineer" },
            { id: "2", name: "Alan", role: "Mathematician" },
        ];

        await render(
            <ScrollWrapper minContentHeight={200}>
                <ColumnView<Person>
                    items={people.map((p) => ({ id: p.id, value: p }))}
                    columns={[
                        { id: "name", title: "Name", renderCell: ({ item }) => <GtkLabel>{item.name}</GtkLabel> },
                        { id: "role", title: "Role", renderCell: ({ item }) => <GtkLabel>{item.role}</GtkLabel> },
                    ]}
                />
            </ScrollWrapper>,
        );

        expect(screen.queryAllByText("Ada")).toHaveLength(1);
        expect(screen.queryAllByText("Engineer")).toHaveLength(1);
        expect(screen.queryAllByText("Mathematician")).toHaveLength(1);
    });
});

describe("render - ColumnView (estimated item size)", () => {
    it("applies estimatedItemHeight to data-row cells and leaves width unconstrained", async () => {
        const columnView = await renderEmptyCells(48);
        const sized = collectBoxSizeRequests(columnView).filter(([, height]) => height === 48);
        expect(sized).toHaveLength(estimatedSizeItems.length);

        for (const [width] of sized) {
            expect(width).toBe(-1);
        }
    });

    it("leaves data-row cells unsized when estimatedItemHeight is absent", async () => {
        const columnView = await renderEmptyCells();

        for (const [width, height] of collectBoxSizeRequests(columnView)) {
            expect(width).toBe(-1);
            expect(height).toBe(-1);
        }
    });
});
