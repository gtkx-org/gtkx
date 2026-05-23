import * as Gtk from "@gtkx/ffi/gtk";
import { GtkColumnView, GtkLabel } from "@gtkx/react";
import { render } from "@gtkx/testing";
import type { ComponentProps, ReactNode, RefObject } from "react";
import { createRef, useCallback, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderChildren } from "../helpers/render-children.js";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

const MenuItem = "MenuItem" as const;
const MenuSection = "MenuSection" as const;
const MenuSubmenu = "MenuSubmenu" as const;

const noop = () => {};
const cellRenderer = () => "Cell";

type ColumnExtra = Omit<ComponentProps<typeof GtkColumnView.Column>, "id" | "title" | "children" | "renderCell">;

const DefaultColumn = ({
    id,
    title,
    children,
    ...extra
}: { id: string; title: string; children?: ReactNode } & ColumnExtra) => (
    <GtkColumnView.Column id={id} title={title} expand renderCell={cellRenderer} {...extra}>
        {children}
    </GtkColumnView.Column>
);

const buildColumnMenu = (columnViewRef: RefObject<Gtk.ColumnView | null>) => (items: string[]) => (
    <ScrollWrapper>
        <GtkColumnView ref={columnViewRef}>
            <DefaultColumn id="name" title="Name">
                {items.map((label) => (
                    <MenuItem key={label} id={label} label={label} onActivate={noop} />
                ))}
            </DefaultColumn>
        </GtkColumnView>
    </ScrollWrapper>
);

const renderColumns = async (columnViewRef: RefObject<Gtk.ColumnView | null>, columns: ReactNode): Promise<void> => {
    await render(
        <ScrollWrapper>
            <GtkColumnView ref={columnViewRef}>{columns}</GtkColumnView>
        </ScrollWrapper>,
    );
};

const getColumn = (columnView: Gtk.ColumnView, index: number): Gtk.ColumnViewColumn => {
    return columnView.getColumns().getItem(index) as Gtk.ColumnViewColumn;
};

describe("render - ColumnViewColumn (1)", () => {
    describe("ColumnViewColumnNode (1)", () => {
        it("adds column to ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(columnViewRef, <DefaultColumn id="name" title="Name" />);

            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(1);
        });

        it("sets column title", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(columnViewRef, <DefaultColumn id="col" title="My Column" />);

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getItem(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("My Column");
        });

        it("sets column expand property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <GtkColumnView.Column id="expand" title="Expandable" expand={true} renderCell={() => "Cell"} />,
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getItem(0) as Gtk.ColumnViewColumn;
            expect(column?.getExpand()).toBe(true);
        });
    });
});

describe("render - ColumnViewColumn (2)", () => {
    describe("ColumnViewColumnNode (2)", () => {
        it("sets column property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <GtkColumnView.Column id="resize" title="Resizable" expand resizable renderCell={() => "Cell"} />,
            );

            const columns = columnViewRef.current?.getColumns();
            const column = columns?.getItem(0) as Gtk.ColumnViewColumn;
            expect(column?.getResizable()).toBe(true);
        });

        it("adds multiple columns", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <>
                    <GtkColumnView.Column id="col1" title="Column 1" expand renderCell={() => "Cell 1"} />
                    <GtkColumnView.Column id="col2" title="Column 2" expand renderCell={() => "Cell 2"} />
                    <GtkColumnView.Column id="col3" title="Column 3" expand renderCell={() => "Cell 3"} />
                </>,
            );

            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(3);
        });
    });
});

describe("render - ColumnViewColumn (3)", () => {
    describe("ColumnViewColumnNode (3)", () => {
        it("updates column title on prop change", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ title }: { title: string }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            <GtkColumnView.Column id="col" title={title} expand renderCell={() => "Cell"} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App title="Initial" />);
            let column = columnViewRef.current?.getColumns()?.getItem(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("Initial");

            await render(<App title="Updated" />);
            column = columnViewRef.current?.getColumns()?.getItem(0) as Gtk.ColumnViewColumn;
            expect(column?.getTitle()).toBe("Updated");
        });
    });
});

