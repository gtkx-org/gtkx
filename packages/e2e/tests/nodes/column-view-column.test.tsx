import * as Gtk from "@gtkx/ffi/gtk";
import { GtkColumnView, GtkLabel, GtkScrolledWindow, x } from "@gtkx/react";
import { render } from "@gtkx/testing";
import type { ReactNode } from "react";
import { createRef, useCallback, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";

const ScrollWrapper = ({ children }: { children: ReactNode }) => (
    <GtkScrolledWindow minContentHeight={200} minContentWidth={200}>
        {children}
    </GtkScrolledWindow>
);

describe("render - ColumnViewColumn", () => {
    describe("ColumnViewColumnNode", () => {
        it("adds column to ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(1);
        });

        it("sets column title", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="col" title="My Column" expand renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("My Column");
        });

        it("sets column expand property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="expand" title="Expandable" expand={true} renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getExpand()).toBe(true);
        });

        it("sets column property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="resize" title="Resizable" expand resizable renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getResizable()).toBe(true);
        });

        it("adds multiple columns", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="col1" title="Column 1" expand renderCell={() => "Cell 1"} />
                        <x.ColumnViewColumn id="col2" title="Column 2" expand renderCell={() => "Cell 2"} />
                        <x.ColumnViewColumn id="col3" title="Column 3" expand renderCell={() => "Cell 3"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(3);
        });

        it("updates column title on prop change", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ title }: { title: string }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            <x.ColumnViewColumn id="col" title={title} expand renderCell={() => "Cell"} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App title="Initial" />);
            let column = columnViewRef.current?.getColumns()?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("Initial");

            await render(<App title="Updated" />);
            column = columnViewRef.current?.getColumns()?.getObject(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("Updated");
        });

        it("removes column from ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            {columns.map((title) => (
                                <x.ColumnViewColumn
                                    key={title}
                                    id={title}
                                    title={title}
                                    expand
                                    renderCell={() => <GtkLabel label={title} />}
                                />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App columns={["A", "B", "C"]} />);
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(3);

            await render(<App columns={["A", "C"]} />);
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(2);
        });
    });

    describe("header menu", () => {
        const getColumn = (columnView: Gtk.ColumnView, index: number): Gtk.ColumnViewColumn => {
            return columnView.getColumns().getObject(index) as Gtk.ColumnViewColumn;
        };

        it("sets header menu when menu items are added", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                            <x.MenuItem id="sort-asc" label="Sort A-Z" onActivate={() => {}} />
                            <x.MenuItem id="sort-desc" label="Sort Z-A" onActivate={() => {}} />
                        </x.ColumnViewColumn>
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).not.toBeNull();
            expect(column.getHeaderMenu()?.getNItems()).toBe(2);
        });

        it("has no header menu when no menu children", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).toBeNull();
        });

        it("supports menu sections", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                            <x.MenuSection>
                                <x.MenuItem id="sort-asc" label="Sort A-Z" onActivate={() => {}} />
                                <x.MenuItem id="sort-desc" label="Sort Z-A" onActivate={() => {}} />
                            </x.MenuSection>
                            <x.MenuSection>
                                <x.MenuItem id="hide" label="Hide Column" onActivate={() => {}} />
                            </x.MenuSection>
                        </x.ColumnViewColumn>
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).not.toBeNull();
            expect(column.getHeaderMenu()?.getNItems()).toBe(2);
        });

        it("supports menu submenus", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                            <x.MenuItem id="sort" label="Sort" onActivate={() => {}} />
                            <x.MenuSubmenu label="More">
                                <x.MenuItem id="hide" label="Hide" onActivate={() => {}} />
                            </x.MenuSubmenu>
                        </x.ColumnViewColumn>
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).not.toBeNull();
            expect(column.getHeaderMenu()?.getNItems()).toBe(2);
        });

        it("dynamically adds menu items", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                                {items.map((label) => (
                                    <x.MenuItem key={label} id={label} label={label} onActivate={() => {}} />
                                ))}
                            </x.ColumnViewColumn>
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A"]} />);
            let column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(1);

            await render(<App items={["A", "B", "C"]} />);
            column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(3);
        });

        it("dynamically removes menu items", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ items }: { items: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                                {items.map((label) => (
                                    <x.MenuItem key={label} id={label} label={label} onActivate={() => {}} />
                                ))}
                            </x.ColumnViewColumn>
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App items={["A", "B", "C"]} />);
            let column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(3);

            await render(<App items={["A"]} />);
            column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(1);
        });

        it("cleans up menu when all items removed", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ showMenu }: { showMenu: boolean }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                                {showMenu && <x.MenuItem id="action" label="Action" onActivate={() => {}} />}
                            </x.ColumnViewColumn>
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App showMenu={true} />);
            let column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).not.toBeNull();

            await render(<App showMenu={false} />);
            column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).toBeNull();
        });

        it("supports multiple columns with independent menus", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                            <x.MenuItem id="sort" label="Sort" onActivate={() => {}} />
                        </x.ColumnViewColumn>
                        <x.ColumnViewColumn id="age" title="Age" expand renderCell={() => "Cell"}>
                            <x.MenuItem id="sort" label="Sort" onActivate={() => {}} />
                            <x.MenuItem id="filter" label="Filter" onActivate={() => {}} />
                        </x.ColumnViewColumn>
                        <x.ColumnViewColumn id="email" title="Email" expand renderCell={() => "Cell"} />
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const nameCol = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            const ageCol = getColumn(columnViewRef.current as Gtk.ColumnView, 1);
            const emailCol = getColumn(columnViewRef.current as Gtk.ColumnView, 2);

            expect(nameCol.getHeaderMenu()?.getNItems()).toBe(1);
            expect(ageCol.getHeaderMenu()?.getNItems()).toBe(2);
            expect(emailCol.getHeaderMenu()).toBeNull();
        });

        it("cleans up menu when column is removed", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            const onActivate = vi.fn();

            function App({ showColumn }: { showColumn: boolean }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            {showColumn && (
                                <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                                    <x.MenuItem id="action" label="Action" onActivate={onActivate} />
                                </x.ColumnViewColumn>
                            )}
                            <x.ColumnViewColumn id="other" title="Other" expand renderCell={() => "Cell"} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App showColumn={true} />);
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(2);

            await render(<App showColumn={false} />);
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(1);
        });

        it("x-showcase pattern: fragment-wrapped menus with sortable columns and list items", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            type Person = { name: string; role: string; salary: number };

            const people: Person[] = [
                { name: "Alice", role: "Dev", salary: 95000 },
                { name: "Bob", role: "Designer", salary: 85000 },
                { name: "Charlie", role: "Manager", salary: 120000 },
            ];

            type SortColumn = "name" | "role" | "salary" | null;

            const ColumnMenu = ({
                column,
                onSort,
                children,
            }: {
                column: SortColumn;
                onSort: (col: string | null, order: Gtk.SortType) => void;
                children?: ReactNode;
            }) => (
                <>
                    <x.MenuSection>
                        <x.MenuItem
                            id="sort-asc"
                            label="Sort Ascending"
                            onActivate={() => onSort(column, Gtk.SortType.ASCENDING)}
                        />
                        <x.MenuItem
                            id="sort-desc"
                            label="Sort Descending"
                            onActivate={() => onSort(column, Gtk.SortType.DESCENDING)}
                        />
                        <x.MenuItem
                            id="sort-clear"
                            label="Clear Sort"
                            onActivate={() => onSort(null, Gtk.SortType.ASCENDING)}
                        />
                    </x.MenuSection>
                    {children}
                </>
            );

            function App() {
                const [sortColumn, setSortColumn] = useState<SortColumn>(null);
                const [sortOrder, setSortOrder] = useState<Gtk.SortType>(Gtk.SortType.ASCENDING);

                const handleSortChange = useCallback((column: string | null, order: Gtk.SortType) => {
                    setSortColumn(column as SortColumn);
                    setSortOrder(order);
                }, []);

                const sortedPeople = useMemo(() => {
                    if (!sortColumn) return people;
                    return [...people].sort((a, b) => {
                        const av = a[sortColumn];
                        const bv = b[sortColumn];
                        const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
                        return sortOrder === Gtk.SortType.ASCENDING ? cmp : -cmp;
                    });
                }, [sortColumn, sortOrder]);

                return (
                    <ScrollWrapper>
                        <GtkColumnView
                            ref={columnViewRef}
                            estimatedRowHeight={48}
                            sortColumn={sortColumn}
                            sortOrder={sortOrder}
                            onSortChanged={handleSortChange}
                        >
                            <x.ColumnViewColumn
                                id="name"
                                title="Name"
                                expand
                                sortable
                                renderCell={(item: Person | null) => <GtkLabel label={item?.name ?? ""} />}
                            >
                                <ColumnMenu column="name" onSort={handleSortChange} />
                            </x.ColumnViewColumn>
                            <x.ColumnViewColumn
                                id="role"
                                title="Role"
                                fixedWidth={100}
                                sortable
                                renderCell={(item: Person | null) => <GtkLabel label={item?.role ?? ""} />}
                            >
                                <ColumnMenu column="role" onSort={handleSortChange}>
                                    <x.MenuSection>
                                        <x.MenuItem id="hide" label="Hide Column" onActivate={() => {}} />
                                    </x.MenuSection>
                                </ColumnMenu>
                            </x.ColumnViewColumn>
                            <x.ColumnViewColumn
                                id="salary"
                                title="Salary"
                                fixedWidth={100}
                                sortable
                                renderCell={(item: Person | null) => (
                                    <GtkLabel label={item?.salary?.toString() ?? ""} />
                                )}
                            >
                                <ColumnMenu column="salary" onSort={handleSortChange}>
                                    <x.MenuSection>
                                        <x.MenuItem id="hide" label="Hide Column" onActivate={() => {}} />
                                    </x.MenuSection>
                                </ColumnMenu>
                            </x.ColumnViewColumn>
                            {sortedPeople.map((person) => (
                                <x.ListItem key={person.name} id={person.name} value={person} />
                            ))}
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App />);

            const nameCol = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            const roleCol = getColumn(columnViewRef.current as Gtk.ColumnView, 1);
            const salaryCol = getColumn(columnViewRef.current as Gtk.ColumnView, 2);

            expect(nameCol.getHeaderMenu()).not.toBeNull();
            expect(roleCol.getHeaderMenu()).not.toBeNull();
            expect(salaryCol.getHeaderMenu()).not.toBeNull();

            expect(nameCol.getHeaderMenu()?.getNItems()).toBe(1);
            expect(roleCol.getHeaderMenu()?.getNItems()).toBe(2);
            expect(salaryCol.getHeaderMenu()?.getNItems()).toBe(2);
        });

        it("activates menu actions on each column via activateActionVariant", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            const nameSortAsc = vi.fn();
            const nameSortDesc = vi.fn();
            const roleSortAsc = vi.fn();
            const roleHide = vi.fn();
            const salarySortAsc = vi.fn();
            const salaryHide = vi.fn();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                            <x.MenuSection>
                                <x.MenuItem id="sort-asc" label="Sort Ascending" onActivate={nameSortAsc} />
                                <x.MenuItem id="sort-desc" label="Sort Descending" onActivate={nameSortDesc} />
                            </x.MenuSection>
                        </x.ColumnViewColumn>
                        <x.ColumnViewColumn id="role" title="Role" expand renderCell={() => "Cell"}>
                            <x.MenuSection>
                                <x.MenuItem id="sort-asc" label="Sort Ascending" onActivate={roleSortAsc} />
                            </x.MenuSection>
                            <x.MenuSection>
                                <x.MenuItem id="hide" label="Hide Column" onActivate={roleHide} />
                            </x.MenuSection>
                        </x.ColumnViewColumn>
                        <x.ColumnViewColumn id="salary" title="Salary" expand renderCell={() => "Cell"}>
                            <x.MenuSection>
                                <x.MenuItem id="sort-asc" label="Sort Ascending" onActivate={salarySortAsc} />
                            </x.MenuSection>
                            <x.MenuSection>
                                <x.MenuItem id="hide" label="Hide Column" onActivate={salaryHide} />
                            </x.MenuSection>
                        </x.ColumnViewColumn>
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const columnView = columnViewRef.current as Gtk.ColumnView;

            expect(columnView.activateActionVariant("name.sort-asc", null)).toBe(true);
            expect(nameSortAsc).toHaveBeenCalledTimes(1);

            expect(columnView.activateActionVariant("name.sort-desc", null)).toBe(true);
            expect(nameSortDesc).toHaveBeenCalledTimes(1);

            expect(columnView.activateActionVariant("role.sort-asc", null)).toBe(true);
            expect(roleSortAsc).toHaveBeenCalledTimes(1);

            expect(columnView.activateActionVariant("role.hide", null)).toBe(true);
            expect(roleHide).toHaveBeenCalledTimes(1);

            expect(columnView.activateActionVariant("salary.sort-asc", null)).toBe(true);
            expect(salarySortAsc).toHaveBeenCalledTimes(1);

            expect(columnView.activateActionVariant("salary.hide", null)).toBe(true);
            expect(salaryHide).toHaveBeenCalledTimes(1);

            expect(nameSortAsc).toHaveBeenCalledTimes(1);
            expect(roleSortAsc).toHaveBeenCalledTimes(1);
            expect(salarySortAsc).toHaveBeenCalledTimes(1);
        });

        it("iterates menu model items for each column header", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await render(
                <ScrollWrapper>
                    <GtkColumnView ref={columnViewRef}>
                        <x.ColumnViewColumn id="name" title="Name" expand renderCell={() => "Cell"}>
                            <x.MenuSection>
                                <x.MenuItem id="sort-asc" label="Sort Ascending" onActivate={() => {}} />
                                <x.MenuItem id="sort-desc" label="Sort Descending" onActivate={() => {}} />
                                <x.MenuItem id="sort-clear" label="Clear Sort" onActivate={() => {}} />
                            </x.MenuSection>
                        </x.ColumnViewColumn>
                        <x.ColumnViewColumn id="role" title="Role" expand renderCell={() => "Cell"}>
                            <x.MenuSection>
                                <x.MenuItem id="sort-asc" label="Sort Ascending" onActivate={() => {}} />
                            </x.MenuSection>
                            <x.MenuSection>
                                <x.MenuItem id="hide" label="Hide Column" onActivate={() => {}} />
                            </x.MenuSection>
                        </x.ColumnViewColumn>
                    </GtkColumnView>
                </ScrollWrapper>,
            );

            const nameCol = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            const roleCol = getColumn(columnViewRef.current as Gtk.ColumnView, 1);

            const nameMenu = nameCol.getHeaderMenu();
            expect(nameMenu).not.toBeNull();
            expect(nameMenu?.getNItems()).toBe(1);

            const nameSection = nameMenu?.getItemLink(0, "section");
            expect(nameSection).not.toBeNull();
            expect(nameSection?.getNItems()).toBe(3);
            expect(nameSection?.getItemAttributeValue(0, "label")?.getString()).toBe("Sort Ascending");
            expect(nameSection?.getItemAttributeValue(0, "action")?.getString()).toBe("name.sort-asc");
            expect(nameSection?.getItemAttributeValue(1, "label")?.getString()).toBe("Sort Descending");
            expect(nameSection?.getItemAttributeValue(1, "action")?.getString()).toBe("name.sort-desc");
            expect(nameSection?.getItemAttributeValue(2, "label")?.getString()).toBe("Clear Sort");
            expect(nameSection?.getItemAttributeValue(2, "action")?.getString()).toBe("name.sort-clear");

            const roleMenu = roleCol.getHeaderMenu();
            expect(roleMenu).not.toBeNull();
            expect(roleMenu?.getNItems()).toBe(2);

            const roleSection1 = roleMenu?.getItemLink(0, "section");
            expect(roleSection1).not.toBeNull();
            expect(roleSection1?.getNItems()).toBe(1);
            expect(roleSection1?.getItemAttributeValue(0, "label")?.getString()).toBe("Sort Ascending");
            expect(roleSection1?.getItemAttributeValue(0, "action")?.getString()).toBe("role.sort-asc");

            const roleSection2 = roleMenu?.getItemLink(1, "section");
            expect(roleSection2).not.toBeNull();
            expect(roleSection2?.getNItems()).toBe(1);
            expect(roleSection2?.getItemAttributeValue(0, "label")?.getString()).toBe("Hide Column");
            expect(roleSection2?.getItemAttributeValue(0, "action")?.getString()).toBe("role.hide");
        });
    });
});
