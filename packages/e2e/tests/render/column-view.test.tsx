import * as Gtk from "@gtkx/ffi/gtk";
import { GtkColumnView, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { cleanup, render, tick } from "@gtkx/testing";
import type { ReactNode } from "react";
import { createRef, useCallback, useMemo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ScrollWrapper = ({ children }: { children: ReactNode }) => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        {children}
    </GtkScrolledWindow>
);

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
        const obj = columns.getObject(i) as Gtk.ColumnViewColumn | null;
        if (obj) {
            if (obj.getId() === columnId) {
                return obj;
            }
        }
    }
    return null;
};

const clickColumnHeader = async (columnView: Gtk.ColumnView, columnId: string, order: Gtk.SortType): Promise<void> => {
    const column = getColumnById(columnView, columnId);
    if (column) {
        columnView.sortByColumn(order, column);
        await tick();
    }
};

const getModelItemOrder = (columnView: Gtk.ColumnView): string[] => {
    const selectionModel = columnView.getModel();
    if (!selectionModel) return [];

    const ids: string[] = [];
    const nItems = selectionModel.getNItems();
    for (let i = 0; i < nItems; i++) {
        const item = selectionModel.getObject(i) as Gtk.StringObject | null;
        if (item) {
            ids.push(item.getString());
        }
    }
    return ids;
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

        const sorted = [...employees].sort((a, b) => {
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

        return sorted;
    }, [employees, sortColumn, sortOrder]);

    if (onRenderOrder) {
        onRenderOrder(sortedEmployees.map((e) => e.id));
    }

    return (
        <ScrollWrapper>
            <GtkColumnView
                ref={columnViewRef}
                sortColumn={sortColumn}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
            >
                <x.ColumnViewColumn
                    id="name"
                    title="Name"
                    expand
                    sortable
                    renderCell={(emp: Employee | null) => <GtkLabel label={emp?.name ?? ""} />}
                />
                <x.ColumnViewColumn
                    id="salary"
                    title="Salary"
                    expand
                    sortable
                    renderCell={(emp: Employee | null) => <GtkLabel label={emp ? `$${emp.salary}` : ""} />}
                />
                {sortedEmployees.map((emp) => (
                    <x.ListItem key={emp.id} id={emp.id} value={emp} />
                ))}
            </GtkColumnView>
        </ScrollWrapper>
    );
}