describe("render - ColumnViewColumn (4)", () => {
    describe("ColumnViewColumnNode (4)", () => {
        it("removes column from ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            {columns.map((title) => (
                                <GtkColumnView.Column
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
});

describe("render - ColumnViewColumn (5)", () => {
    describe("header menu (1)", () => {
        it("sets header menu when menu items are added", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <DefaultColumn id="name" title="Name">
                    <MenuItem id="sort-asc" label="Sort A-Z" onActivate={noop} />
                    <MenuItem id="sort-desc" label="Sort Z-A" onActivate={noop} />
                </DefaultColumn>,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).not.toBeNull();
            expect(column.getHeaderMenu()?.getNItems()).toBe(2);
        });

        it("has no header menu when no menu children", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(columnViewRef, <DefaultColumn id="name" title="Name" />);

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).toBeNull();
        });

        it("supports menu sections", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <DefaultColumn id="name" title="Name">
                    <MenuSection>
                        <MenuItem id="sort-asc" label="Sort A-Z" onActivate={noop} />
                        <MenuItem id="sort-desc" label="Sort Z-A" onActivate={noop} />
                    </MenuSection>
                    <MenuSection>
                        <MenuItem id="hide" label="Hide Column" onActivate={noop} />
                    </MenuSection>
                </DefaultColumn>,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).not.toBeNull();
            expect(column.getHeaderMenu()?.getNItems()).toBe(2);
        });
    });
});

describe("render - ColumnViewColumn (6)", () => {
    describe("header menu (2)", () => {
        it("supports menu submenus", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <DefaultColumn id="name" title="Name">
                    <MenuItem id="sort" label="Sort" onActivate={noop} />
                    <MenuSubmenu label="More">
                        <MenuItem id="hide" label="Hide" onActivate={noop} />
                    </MenuSubmenu>
                </DefaultColumn>,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()).not.toBeNull();
            expect(column.getHeaderMenu()?.getNItems()).toBe(2);
        });

        it("dynamically adds menu items", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            const { rerender } = await renderChildren(["A"], buildColumnMenu(columnViewRef));
            let column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(1);

            await rerender(["A", "B", "C"]);
            column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(3);
        });

        it("dynamically removes menu items", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            const { rerender } = await renderChildren(["A", "B", "C"], buildColumnMenu(columnViewRef));
            let column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(3);

            await rerender(["A"]);
            column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(1);
        });
    });
});

describe("render - ColumnViewColumn (7)", () => {
    describe("header menu (3)", () => {
        it("cleans up menu when all items removed", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ showMenu }: { showMenu: boolean }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            <DefaultColumn id="name" title="Name">
                                {showMenu && <MenuItem id="action" label="Action" onActivate={noop} />}
                            </DefaultColumn>
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
    });
});

describe("render - ColumnViewColumn (8)", () => {
    describe("header menu (4)", () => {
        it("supports multiple columns with independent menus", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <>
                    <DefaultColumn id="name" title="Name">
                        <MenuItem id="sort" label="Sort" onActivate={noop} />
                    </DefaultColumn>
                    <DefaultColumn id="age" title="Age">
                        <MenuItem id="sort" label="Sort" onActivate={noop} />
                        <MenuItem id="filter" label="Filter" onActivate={noop} />
                    </DefaultColumn>
                    <DefaultColumn id="email" title="Email" />
                </>,
            );

            const nameCol = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            const ageCol = getColumn(columnViewRef.current as Gtk.ColumnView, 1);
            const emailCol = getColumn(columnViewRef.current as Gtk.ColumnView, 2);

            expect(nameCol.getHeaderMenu()?.getNItems()).toBe(1);
            expect(ageCol.getHeaderMenu()?.getNItems()).toBe(2);
            expect(emailCol.getHeaderMenu()).toBeNull();
        });
    });
});

describe("render - ColumnViewColumn (9)", () => {
    describe("header menu (5)", () => {
        it("cleans up menu when column is removed", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            const onActivate = vi.fn();

            function App({ showColumn }: { showColumn: boolean }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            {showColumn && (
                                <DefaultColumn id="name" title="Name">
                                    <MenuItem id="action" label="Action" onActivate={onActivate} />
                                </DefaultColumn>
                            )}
                            <DefaultColumn id="other" title="Other" />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App showColumn={true} />);
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(2);

            await render(<App showColumn={false} />);
            expect(columnViewRef.current?.getColumns()?.getNItems()).toBe(1);
        });
    });
});

type ShowcasePerson = { name: string; role: string; salary: number };
type ShowcaseSortColumn = "name" | "role" | "salary" | null;

const showcasePeople: ShowcasePerson[] = [
    { name: "Alice", role: "Dev", salary: 95000 },
    { name: "Bob", role: "Designer", salary: 85000 },
    { name: "Charlie", role: "Manager", salary: 120000 },
];

