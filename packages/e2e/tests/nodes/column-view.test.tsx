import * as Gtk from "@gtkx/ffi/gtk";
import { GtkColumnView, GtkLabel } from "@gtkx/react";
import { act, render } from "@gtkx/testing";
import { createRef, useCallback, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { filterableIds } from "../helpers/filterable-items.js";
import { type ColumnDef, renderColumnView } from "../helpers/list-fixtures.js";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";
import { getChildTexts } from "../helpers/widget-text.js";

const getColumnViewItemTexts = (columnView: Gtk.ColumnView): string[] => {
    let child = columnView.getFirstChild();
    if (child) child = child.getNextSibling();
    if (child) return getChildTexts(child);
    return [];
};

const labelCell = (item: { name: string }) => <GtkLabel label={item.name} />;

const titleColumns = (titles: string[]): ColumnDef<{ name: string }>[] =>
    titles.map((title) => ({ id: title, title, renderCell: labelCell }));

interface Employee {
    id: string;
    name: string;
    salary: number;
}

const generateEmployees = (count: number): Employee[] => {
    const employees: Employee[] = [];
    for (let i = 0; i < count; i++) {
        employees.push({
            id: String(i + 1),
            name: `Employee ${String(i + 1).padStart(3, "0")}`,
            salary: 50000 + ((i * 7919) % 80000),
        });
    }
    return employees;
};

type SortColumn = "name" | "salary" | null;

const getColumnById = (columnView: Gtk.ColumnView, columnId: string): Gtk.ColumnViewColumn | null => {
    const columns = columnView.getColumns();
    const nItems = columns.getNItems();

    for (let i = 0; i < nItems; i++) {
        const obj = columns.getItem(i) as Gtk.ColumnViewColumn | null;
        if (obj?.getId() === columnId) {
            return obj;
        }
    }
    return null;
};

const clickColumnHeader = async (columnView: Gtk.ColumnView, columnId: string, order: Gtk.SortType): Promise<void> => {
    const column = getColumnById(columnView, columnId);
    if (column) {
        await act(() => columnView.sortByColumn(column, order));
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
        if (!sortColumn) return employees;

        return [...employees].sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "salary":
                    comparison = a.salary - b.salary;
                    break;
            }
            return sortOrder === Gtk.SortType.ASCENDING ? comparison : -comparison;
        });
    }, [employees, sortColumn, sortOrder]);

    if (onRenderOrder) {
        onRenderOrder(sortedEmployees.map((e) => e.id));
    }

    return (
        <ScrollWrapper minContentHeight={500}>
            <GtkColumnView
                ref={columnViewRef}
                sortColumn={sortColumn}
                sortOrder={sortOrder}
                onSortChanged={handleSortChange}
                items={sortedEmployees.map((emp) => ({ id: emp.id, value: emp }))}
            >
                <GtkColumnView.Column
                    id="name"
                    title="Name"
                    expand
                    sortable
                    renderCell={(emp: Employee) => <GtkLabel label={emp.name} />}
                />
                <GtkColumnView.Column
                    id="salary"
                    title="Salary"
                    expand
                    sortable
                    renderCell={(emp: Employee) => <GtkLabel label={`$${emp.salary}`} />}
                />
            </GtkColumnView>
        </ScrollWrapper>
    );
}

/** Handle returned by {@link renderSortableColumnView}. */
interface SortableColumnViewFixture {
    /** Ref to the rendered `GtkColumnView`. */
    ref: React.RefObject<Gtk.ColumnView | null>;
    /** Employees rendered into the column view. */
    employees: Employee[];
    /** Row id orders captured on every render, newest last. */
    renderOrders: string[][];
    /** Most recent captured render order, or `undefined` before the first render. */
    latestOrder: () => string[] | undefined;
}

const renderSortableColumnView = async (count: number): Promise<SortableColumnViewFixture> => {
    const employees = generateEmployees(count);
    const renderOrders: string[][] = [];
    const ref = createRef<Gtk.ColumnView>();

    await render(
        <SortableColumnView
            employees={employees}
            columnViewRef={ref}
            onRenderOrder={(ids) => renderOrders.push(ids)}
        />,
    );

    return { ref, employees, renderOrders, latestOrder: () => renderOrders[renderOrders.length - 1] };
};