describe("render - ColumnView", () => {
    describe("GtkColumnView", () => {
        it("creates ColumnView widget", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ColumnViewColumn", () => {
        it("adds column with title", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref}>
                        <x.ColumnViewColumn id="column-title" title="Column Title" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const columns = ref.current?.getColumns();
            expect(columns).not.toBeNull();
        });

        it("inserts column before existing column", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            {columns.map((title) => (
                                <x.ColumnViewColumn
                                    key={title}
                                    id={title}
                                    title={title}
                                    expand
                                    renderCell={() => "Cell"}
                                />
                            ))}
                            <x.ListItem id="1" value={{ name: "First" }} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App columns={["First", "Last"]} />);

            await render(<App columns={["First", "Middle", "Last"]} />);

            expect(ref.current?.getColumns()).not.toBeNull();
        });

        it("removes column", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            {columns.map((title) => (
                                <x.ColumnViewColumn
                                    key={title}
                                    id={title}
                                    title={title}
                                    expand
                                    renderCell={() => "Cell"}
                                />
                            ))}
                            <x.ListItem id="1" value={{ name: "First" }} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App columns={["A", "B", "C"]} />);

            await render(<App columns={["A", "C"]} />);

            expect(ref.current?.getColumns()).not.toBeNull();
        });

        it("sets column properties (expand, resizable, fixedWidth)", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref}>
                        <x.ColumnViewColumn
                            id="props"
                            title="Props"
                            expand={true}
                            resizable={true}
                            fixedWidth={100}
                            renderCell={() => "Cell"}
                        />
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );
        });

        it("updates column properties when props change", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ title }: { title: string }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id={title} title={title} expand renderCell={() => "Cell"} />
                            <x.ListItem id="1" value={{ name: "First" }} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App title="Initial" />);

            await render(<App title="Updated" />);
        });
    });

    describe("ListItem", () => {
        it("adds item to list model", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            expect(ref.current?.getModel()).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "3", name: "Third" },
                    ]}
                />,
            );

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "2", name: "Second" },
                        { id: "3", name: "Third" },
                    ]}
                />,
            );

            expect(ref.current?.getModel()).not.toBeNull();
        });

        it("removes item", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "2", name: "B" },
                        { id: "3", name: "C" },
                    ]}
                />,
            );

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "3", name: "C" },
                    ]}
                />,
            );

            expect(ref.current?.getModel()).not.toBeNull();
        });
    });

    describe("renderCell", () => {
        it("receives item data in renderCell", async () => {
            const ref = createRef<Gtk.ColumnView>();
            const renderCell = vi.fn((item: { name: string } | null) => <GtkLabel label={item?.name ?? "Empty"} />);

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={renderCell} />
                        <x.ListItem id="1" value={{ name: "Test" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );
        });
    });

    describe("sorting", () => {
        it("sets sort column via sortColumn prop", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref} sortColumn="name">
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );
        });

        it("sets sort order via sortOrder prop", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref} sortColumn="name" sortOrder={Gtk.SortType.DESCENDING}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );
        });

        it("calls onSortChange when sort changes", async () => {
            const ref = createRef<Gtk.ColumnView>();
            const onSortChange = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref} onSortChange={onSortChange}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );
        });

        it("updates sort indicator when props change", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ sortColumn }: { sortColumn: string | null }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref} sortColumn={sortColumn}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            <x.ColumnViewColumn id="age" title="Age" expand renderCell={() => "Cell"} />
                            <x.ListItem id="1" value={{ name: "First", age: 25 }} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App sortColumn="name" />);

            await render(<App sortColumn="age" />);
        });
    });

    describe("selection", () => {
        it("supports single selection", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref} selected={["1"]}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );
        });

        it("supports multiple selection", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref} selectionMode={Gtk.SelectionMode.MULTIPLE} selected={["1", "2"]}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                        <x.ListItem id="2" value={{ name: "Second" }} />
                        <x.ListItem id="3" value={{ name: "Third" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );
        });
    });

    describe("React-side sorting with large dataset", () => {
        it("renders 200 rows in initial order", { timeout: 15000 }, async () => {
            const employees = generateEmployees(200);
            const renderOrders: string[][] = [];
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <SortableColumnView
                    employees={employees}
                    columnViewRef={ref}
                    onRenderOrder={(ids) => renderOrders.push(ids)}
                />,
            );

            const initialOrder = renderOrders[renderOrders.length - 1];
            expect(initialOrder).toBeDefined();
            expect(initialOrder?.length).toBe(200);
            expect(initialOrder?.[0]).toBe("1");
            expect(initialOrder?.[199]).toBe("200");
        });

        it("sorts 200 rows when clicking salary column header", { timeout: 15000 }, async () => {
            const employees = generateEmployees(200);
            const renderOrders: string[][] = [];
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <SortableColumnView
                    employees={employees}
                    columnViewRef={ref}
                    onRenderOrder={(ids) => renderOrders.push(ids)}
                />,
            );

            const unsortedOrder = renderOrders[renderOrders.length - 1];
            expect(unsortedOrder?.[0]).toBe("1");

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);

            const sortedBySalary = renderOrders[renderOrders.length - 1];
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

        it("sorts 200 rows descending when clicking column header with DESC order", { timeout: 30000 }, async () => {
            const employees = generateEmployees(200);
            const renderOrders: string[][] = [];
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <SortableColumnView
                    employees={employees}
                    columnViewRef={ref}
                    onRenderOrder={(ids) => renderOrders.push(ids)}
                />,
            );

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);

            const ascendingOrder = renderOrders[renderOrders.length - 1];
            const firstInAsc = employees.find((e) => e.id === ascendingOrder?.[0]);
            const lastInAsc = employees.find((e) => e.id === ascendingOrder?.[199]);

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.DESCENDING);

            const descendingOrder = renderOrders[renderOrders.length - 1];
            const firstInDesc = employees.find((e) => e.id === descendingOrder?.[0]);
            const lastInDesc = employees.find((e) => e.id === descendingOrder?.[199]);

            expect(firstInDesc?.salary).toBeGreaterThanOrEqual(lastInDesc?.salary ?? 0);
            expect(firstInDesc?.id).toBe(lastInAsc?.id);
            expect(lastInDesc?.id).toBe(firstInAsc?.id);
        });

        it("switches sort column when clicking different column header", { timeout: 15000 }, async () => {
            const employees = generateEmployees(200);
            const renderOrders: string[][] = [];
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <SortableColumnView
                    employees={employees}
                    columnViewRef={ref}
                    onRenderOrder={(ids) => renderOrders.push(ids)}
                />,
            );

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);

            const sortedBySalary = [...(renderOrders[renderOrders.length - 1] ?? [])];

            await clickColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.ASCENDING);

            const sortedByName = renderOrders[renderOrders.length - 1];

            expect(sortedByName).not.toEqual(sortedBySalary);

            expect(sortedByName?.[0]).toBe("1");
            expect(sortedByName?.[99]).toBe("100");
        });

        it("maintains model integrity after multiple sort operations on 200 rows", { timeout: 15000 }, async () => {
            const employees = generateEmployees(200);
            const ref = createRef<Gtk.ColumnView>();

            await render(<SortableColumnView employees={employees} columnViewRef={ref} />);

            expect(ref.current?.getModel()).not.toBeNull();

            await clickColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.ASCENDING);
            expect(ref.current?.getModel()).not.toBeNull();

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.DESCENDING);
            expect(ref.current?.getModel()).not.toBeNull();

            await clickColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.DESCENDING);
            expect(ref.current?.getModel()).not.toBeNull();
        });
    });

    describe("item reordering", () => {
        afterEach(async () => {
            await cleanup();
        });

        it("respects React declaration order on initial render", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                        <x.ListItem id="c" value={{ name: "C" }} />
                        <x.ListItem id="a" value={{ name: "A" }} />
                        <x.ListItem id="b" value={{ name: "B" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["c", "a", "b"]);
        });

        it("handles complete reversal of items", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D", "E"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App items={["E", "D", "C", "B", "A"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "D", "A", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C"]);

            await render(<App items={["D", "B", "E"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["D", "B", "E"]);
        });

        it("handles insert at beginning", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["B", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["B", "C"]);

            await render(<App items={["A", "B", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C"]);
        });

        it("handles single item to multiple items", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A"]);

            await render(<App items={["X", "A", "Y"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["X", "A", "Y"]);
        });

        it("handles rapid reordering", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            await render(<App items={["C", "A", "B"]} />);
            await render(<App items={["B", "C", "A"]} />);
            await render(<App items={["A", "B", "C"]} />);

            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C"]);
        });

        it("handles large dataset reordering (200 items)", async () => {
            const ref = createRef<Gtk.ColumnView>();

            const initialItems = Array.from({ length: 200 }, (_, i) => String(i + 1));
            const reversedItems = [...initialItems].reverse();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={initialItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(initialItems);

            await render(<App items={reversedItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(reversedItems);
        });

        it("handles move first item to last position", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["B", "C", "D", "A"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["B", "C", "D", "A"]);
        });

        it("handles move last item to first position", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["D", "A", "B", "C"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["D", "A", "B", "C"]);
        });

        it("handles swap of two items", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {items.map((id) => (
                                <x.ListItem key={id} id={id} value={{ name: id }} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C", "D"]);

            await render(<App items={["A", "C", "B", "D"]} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["A", "C", "B", "D"]);
        });

        it("handles filtered view reordering", async () => {
            const ref = createRef<Gtk.ColumnView>();

            type Item = { id: string; active: boolean };

            function App({ filter, items }: { filter: "all" | "active" | "inactive"; items: Item[] }) {
                const filteredItems = items.filter((item) => {
                    if (filter === "active") return item.active;
                    if (filter === "inactive") return !item.active;
                    return true;
                });

                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                            {filteredItems.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            const items: Item[] = [
                { id: "1", active: true },
                { id: "2", active: false },
                { id: "3", active: true },
                { id: "4", active: false },
                { id: "5", active: true },
            ];

            await render(<App filter="all" items={items} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3", "4", "5"]);

            await render(<App filter="active" items={items} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "3", "5"]);

            await render(<App filter="inactive" items={items} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["2", "4"]);

            await render(<App filter="all" items={items} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3", "4", "5"]);
        });

        it("preserves React declaration order after sorting resets", async () => {
            const ref = createRef<Gtk.ColumnView>();

            interface Item {
                id: string;
                name: string;
                salary: number;
            }

            function App({
                items,
                sortColumn,
                sortOrder,
            }: {
                items: Item[];
                sortColumn: string | null;
                sortOrder: Gtk.SortType;
            }) {
                const sortedItems = useMemo(() => {
                    if (!sortColumn) return items;

                    return [...items].sort((a, b) => {
                        let comparison = 0;
                        if (sortColumn === "name") {
                            comparison = a.name.localeCompare(b.name);
                        } else if (sortColumn === "salary") {
                            comparison = a.salary - b.salary;
                        }
                        return sortOrder === Gtk.SortType.ASCENDING ? comparison : -comparison;
                    });
                }, [items, sortColumn, sortOrder]);

                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref} sortColumn={sortColumn} sortOrder={sortOrder}>
                            <x.ColumnViewColumn
                                id="name"
                                title="Name"
                                expand
                                sortable
                                renderCell={(item: Item | null) => <GtkLabel label={item?.name ?? ""} />}
                            />
                            <x.ColumnViewColumn
                                id="salary"
                                title="Salary"
                                expand
                                sortable
                                renderCell={(item: Item | null) => <GtkLabel label={String(item?.salary ?? 0)} />}
                            />
                            {sortedItems.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            const items: Item[] = [
                { id: "3", name: "Charlie", salary: 60000 },
                { id: "1", name: "Alice", salary: 50000 },
                { id: "2", name: "Bob", salary: 55000 },
            ];

            await render(<App items={items} sortColumn={null} sortOrder={Gtk.SortType.ASCENDING} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["3", "1", "2"]);

            await render(<App items={items} sortColumn="name" sortOrder={Gtk.SortType.ASCENDING} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3"]);

            await render(<App items={items} sortColumn={null} sortOrder={Gtk.SortType.ASCENDING} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["3", "1", "2"]);
        });

        it("preserves order when only item values change", async () => {
            const ref = createRef<Gtk.ColumnView>();

            type Item = { id: string; name: string };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn
                                id="name"
                                title="Name"
                                expand
                                renderCell={(item: Item | null) => <GtkLabel label={item?.name ?? ""} />}
                            />
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            const initialItems: Item[] = [
                { id: "1", name: "Alice" },
                { id: "2", name: "Bob" },
                { id: "3", name: "Charlie" },
            ];

            await render(<App items={initialItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3"]);

            const updatedItems: Item[] = [
                { id: "1", name: "Alice Updated" },
                { id: "2", name: "Bob Updated" },
                { id: "3", name: "Charlie Updated" },
            ];

            await render(<App items={updatedItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3"]);
        });

        it("preserves order when updating a single item value", async () => {
            const ref = createRef<Gtk.ColumnView>();

            type Item = { id: string; name: string; count: number };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn
                                id="name"
                                title="Name"
                                expand
                                renderCell={(item: Item | null) => (
                                    <GtkLabel label={`${item?.name ?? ""}: ${item?.count ?? 0}`} />
                                )}
                            />
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            const initialItems: Item[] = [
                { id: "1", name: "Counter A", count: 0 },
                { id: "2", name: "Counter B", count: 0 },
                { id: "3", name: "Counter C", count: 0 },
            ];

            await render(<App items={initialItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3"]);

            const updatedItems: Item[] = [
                { id: "1", name: "Counter A", count: 0 },
                { id: "2", name: "Counter B", count: 5 },
                { id: "3", name: "Counter C", count: 0 },
            ];

            await render(<App items={updatedItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3"]);
        });

        it("preserves order with frequent value updates", async () => {
            const ref = createRef<Gtk.ColumnView>();

            type Item = { id: string; value: number };

            function App({ items }: { items: Item[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            <x.ColumnViewColumn
                                id="value"
                                title="Value"
                                expand
                                renderCell={(item: Item | null) => <GtkLabel label={String(item?.value ?? 0)} />}
                            />
                            {items.map((item) => (
                                <x.ListItem key={item.id} id={item.id} value={item} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            const baseItems: Item[] = [
                { id: "1", value: 0 },
                { id: "2", value: 0 },
                { id: "3", value: 0 },
            ];

            await render(<App items={baseItems} />);
            expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3"]);

            for (let i = 1; i <= 10; i++) {
                const updatedItems: Item[] = [
                    { id: "1", value: i },
                    { id: "2", value: i * 2 },
                    { id: "3", value: i * 3 },
                ];
                await render(<App items={updatedItems} />);
                expect(getModelItemOrder(ref.current as Gtk.ColumnView)).toEqual(["1", "2", "3"]);
            }
        });
    });

    describe("column reordering", () => {
        afterEach(async () => {
            await cleanup();
        });

        const getColumnTitles = (columnView: Gtk.ColumnView): string[] => {
            const columns = columnView.getColumns();
            const titles: string[] = [];
            const nItems = columns.getNItems();
            for (let i = 0; i < nItems; i++) {
                const column = columns.getObject(i) as Gtk.ColumnViewColumn | null;
                if (column) {
                    titles.push(column.getTitle() ?? "");
                }
            }
            return titles;
        };

        it("respects React declaration order for columns", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={ref}>
                        <x.ColumnViewColumn id="C" title="C" expand renderCell={() => "Cell"} />
                        <x.ColumnViewColumn id="A" title="A" expand renderCell={() => "Cell"} />
                        <x.ColumnViewColumn id="B" title="B" expand renderCell={() => "Cell"} />
                        <x.ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            expect(getColumnTitles(ref.current as Gtk.ColumnView)).toEqual(["C", "A", "B"]);
        });

        it("handles complete reversal of columns", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            {columns.map((title) => (
                                <x.ColumnViewColumn
                                    key={title}
                                    id={title}
                                    title={title}
                                    expand
                                    renderCell={() => "Cell"}
                                />
                            ))}
                            <x.ListItem id="1" value={{ name: "First" }} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App columns={["A", "B", "C", "D", "E"]} />);
            expect(getColumnTitles(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C", "D", "E"]);

            await render(<App columns={["E", "D", "C", "B", "A"]} />);
            expect(getColumnTitles(ref.current as Gtk.ColumnView)).toEqual(["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved column reordering", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            {columns.map((title) => (
                                <x.ColumnViewColumn
                                    key={title}
                                    id={title}
                                    title={title}
                                    expand
                                    renderCell={() => "Cell"}
                                />
                            ))}
                            <x.ListItem id="1" value={{ name: "First" }} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App columns={["A", "B", "C", "D"]} />);
            expect(getColumnTitles(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C", "D"]);

            await render(<App columns={["B", "D", "A", "C"]} />);
            expect(getColumnTitles(ref.current as Gtk.ColumnView)).toEqual(["B", "D", "A", "C"]);
        });

        it("handles rapid column reordering", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={ref}>
                            {columns.map((title) => (
                                <x.ColumnViewColumn
                                    key={title}
                                    id={title}
                                    title={title}
                                    expand
                                    renderCell={() => "Cell"}
                                />
                            ))}
                            <x.ListItem id="1" value={{ name: "First" }} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App columns={["A", "B", "C"]} />);
            await render(<App columns={["C", "A", "B"]} />);
            await render(<App columns={["B", "C", "A"]} />);
            await render(<App columns={["A", "B", "C"]} />);

            expect(getColumnTitles(ref.current as Gtk.ColumnView)).toEqual(["A", "B", "C"]);
        });
    });
});