const ShowcaseColumnMenu = ({
    column,
    onSort,
    children,
}: {
    column: ShowcaseSortColumn;
    onSort: (col: string | null, order: Gtk.SortType) => void;
    children?: ReactNode;
}) => (
    <>
        <MenuSection>
            <MenuItem id="sort-asc" label="Sort Ascending" onActivate={() => onSort(column, Gtk.SortType.ASCENDING)} />
            <MenuItem
                id="sort-desc"
                label="Sort Descending"
                onActivate={() => onSort(column, Gtk.SortType.DESCENDING)}
            />
            <MenuItem id="sort-clear" label="Clear Sort" onActivate={() => onSort(null, Gtk.SortType.ASCENDING)} />
        </MenuSection>
        {children}
    </>
);

function ShowcaseSortableApp({ columnViewRef }: { columnViewRef: RefObject<Gtk.ColumnView | null> }) {
    const [sortColumn, setSortColumn] = useState<ShowcaseSortColumn>(null);
    const [sortOrder, setSortOrder] = useState<Gtk.SortType>(Gtk.SortType.ASCENDING);

    const handleSortChange = useCallback((column: string | null, order: Gtk.SortType) => {
        setSortColumn(column as ShowcaseSortColumn);
        setSortOrder(order);
    }, []);

    const sortedPeople = useMemo(() => {
        if (!sortColumn) return showcasePeople;
        return [...showcasePeople].sort((a, b) => {
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
                items={sortedPeople.map((person) => ({ id: person.name, value: person }))}
            >
                <GtkColumnView.Column
                    id="name"
                    title="Name"
                    expand
                    sortable
                    renderCell={(item: ShowcasePerson) => <GtkLabel label={item.name} />}
                >
                    <ShowcaseColumnMenu column="name" onSort={handleSortChange} />
                </GtkColumnView.Column>
                <GtkColumnView.Column
                    id="role"
                    title="Role"
                    fixedWidth={100}
                    sortable
                    renderCell={(item: ShowcasePerson) => <GtkLabel label={item.role} />}
                >
                    <ShowcaseColumnMenu column="role" onSort={handleSortChange}>
                        <MenuSection>
                            <MenuItem id="hide" label="Hide Column" onActivate={noop} />
                        </MenuSection>
                    </ShowcaseColumnMenu>
                </GtkColumnView.Column>
                <GtkColumnView.Column
                    id="salary"
                    title="Salary"
                    fixedWidth={100}
                    sortable
                    renderCell={(item: ShowcasePerson) => <GtkLabel label={item.salary.toString()} />}
                >
                    <ShowcaseColumnMenu column="salary" onSort={handleSortChange}>
                        <MenuSection>
                            <MenuItem id="hide" label="Hide Column" onActivate={noop} />
                        </MenuSection>
                    </ShowcaseColumnMenu>
                </GtkColumnView.Column>
            </GtkColumnView>
        </ScrollWrapper>
    );
}

describe("render - ColumnViewColumn (10) > header menu (6)", () => {
    it("x-showcase pattern: fragment-wrapped menus with sortable columns and list items", async () => {
        const columnViewRef = createRef<Gtk.ColumnView>();

        await render(<ShowcaseSortableApp columnViewRef={columnViewRef} />);

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
});

describe("render - ColumnViewColumn (11)", () => {
    describe("header menu (7)", () => {
        it("activates menu actions on each column via activateAction", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            const nameSortAsc = vi.fn();
            const nameSortDesc = vi.fn();
            const roleSortAsc = vi.fn();
            const roleHide = vi.fn();
            const salarySortAsc = vi.fn();
            const salaryHide = vi.fn();

            await renderColumns(
                columnViewRef,
                <>
                    <DefaultColumn id="name" title="Name">
                        <MenuSection>
                            <MenuItem id="sort-asc" label="Sort Ascending" onActivate={nameSortAsc} />
                            <MenuItem id="sort-desc" label="Sort Descending" onActivate={nameSortDesc} />
                        </MenuSection>
                    </DefaultColumn>
                    <DefaultColumn id="role" title="Role">
                        <MenuSection>
                            <MenuItem id="sort-asc" label="Sort Ascending" onActivate={roleSortAsc} />
                        </MenuSection>
                        <MenuSection>
                            <MenuItem id="hide" label="Hide Column" onActivate={roleHide} />
                        </MenuSection>
                    </DefaultColumn>
                    <DefaultColumn id="salary" title="Salary">
                        <MenuSection>
                            <MenuItem id="sort-asc" label="Sort Ascending" onActivate={salarySortAsc} />
                        </MenuSection>
                        <MenuSection>
                            <MenuItem id="hide" label="Hide Column" onActivate={salaryHide} />
                        </MenuSection>
                    </DefaultColumn>
                </>,
            );

            const columnView = columnViewRef.current as Gtk.ColumnView;

            expect(columnView.activateAction("name.sort-asc", null)).toBe(true);
            expect(nameSortAsc).toHaveBeenCalledTimes(1);

            expect(columnView.activateAction("name.sort-desc", null)).toBe(true);
            expect(nameSortDesc).toHaveBeenCalledTimes(1);

            expect(columnView.activateAction("role.sort-asc", null)).toBe(true);
            expect(roleSortAsc).toHaveBeenCalledTimes(1);

            expect(columnView.activateAction("role.hide", null)).toBe(true);
            expect(roleHide).toHaveBeenCalledTimes(1);

            expect(columnView.activateAction("salary.sort-asc", null)).toBe(true);
            expect(salarySortAsc).toHaveBeenCalledTimes(1);

            expect(columnView.activateAction("salary.hide", null)).toBe(true);
            expect(salaryHide).toHaveBeenCalledTimes(1);

            expect(nameSortAsc).toHaveBeenCalledTimes(1);
            expect(roleSortAsc).toHaveBeenCalledTimes(1);
            expect(salarySortAsc).toHaveBeenCalledTimes(1);
        });
    });
});

describe("render - ColumnViewColumn (12)", () => {
    describe("header menu (8)", () => {
        it("iterates menu model items for each column header", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <>
                    <DefaultColumn id="name" title="Name">
                        <MenuSection>
                            <MenuItem id="sort-asc" label="Sort Ascending" onActivate={noop} />
                            <MenuItem id="sort-desc" label="Sort Descending" onActivate={noop} />
                            <MenuItem id="sort-clear" label="Clear Sort" onActivate={noop} />
                        </MenuSection>
                    </DefaultColumn>
                    <DefaultColumn id="role" title="Role">
                        <MenuSection>
                            <MenuItem id="sort-asc" label="Sort Ascending" onActivate={noop} />
                        </MenuSection>
                        <MenuSection>
                            <MenuItem id="hide" label="Hide Column" onActivate={noop} />
                        </MenuSection>
                    </DefaultColumn>
                </>,
            );

            const nameCol = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            const roleCol = getColumn(columnViewRef.current as Gtk.ColumnView, 1);

            const nameMenu = nameCol.getHeaderMenu();
            expect(nameMenu).not.toBeNull();
            expect(nameMenu?.getNItems()).toBe(1);

            const nameSection = nameMenu?.getItemLink(0, "section");
            expect(nameSection).not.toBeNull();
            expect(nameSection?.getNItems()).toBe(3);
            expect(nameSection?.getItemAttributeValue(0, "label", null)?.getString()[0]).toBe("Sort Ascending");
            expect(nameSection?.getItemAttributeValue(0, "action", null)?.getString()[0]).toBe("name.sort-asc");
            expect(nameSection?.getItemAttributeValue(1, "label", null)?.getString()[0]).toBe("Sort Descending");
            expect(nameSection?.getItemAttributeValue(1, "action", null)?.getString()[0]).toBe("name.sort-desc");
            expect(nameSection?.getItemAttributeValue(2, "label", null)?.getString()[0]).toBe("Clear Sort");
            expect(nameSection?.getItemAttributeValue(2, "action", null)?.getString()[0]).toBe("name.sort-clear");

            const roleMenu = roleCol.getHeaderMenu();
            expect(roleMenu).not.toBeNull();
            expect(roleMenu?.getNItems()).toBe(2);

            const roleSection1 = roleMenu?.getItemLink(0, "section");
            expect(roleSection1).not.toBeNull();
            expect(roleSection1?.getNItems()).toBe(1);
            expect(roleSection1?.getItemAttributeValue(0, "label", null)?.getString()[0]).toBe("Sort Ascending");
            expect(roleSection1?.getItemAttributeValue(0, "action", null)?.getString()[0]).toBe("role.sort-asc");

            const roleSection2 = roleMenu?.getItemLink(1, "section");
            expect(roleSection2).not.toBeNull();
            expect(roleSection2?.getNItems()).toBe(1);
            expect(roleSection2?.getItemAttributeValue(0, "label", null)?.getString()[0]).toBe("Hide Column");
            expect(roleSection2?.getItemAttributeValue(0, "action", null)?.getString()[0]).toBe("role.hide");
        });
    });
});