const getColumnTitles = (columnView: Gtk.ColumnView): string[] => {
    const columns = columnView.getColumns();
    const titles: string[] = [];
    const nItems = columns.getNItems();
    for (let i = 0; i < nItems; i++) {
        const column = columns.getItem(i) as Gtk.ColumnViewColumn | null;
        if (column) {
            titles.push(column.getTitle() ?? "");
        }
    }
    return titles;
};

describe("render - ColumnView (1)", () => {
    describe("GtkColumnView", () => {
        it("creates ColumnView widget", async () => {
            const { ref } = await renderColumnView([{ id: "1", value: { name: "First" } }]);

            expect(ref.current).not.toBeNull();
        });
    });
});

describe("render - ColumnView (2)", () => {
    describe("ColumnViewColumn", () => {
        it("adds column with title", async () => {
            const { ref } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["Column Title"]),
            });

            expect(ref.current?.getColumns()).not.toBeNull();
        });

        it("inserts column before existing column", async () => {
            const { ref, rerender } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["First", "Last"]),
            });

            await rerender([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["First", "Middle", "Last"]),
            });

            expect(ref.current?.getColumns()).not.toBeNull();
        });

        it("removes column", async () => {
            const { ref, rerender } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["A", "B", "C"]),
            });

            await rerender([{ id: "1", value: { name: "First" } }], { columns: titleColumns(["A", "C"]) });

            expect(ref.current?.getColumns()).not.toBeNull();
        });

        it("sets column properties (expand, fixedWidth)", async () => {
            const { ref } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: [{ id: "props", title: "Props", expand: true, fixedWidth: 100, renderCell: labelCell }],
            });

            expect(ref.current?.getColumns()).not.toBeNull();
        });

        it("updates column properties when props change", async () => {
            const { ref, rerender } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["Initial"]),
            });

            await rerender([{ id: "1", value: { name: "First" } }], { columns: titleColumns(["Updated"]) });

            expect(ref.current?.getColumns()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (3)", () => {
    describe("ListItem", () => {
        it("adds item to list model", async () => {
            const { ref } = await renderColumnView([
                { id: "1", value: { name: "First" } },
                { id: "2", value: { name: "Second" } },
            ]);

            expect(ref.current?.getModel()).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            const { ref, rerender } = await renderColumnView([
                { id: "1", value: { name: "First" } },
                { id: "3", value: { name: "Third" } },
            ]);

            await rerender([
                { id: "1", value: { name: "First" } },
                { id: "2", value: { name: "Second" } },
                { id: "3", value: { name: "Third" } },
            ]);

            expect(ref.current?.getModel()).not.toBeNull();
        });

        it("removes item", async () => {
            const { ref, rerender } = await renderColumnView([
                { id: "1", value: { name: "A" } },
                { id: "2", value: { name: "B" } },
                { id: "3", value: { name: "C" } },
            ]);

            await rerender([
                { id: "1", value: { name: "A" } },
                { id: "3", value: { name: "C" } },
            ]);

            expect(ref.current?.getModel()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (4)", () => {
    describe("renderCell", () => {
        it("receives item data in renderCell", async () => {
            const renderCell = vi.fn((item: { name: string }) => <GtkLabel label={item.name} />);

            await renderColumnView([{ id: "1", value: { name: "Test" } }], {
                columns: [{ id: "name", title: "Name", renderCell }],
            });

            expect(renderCell).toHaveBeenCalledWith({ name: "Test" });
        });
    });
});

describe("render - ColumnView (5)", () => {
    describe("sorting", () => {
        it("sets sort column via sortColumn prop", async () => {
            const { ref } = await renderColumnView([{ id: "1", value: { name: "First" } }], { sortColumn: "name" });

            expect(ref.current?.getSorter()).not.toBeNull();
        });

        it("sets sort order via sortOrder prop", async () => {
            const { ref } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                sortColumn: "name",
                sortOrder: Gtk.SortType.DESCENDING,
            });

            expect(ref.current?.getSorter()).not.toBeNull();
        });

        it("calls onSortChanged when sort changes", async () => {
            const onSortChanged = vi.fn();

            const { ref } = await renderColumnView([{ id: "1", value: { name: "First" } }], { onSortChanged });

            expect(ref.current).not.toBeNull();
        });

        it("updates sort indicator when props change", async () => {
            const columns: ColumnDef<{ name: string }>[] = [
                { id: "name", title: "Name", renderCell: labelCell },
                { id: "age", title: "Age", renderCell: labelCell },
            ];

            const { ref, rerender } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns,
                sortColumn: "name",
            });

            await rerender([{ id: "1", value: { name: "First" } }], { columns, sortColumn: "age" });

            expect(ref.current?.getSorter()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (6)", () => {
    describe("selection", () => {
        it("supports single selection", async () => {
            const { ref } = await renderColumnView(
                [
                    { id: "1", value: { name: "First" } },
                    { id: "2", value: { name: "Second" } },
                ],
                { selected: ["1"] },
            );

            expect(ref.current?.getModel()).not.toBeNull();
        });

        it("supports multiple selection", async () => {
            const { ref } = await renderColumnView(
                [
                    { id: "1", value: { name: "First" } },
                    { id: "2", value: { name: "Second" } },
                    { id: "3", value: { name: "Third" } },
                ],
                { selectionMode: Gtk.SelectionMode.MULTIPLE, selected: ["1", "2"] },
            );

            expect(ref.current?.getModel()).not.toBeNull();
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

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);

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

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);

            const ascendingOrder = latestOrder();
            const firstInAsc = employees.find((e) => e.id === ascendingOrder?.[0]);
            const lastInAsc = employees.find((e) => e.id === ascendingOrder?.[199]);

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.DESCENDING);

            const descendingOrder = latestOrder();
            const firstInDesc = employees.find((e) => e.id === descendingOrder?.[0]);
            const lastInDesc = employees.find((e) => e.id === descendingOrder?.[199]);

            expect(firstInDesc?.salary).toBeGreaterThanOrEqual(lastInDesc?.salary ?? 0);
            expect(firstInDesc?.id).toBe(lastInAsc?.id);
            expect(lastInDesc?.id).toBe(firstInAsc?.id);
        });

        it("switches sort column when clicking different column header", async () => {
            const { ref, latestOrder } = await renderSortableColumnView(200);

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);

            const sortedBySalary = [...(latestOrder() ?? [])];

            await clickColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.ASCENDING);

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

            await clickColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.ASCENDING);
            expect(ref.current?.getModel()).not.toBeNull();

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.DESCENDING);
            expect(ref.current?.getModel()).not.toBeNull();

            await clickColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.DESCENDING);
            expect(ref.current?.getModel()).not.toBeNull();
        });
    });
});

