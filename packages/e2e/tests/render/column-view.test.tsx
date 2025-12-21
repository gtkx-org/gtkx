import * as Gtk from "@gtkx/ffi/gtk";
import { ColumnViewColumn, GtkColumnView, GtkLabel, ListItem } from "@gtkx/react";
import { render, tick } from "@gtkx/testing";
import { createRef, useCallback, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";

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
        <GtkColumnView
            ref={columnViewRef}
            sortColumn={sortColumn}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
        >
            <ColumnViewColumn
                id="name"
                title="Name"
                sortable
                renderCell={(emp: Employee | null) => <GtkLabel label={emp?.name ?? ""} />}
            />
            <ColumnViewColumn
                id="salary"
                title="Salary"
                sortable
                renderCell={(emp: Employee | null) => <GtkLabel label={emp ? `$${emp.salary}` : ""} />}
            />
            {sortedEmployees.map((emp) => (
                <ListItem key={emp.id} id={emp.id} value={emp} />
            ))}
        </GtkColumnView>
    );
}

describe("render - ColumnView", () => {
    describe("GtkColumnView", () => {
        it("creates ColumnView widget", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={ref}>
                    <ColumnViewColumn title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkColumnView>,
                { wrapper: false },
            );

            expect(ref.current).not.toBeNull();
        });
    });

    describe("ColumnViewColumn", () => {
        it("adds column with title", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={ref}>
                    <ColumnViewColumn title="Column Title" renderCell={() => <GtkLabel label="Cell" />} />
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkColumnView>,
                { wrapper: false },
            );

            const columns = ref.current?.getColumns();
            expect(columns).not.toBeNull();
        });

        it("inserts column before existing column", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <GtkColumnView ref={ref}>
                        {columns.map((title) => (
                            <ColumnViewColumn key={title} title={title} renderCell={() => <GtkLabel label="Cell" />} />
                        ))}
                        <ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                );
            }

            await render(<App columns={["First", "Last"]} />, { wrapper: false });

            await render(<App columns={["First", "Middle", "Last"]} />, { wrapper: false });

            expect(ref.current?.getColumns()).not.toBeNull();
        });

        it("removes column", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <GtkColumnView ref={ref}>
                        {columns.map((title) => (
                            <ColumnViewColumn key={title} title={title} renderCell={() => <GtkLabel label="Cell" />} />
                        ))}
                        <ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                );
            }

            await render(<App columns={["A", "B", "C"]} />, { wrapper: false });

            await render(<App columns={["A", "C"]} />, { wrapper: false });

            expect(ref.current?.getColumns()).not.toBeNull();
        });

        it("sets column properties (expand, resizable, fixedWidth)", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={ref}>
                    <ColumnViewColumn
                        title="Props"
                        expand={true}
                        resizable={true}
                        fixedWidth={100}
                        renderCell={() => <GtkLabel label="Cell" />}
                    />
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkColumnView>,
                { wrapper: false },
            );
        });

        it("updates column properties when props change", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ title }: { title: string }) {
                return (
                    <GtkColumnView ref={ref}>
                        <ColumnViewColumn title={title} renderCell={() => <GtkLabel label="Cell" />} />
                        <ListItem id="1" value={{ name: "First" }} />
                    </GtkColumnView>
                );
            }

            await render(<App title="Initial" />, { wrapper: false });

            await render(<App title="Updated" />, { wrapper: false });
        });
    });

    describe("ListItem", () => {
        it("adds item to list model", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={ref}>
                    <ColumnViewColumn title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkColumnView>,
                { wrapper: false },
            );

            expect(ref.current?.getModel()).not.toBeNull();
        });

        it("inserts item before existing item", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <GtkColumnView ref={ref}>
                        <ColumnViewColumn title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkColumnView>
                );
            }

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "3", name: "Third" },
                    ]}
                />,
                { wrapper: false },
            );

            await render(
                <App
                    items={[
                        { id: "1", name: "First" },
                        { id: "2", name: "Second" },
                        { id: "3", name: "Third" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(ref.current?.getModel()).not.toBeNull();
        });

        it("removes item", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ items }: { items: { id: string; name: string }[] }) {
                return (
                    <GtkColumnView ref={ref}>
                        <ColumnViewColumn title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                        {items.map((item) => (
                            <ListItem key={item.id} id={item.id} value={item} />
                        ))}
                    </GtkColumnView>
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
                { wrapper: false },
            );

            await render(
                <App
                    items={[
                        { id: "1", name: "A" },
                        { id: "3", name: "C" },
                    ]}
                />,
                { wrapper: false },
            );

            expect(ref.current?.getModel()).not.toBeNull();
        });
    });

    describe("renderCell", () => {
        it("receives item data in renderCell", async () => {
            const ref = createRef<Gtk.ColumnView>();
            const renderCell = vi.fn((item: { name: string } | null) => <GtkLabel label={item?.name ?? "Empty"} />);

            await render(
                <GtkColumnView ref={ref}>
                    <ColumnViewColumn title="Name" renderCell={renderCell} />
                    <ListItem id="1" value={{ name: "Test" }} />
                </GtkColumnView>,
                { wrapper: false },
            );
        });
    });

    describe("sorting", () => {
        it("sets sort column via sortColumn prop", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={ref} sortColumn="name">
                    <ColumnViewColumn id="name" title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkColumnView>,
                { wrapper: false },
            );
        });

        it("sets sort order via sortOrder prop", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={ref} sortColumn="name" sortOrder={Gtk.SortType.DESCENDING}>
                    <ColumnViewColumn id="name" title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkColumnView>,
                { wrapper: false },
            );
        });

        it("calls onSortChange when sort changes", async () => {
            const ref = createRef<Gtk.ColumnView>();
            const onSortChange = vi.fn();

            await render(
                <GtkColumnView ref={ref} onSortChange={onSortChange}>
                    <ColumnViewColumn id="name" title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                    <ListItem id="1" value={{ name: "First" }} />
                </GtkColumnView>,
                { wrapper: false },
            );
        });

        it("updates sort indicator when props change", async () => {
            const ref = createRef<Gtk.ColumnView>();

            function App({ sortColumn }: { sortColumn: string | null }) {
                return (
                    <GtkColumnView ref={ref} sortColumn={sortColumn}>
                        <ColumnViewColumn id="name" title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                        <ColumnViewColumn id="age" title="Age" renderCell={() => <GtkLabel label="Cell" />} />
                        <ListItem id="1" value={{ name: "First", age: 25 }} />
                    </GtkColumnView>
                );
            }

            await render(<App sortColumn="name" />, { wrapper: false });

            await render(<App sortColumn="age" />, { wrapper: false });
        });
    });

    describe("selection", () => {
        it("supports single selection", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={ref} selected={["1"]}>
                    <ColumnViewColumn title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                </GtkColumnView>,
                { wrapper: false },
            );
        });

        it("supports multiple selection", async () => {
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <GtkColumnView ref={ref} selectionMode={Gtk.SelectionMode.MULTIPLE} selected={["1", "2"]}>
                    <ColumnViewColumn title="Name" renderCell={() => <GtkLabel label="Cell" />} />
                    <ListItem id="1" value={{ name: "First" }} />
                    <ListItem id="2" value={{ name: "Second" }} />
                    <ListItem id="3" value={{ name: "Third" }} />
                </GtkColumnView>,
                { wrapper: false },
            );
        });
    });

    describe("React-side sorting with large dataset", () => {
        it("renders 200 rows in initial order", async () => {
            const employees = generateEmployees(200);
            const renderOrders: string[][] = [];
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <SortableColumnView
                    employees={employees}
                    columnViewRef={ref}
                    onRenderOrder={(ids) => renderOrders.push(ids)}
                />,
                { wrapper: false },
            );

            const initialOrder = renderOrders[renderOrders.length - 1];
            expect(initialOrder).toBeDefined();
            expect(initialOrder?.length).toBe(200);
            expect(initialOrder?.[0]).toBe("1");
            expect(initialOrder?.[199]).toBe("200");
        });

        it("sorts 200 rows when clicking salary column header", async () => {
            const employees = generateEmployees(200);
            const renderOrders: string[][] = [];
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <SortableColumnView
                    employees={employees}
                    columnViewRef={ref}
                    onRenderOrder={(ids) => renderOrders.push(ids)}
                />,
                { wrapper: false },
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

        it("sorts 200 rows descending when clicking column header with DESC order", async () => {
            const employees = generateEmployees(200);
            const renderOrders: string[][] = [];
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <SortableColumnView
                    employees={employees}
                    columnViewRef={ref}
                    onRenderOrder={(ids) => renderOrders.push(ids)}
                />,
                { wrapper: false },
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

        it("switches sort column when clicking different column header", async () => {
            const employees = generateEmployees(200);
            const renderOrders: string[][] = [];
            const ref = createRef<Gtk.ColumnView>();

            await render(
                <SortableColumnView
                    employees={employees}
                    columnViewRef={ref}
                    onRenderOrder={(ids) => renderOrders.push(ids)}
                />,
                { wrapper: false },
            );

            await clickColumnHeader(ref.current as Gtk.ColumnView, "salary", Gtk.SortType.ASCENDING);

            const sortedBySalary = [...(renderOrders[renderOrders.length - 1] ?? [])];

            await clickColumnHeader(ref.current as Gtk.ColumnView, "name", Gtk.SortType.ASCENDING);

            const sortedByName = renderOrders[renderOrders.length - 1];

            expect(sortedByName).not.toEqual(sortedBySalary);

            expect(sortedByName?.[0]).toBe("1");
            expect(sortedByName?.[99]).toBe("100");
        });

        it("maintains model integrity after multiple sort operations on 200 rows", async () => {
            const employees = generateEmployees(200);
            const ref = createRef<Gtk.ColumnView>();

            await render(<SortableColumnView employees={employees} columnViewRef={ref} />, { wrapper: false });

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