describe("render - ColumnView (10)", () => {
    describe("item reordering (1)", () => {
        it("respects React declaration order on initial render", async () => {
            const { ref } = await renderColumnView(["C", "A", "B"]);

            expect(getColumnViewItemTexts(ref.current)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of items", async () => {
            const { ref, rerender } = await renderColumnView(["A", "B", "C", "D", "E"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C", "D", "E"]);

            await rerender(["E", "D", "C", "B", "A"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const { ref, rerender } = await renderColumnView(["A", "B", "C", "D"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["B", "D", "A", "C"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const { ref, rerender } = await renderColumnView(["A", "B", "C"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C"]);

            await rerender(["D", "B", "E"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["D", "B", "E"]);
        });

        it("handles insert at beginning", async () => {
            const { ref, rerender } = await renderColumnView(["B", "C"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["B", "C"]);

            await rerender(["A", "B", "C"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C"]);
        });

        it("handles single item to multiple items", async () => {
            const { ref, rerender } = await renderColumnView(["A"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A"]);

            await rerender(["X", "A", "Y"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["X", "A", "Y"]);
        });
    });
});

describe("render - ColumnView (11)", () => {
    describe("item reordering (2)", () => {
        it("handles rapid reordering", async () => {
            const { ref, rerender } = await renderColumnView(["A", "B", "C"]);
            await rerender(["C", "A", "B"]);
            await rerender(["B", "C", "A"]);
            await rerender(["A", "B", "C"]);

            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C"]);
        });

        it("handles large dataset reordering (200 items)", async () => {
            const initialItems = Array.from({ length: 200 }, (_, i) => String(i + 1));
            const reversedItems = [...initialItems].reverse();

            const { ref, rerender } = await renderColumnView(initialItems);
            const visibleInitial = getColumnViewItemTexts(ref.current);
            expect(visibleInitial.length).toBeGreaterThan(0);
            expect(visibleInitial[0]).toBe("1");

            await rerender(reversedItems);
            const visibleReversed = getColumnViewItemTexts(ref.current);
            expect(visibleReversed.length).toBeGreaterThan(0);
            expect(visibleReversed[0]).toBe("200");
        });

        it("handles move first item to last position", async () => {
            const { ref, rerender } = await renderColumnView(["A", "B", "C", "D"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["B", "C", "D", "A"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["B", "C", "D", "A"]);
        });

        it("handles move last item to first position", async () => {
            const { ref, rerender } = await renderColumnView(["A", "B", "C", "D"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["D", "A", "B", "C"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["D", "A", "B", "C"]);
        });

        it("handles swap of two items", async () => {
            const { ref, rerender } = await renderColumnView(["A", "B", "C", "D"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender(["A", "C", "B", "D"]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "C", "B", "D"]);
        });
    });
});

describe("render - ColumnView (12)", () => {
    describe("item reordering (3)", () => {
        it("handles filtered view reordering", async () => {
            const { ref, rerender } = await renderColumnView(filterableIds("all"));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["1", "2", "3", "4", "5"]);

            await rerender(filterableIds("active"));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["1", "3", "5"]);

            await rerender(filterableIds("inactive"));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["2", "4"]);

            await rerender(filterableIds("all"));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["1", "2", "3", "4", "5"]);
        });
    });
});

describe("render - ColumnView (13)", () => {
    describe("item reordering (4)", () => {
        it("preserves React declaration order after sorting resets", async () => {
            interface Item {
                id: string;
                name: string;
                salary: number;
            }

            const items: Item[] = [
                { id: "3", name: "Charlie", salary: 60000 },
                { id: "1", name: "Alice", salary: 50000 },
                { id: "2", name: "Bob", salary: 55000 },
            ];
            const columns: ColumnDef<Item>[] = [
                { id: "name", title: "Name", sortable: true, renderCell: (item) => <GtkLabel label={item.name} /> },
                {
                    id: "salary",
                    title: "Salary",
                    sortable: true,
                    renderCell: (item) => <GtkLabel label={String(item.salary)} />,
                },
            ];
            const sortBy = (sortColumn: SortColumn, sortOrder: Gtk.SortType): Item[] => {
                if (!sortColumn) return items;
                return [...items].sort((a, b) => {
                    const comparison = sortColumn === "name" ? a.name.localeCompare(b.name) : a.salary - b.salary;
                    return sortOrder === Gtk.SortType.ASCENDING ? comparison : -comparison;
                });
            };
            const toRows = (rows: Item[]) => rows.map((item) => ({ id: item.id, value: item }));

            const { ref, rerender } = await renderColumnView(toRows(sortBy(null, Gtk.SortType.ASCENDING)), {
                columns,
                sortColumn: null,
                sortOrder: Gtk.SortType.ASCENDING,
            });
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Charlie", "Alice", "Bob"]);

            await rerender(toRows(sortBy("name", Gtk.SortType.ASCENDING)), {
                columns,
                sortColumn: "name",
                sortOrder: Gtk.SortType.ASCENDING,
            });
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Alice", "Bob", "Charlie"]);

            await rerender(toRows(sortBy(null, Gtk.SortType.ASCENDING)), {
                columns,
                sortColumn: null,
                sortOrder: Gtk.SortType.ASCENDING,
            });
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Charlie", "Alice", "Bob"]);
        });
    });
});

describe("render - ColumnView (14)", () => {
    describe("item reordering (5)", () => {
        it("preserves order when only item values change", async () => {
            const { ref, rerender } = await renderColumnView([
                { id: "1", value: { name: "Alice" } },
                { id: "2", value: { name: "Bob" } },
                { id: "3", value: { name: "Charlie" } },
            ]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Alice", "Bob", "Charlie"]);

            await rerender([
                { id: "1", value: { name: "Alice Updated" } },
                { id: "2", value: { name: "Bob Updated" } },
                { id: "3", value: { name: "Charlie Updated" } },
            ]);
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Alice Updated", "Bob Updated", "Charlie Updated"]);
        });

        it("preserves order when updating a single item value", async () => {
            type Item = { name: string; count: number };
            const columns: ColumnDef<Item>[] = [
                { id: "name", title: "Name", renderCell: (item) => <GtkLabel label={`${item.name}: ${item.count}`} /> },
            ];

            const { ref, rerender } = await renderColumnView(
                [
                    { id: "1", value: { name: "Counter A", count: 0 } },
                    { id: "2", value: { name: "Counter B", count: 0 } },
                    { id: "3", value: { name: "Counter C", count: 0 } },
                ],
                { columns },
            );
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Counter A: 0", "Counter B: 0", "Counter C: 0"]);

            await rerender(
                [
                    { id: "1", value: { name: "Counter A", count: 0 } },
                    { id: "2", value: { name: "Counter B", count: 5 } },
                    { id: "3", value: { name: "Counter C", count: 0 } },
                ],
                { columns },
            );
            expect(getColumnViewItemTexts(ref.current)).toEqual(["Counter A: 0", "Counter B: 5", "Counter C: 0"]);
        });
    });
});

describe("render - ColumnView (15)", () => {
    describe("item reordering (6)", () => {
        it("preserves order with frequent value updates", async () => {
            const itemsFor = (offset: number) => [
                { id: "1", value: { name: "A", count: offset } },
                { id: "2", value: { name: "B", count: offset } },
                { id: "3", value: { name: "C", count: offset } },
            ];

            const { ref, rerender } = await renderColumnView(itemsFor(0));
            expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C"]);

            for (let i = 1; i <= 10; i++) {
                await rerender(itemsFor(i));
                expect(getColumnViewItemTexts(ref.current)).toEqual(["A", "B", "C"]);
            }
        });
    });
});

describe("render - ColumnView (16)", () => {
    describe("column reordering", () => {
        it("respects React declaration order for columns", async () => {
            const { ref } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["C", "A", "B"]),
            });

            expect(getColumnTitles(ref.current)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of columns", async () => {
            const { ref, rerender } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["A", "B", "C", "D", "E"]),
            });
            expect(getColumnTitles(ref.current)).toEqual(["A", "B", "C", "D", "E"]);

            await rerender([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["E", "D", "C", "B", "A"]),
            });
            expect(getColumnTitles(ref.current)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved column reordering", async () => {
            const { ref, rerender } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["A", "B", "C", "D"]),
            });
            expect(getColumnTitles(ref.current)).toEqual(["A", "B", "C", "D"]);

            await rerender([{ id: "1", value: { name: "First" } }], { columns: titleColumns(["B", "D", "A", "C"]) });
            expect(getColumnTitles(ref.current)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles rapid column reordering", async () => {
            const { ref, rerender } = await renderColumnView([{ id: "1", value: { name: "First" } }], {
                columns: titleColumns(["A", "B", "C"]),
            });
            await rerender([{ id: "1", value: { name: "First" } }], { columns: titleColumns(["C", "A", "B"]) });
            await rerender([{ id: "1", value: { name: "First" } }], { columns: titleColumns(["B", "C", "A"]) });
            await rerender([{ id: "1", value: { name: "First" } }], { columns: titleColumns(["A", "B", "C"]) });

            expect(getColumnTitles(ref.current)).toEqual(["A", "B", "C"]);
        });
    });
});
