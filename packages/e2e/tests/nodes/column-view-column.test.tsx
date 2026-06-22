import * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import { GtkColumnView, GtkColumnViewColumn, GtkLabel } from "@gtkx/jsx/gtk";
import type { MenuEntry } from "@gtkx/react";
import { render } from "@gtkx/testing";
import type { ComponentProps, ReactElement, ReactNode, RefObject } from "react";
import { createRef, useCallback, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderChildren } from "../helpers/render-children.js";
import { ScrollWrapper } from "../helpers/scroll-wrapper.js";

const noop = () => {};
const cellRenderer = () => <GtkLabel label="Cell" />;

type ColumnExtra = Omit<ComponentProps<typeof GtkColumnViewColumn>, "id" | "title" | "renderCell">;

const DefaultColumn = ({ id, title, ...extra }: { id: string; title: string } & ColumnExtra) => (
    <GtkColumnViewColumn id={id} title={title} expand renderCell={cellRenderer} {...extra} />
);

interface ActionSpec {
    id: string;
    label: string;
    onActivate?: () => void;
}

const actionGroup = (prefix: string, specs: ActionSpec[]): ReactNode => (
    <GSimpleActionGroup prefix={prefix}>
        {specs.map((spec) => (
            <GSimpleAction key={spec.id} name={spec.id} onActivate={spec.onActivate ?? noop} />
        ))}
    </GSimpleActionGroup>
);

const menuEntries = (prefix: string, specs: ActionSpec[]): MenuEntry[] =>
    specs.map((spec) => ({ label: spec.label, action: `${prefix}.${spec.id}` }));

const flatMenu = (prefix: string, specs: ActionSpec[]): ReactElement => <GMenu items={menuEntries(prefix, specs)} />;

const sectionedMenu = (prefix: string, sections: ActionSpec[][]): ReactElement => (
    <GMenu items={sections.map((specs) => ({ section: menuEntries(prefix, specs) }))} />
);

const renderColumns = async (
    columnViewRef: RefObject<Gtk.ColumnView | null>,
    columns: ReactNode,
    actionGroups?: ReactNode,
): Promise<void> => {
    await render(
        <ScrollWrapper actionGroups={actionGroups}>
            <GtkColumnView ref={columnViewRef}>{columns}</GtkColumnView>
        </ScrollWrapper>,
    );
};

const getColumn = (columnView: Gtk.ColumnView, index: number): Gtk.ColumnViewColumn => {
    return columnView.getColumns().getItem(index) as Gtk.ColumnViewColumn;
};

const expectHeaderMenuItemCounts = (
    columnViewRef: RefObject<Gtk.ColumnView | null>,
    expectedCounts: (number | null)[],
): void => {
    const columnView = columnViewRef.current as Gtk.ColumnView;
    expectedCounts.forEach((expectedCount, index) => {
        const headerMenu = getColumn(columnView, index).getHeaderMenu();
        if (expectedCount === null) {
            expect(headerMenu).toBeNull();
        } else {
            expect(headerMenu?.getNItems()).toBe(expectedCount);
        }
    });
};

const ROLE_SORT_HIDE_MENU = sectionedMenu("role", [
    [{ id: "sort-asc", label: "Sort Ascending" }],
    [{ id: "hide", label: "Hide Column" }],
]);

const renderNameAndRoleColumns = async (
    columnViewRef: RefObject<Gtk.ColumnView | null>,
    nameMenu: ReactElement,
    roleMenu: ReactElement,
    actionGroups?: ReactNode,
): Promise<void> => {
    await renderColumns(
        columnViewRef,
        <>
            <DefaultColumn id="name" title="Name" headerMenu={nameMenu} />
            <DefaultColumn id="role" title="Role" headerMenu={roleMenu} />
        </>,
        actionGroups,
    );
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

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column?.getTitle()).toBe("My Column");
        });

        it("sets column expand property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <GtkColumnViewColumn id="expand" title="Expandable" expand={true} renderCell={cellRenderer} />,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
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
                <GtkColumnViewColumn id="resize" title="Resizable" expand resizable renderCell={cellRenderer} />,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column?.getResizable()).toBe(true);
        });

        it("adds multiple columns", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <>
                    <GtkColumnViewColumn
                        id="col1"
                        title="Column 1"
                        expand
                        renderCell={() => <GtkLabel label="Cell 1" />}
                    />
                    <GtkColumnViewColumn
                        id="col2"
                        title="Column 2"
                        expand
                        renderCell={() => <GtkLabel label="Cell 2" />}
                    />
                    <GtkColumnViewColumn
                        id="col3"
                        title="Column 3"
                        expand
                        renderCell={() => <GtkLabel label="Cell 3" />}
                    />
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
                            <GtkColumnViewColumn id="col" title={title} expand renderCell={cellRenderer} />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App title="Initial" />);
            expect(getColumn(columnViewRef.current as Gtk.ColumnView, 0)?.getTitle()).toBe("Initial");

            await render(<App title="Updated" />);
            expect(getColumn(columnViewRef.current as Gtk.ColumnView, 0)?.getTitle()).toBe("Updated");
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
                                <GtkColumnViewColumn
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
    describe("header menu slot", () => {
        it("installs a header menu from the headerMenu slot", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            await renderColumns(
                columnViewRef,
                <DefaultColumn
                    id="name"
                    title="Name"
                    headerMenu={flatMenu("name", [
                        { id: "sort-asc", label: "Sort A-Z" },
                        { id: "sort-desc", label: "Sort Z-A" },
                    ])}
                />,
            );

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(2);
        });

        it("has no header menu without the slot", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            await renderColumns(columnViewRef, <DefaultColumn id="name" title="Name" />);

            expect(getColumn(columnViewRef.current as Gtk.ColumnView, 0).getHeaderMenu()).toBeNull();
        });

        it("supports sections in the header menu", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            await renderColumns(
                columnViewRef,
                <DefaultColumn
                    id="name"
                    title="Name"
                    headerMenu={sectionedMenu("name", [
                        [
                            { id: "sort-asc", label: "Sort A-Z" },
                            { id: "sort-desc", label: "Sort Z-A" },
                        ],
                        [{ id: "hide", label: "Hide Column" }],
                    ])}
                />,
            );

            expect(
                getColumn(columnViewRef.current as Gtk.ColumnView, 0)
                    .getHeaderMenu()
                    ?.getNItems(),
            ).toBe(2);
        });
    });
});

describe("render - ColumnViewColumn (6)", () => {
    describe("header menu updates", () => {
        const buildColumnMenu = (columnViewRef: RefObject<Gtk.ColumnView | null>) => (items: string[]) => (
            <ScrollWrapper>
                <GtkColumnView ref={columnViewRef}>
                    <DefaultColumn
                        id="name"
                        title="Name"
                        headerMenu={flatMenu(
                            "name",
                            items.map((label) => ({ id: label, label })),
                        )}
                    />
                </GtkColumnView>
            </ScrollWrapper>
        );

        it("dynamically adds menu items", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            const { rerender } = await renderChildren(["A"], buildColumnMenu(columnViewRef));
            expect(
                getColumn(columnViewRef.current as Gtk.ColumnView, 0)
                    .getHeaderMenu()
                    ?.getNItems(),
            ).toBe(1);

            await rerender(["A", "B", "C"]);
            expect(
                getColumn(columnViewRef.current as Gtk.ColumnView, 0)
                    .getHeaderMenu()
                    ?.getNItems(),
            ).toBe(3);
        });

        it("dynamically removes menu items", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            const { rerender } = await renderChildren(["A", "B", "C"], buildColumnMenu(columnViewRef));
            expect(
                getColumn(columnViewRef.current as Gtk.ColumnView, 0)
                    .getHeaderMenu()
                    ?.getNItems(),
            ).toBe(3);

            await rerender(["A"]);
            expect(
                getColumn(columnViewRef.current as Gtk.ColumnView, 0)
                    .getHeaderMenu()
                    ?.getNItems(),
            ).toBe(1);
        });
    });
});

describe("render - ColumnViewColumn (7)", () => {
    describe("header menu removal", () => {
        it("clears the header menu when the slot is removed", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ showMenu }: { showMenu: boolean }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            <DefaultColumn
                                id="name"
                                title="Name"
                                headerMenu={
                                    showMenu ? flatMenu("name", [{ id: "action", label: "Action" }]) : undefined
                                }
                            />
                        </GtkColumnView>
                    </ScrollWrapper>
                );
            }

            await render(<App showMenu={true} />);
            expect(getColumn(columnViewRef.current as Gtk.ColumnView, 0).getHeaderMenu()).not.toBeNull();

            await render(<App showMenu={false} />);
            expect(getColumn(columnViewRef.current as Gtk.ColumnView, 0).getHeaderMenu()).toBeNull();
        });
    });
});

describe("render - ColumnViewColumn (8)", () => {
    describe("independent header menus", () => {
        it("supports multiple columns with independent menus", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(
                columnViewRef,
                <>
                    <DefaultColumn
                        id="name"
                        title="Name"
                        headerMenu={flatMenu("name", [{ id: "sort", label: "Sort" }])}
                    />
                    <DefaultColumn
                        id="age"
                        title="Age"
                        headerMenu={flatMenu("age", [
                            { id: "sort", label: "Sort" },
                            { id: "filter", label: "Filter" },
                        ])}
                    />
                    <DefaultColumn id="email" title="Email" />
                </>,
            );

            expectHeaderMenuItemCounts(columnViewRef, [1, 2, null]);
        });
    });
});

describe("render - ColumnViewColumn (9)", () => {
    describe("header menu column removal", () => {
        it("removes a column and its header menu together", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ showColumn }: { showColumn: boolean }) {
                return (
                    <ScrollWrapper>
                        <GtkColumnView ref={columnViewRef}>
                            {showColumn && (
                                <DefaultColumn
                                    id="name"
                                    title="Name"
                                    headerMenu={flatMenu("name", [{ id: "action", label: "Action" }])}
                                />
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

const sortShowcasePeople = (sortColumn: ShowcaseSortColumn, sortOrder: Gtk.SortType): ShowcasePerson[] => {
    if (!sortColumn) return showcasePeople;
    return [...showcasePeople].sort((a, b) => {
        const av = a[sortColumn];
        const bv = b[sortColumn];
        const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
        return sortOrder === Gtk.SortType.ASCENDING ? cmp : -cmp;
    });
};

const buildSortActions = (
    column: ShowcaseSortColumn,
    onSort: (column: string | null, order: Gtk.SortType) => void,
): ActionSpec[] => [
    { id: "sort-asc", label: "Sort Ascending", onActivate: () => onSort(column, Gtk.SortType.ASCENDING) },
    { id: "sort-desc", label: "Sort Descending", onActivate: () => onSort(column, Gtk.SortType.DESCENDING) },
    { id: "sort-clear", label: "Clear Sort", onActivate: () => onSort(null, Gtk.SortType.ASCENDING) },
];

const ShowcaseActionGroups = ({ sortActions }: { sortActions: (column: ShowcaseSortColumn) => ActionSpec[] }) => (
    <>
        {actionGroup("name", sortActions("name"))}
        {actionGroup("role", [...sortActions("role"), { id: "hide", label: "Hide Column" }])}
        {actionGroup("salary", [...sortActions("salary"), { id: "hide", label: "Hide Column" }])}
    </>
);

const ShowcaseColumns = ({ sortActions }: { sortActions: (column: ShowcaseSortColumn) => ActionSpec[] }) => (
    <>
        <GtkColumnViewColumn
            id="name"
            title="Name"
            expand
            sortable
            renderCell={(item: ShowcasePerson) => <GtkLabel label={item.name} />}
            headerMenu={sectionedMenu("name", [sortActions("name")])}
        />
        <GtkColumnViewColumn
            id="role"
            title="Role"
            fixedWidth={100}
            sortable
            renderCell={(item: ShowcasePerson) => <GtkLabel label={item.role} />}
            headerMenu={sectionedMenu("role", [sortActions("role"), [{ id: "hide", label: "Hide Column" }]])}
        />
        <GtkColumnViewColumn
            id="salary"
            title="Salary"
            fixedWidth={100}
            sortable
            renderCell={(item: ShowcasePerson) => <GtkLabel label={item.salary.toString()} />}
            headerMenu={sectionedMenu("salary", [sortActions("salary"), [{ id: "hide", label: "Hide Column" }]])}
        />
    </>
);

function ShowcaseSortableApp({ columnViewRef }: { columnViewRef: RefObject<Gtk.ColumnView | null> }) {
    const [sortColumn, setSortColumn] = useState<ShowcaseSortColumn>(null);
    const [sortOrder, setSortOrder] = useState<Gtk.SortType>(Gtk.SortType.ASCENDING);

    const handleSortChange = useCallback((column: string | null, order: Gtk.SortType) => {
        setSortColumn(column as ShowcaseSortColumn);
        setSortOrder(order);
    }, []);

    const sortedPeople = useMemo(() => sortShowcasePeople(sortColumn, sortOrder), [sortColumn, sortOrder]);
    const sortActions = useCallback(
        (column: ShowcaseSortColumn) => buildSortActions(column, handleSortChange),
        [handleSortChange],
    );

    return (
        <ScrollWrapper actionGroups={<ShowcaseActionGroups sortActions={sortActions} />}>
            <GtkColumnView
                ref={columnViewRef}
                estimatedRowHeight={48}
                sortColumn={sortColumn}
                sortOrder={sortOrder}
                onSortChanged={handleSortChange}
                items={sortedPeople.map((person) => ({ id: person.name, value: person }))}
            >
                <ShowcaseColumns sortActions={sortActions} />
            </GtkColumnView>
        </ScrollWrapper>
    );
}

describe("render - ColumnViewColumn (10) > header menu showcase", () => {
    it("renders sortable columns with independent header menus", async () => {
        const columnViewRef = createRef<Gtk.ColumnView>();

        await render(<ShowcaseSortableApp columnViewRef={columnViewRef} />);

        expectHeaderMenuItemCounts(columnViewRef, [1, 2, 2]);
    });
});

describe("render - ColumnViewColumn (11)", () => {
    describe("header menu actions", () => {
        it("activates per-column header actions through an action group", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            const nameSortAsc = vi.fn();
            const nameSortDesc = vi.fn();
            const roleSortAsc = vi.fn();
            const roleHide = vi.fn();

            await renderNameAndRoleColumns(
                columnViewRef,
                flatMenu("name", [
                    { id: "sort-asc", label: "Sort Ascending" },
                    { id: "sort-desc", label: "Sort Descending" },
                ]),
                ROLE_SORT_HIDE_MENU,
                <>
                    {actionGroup("name", [
                        { id: "sort-asc", label: "Sort Ascending", onActivate: nameSortAsc },
                        { id: "sort-desc", label: "Sort Descending", onActivate: nameSortDesc },
                    ])}
                    {actionGroup("role", [
                        { id: "sort-asc", label: "Sort Ascending", onActivate: roleSortAsc },
                        { id: "hide", label: "Hide Column", onActivate: roleHide },
                    ])}
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
        });
    });
});

describe("render - ColumnViewColumn (12)", () => {
    describe("header menu model", () => {
        it("exposes header menu items with prefixed action names", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderNameAndRoleColumns(
                columnViewRef,
                sectionedMenu("name", [
                    [
                        { id: "sort-asc", label: "Sort Ascending" },
                        { id: "sort-desc", label: "Sort Descending" },
                        { id: "sort-clear", label: "Clear Sort" },
                    ],
                ]),
                ROLE_SORT_HIDE_MENU,
            );

            const columnView = columnViewRef.current as Gtk.ColumnView;
            const nameMenu = getColumn(columnView, 0).getHeaderMenu();
            expect(nameMenu?.getNItems()).toBe(1);

            const nameSection = nameMenu?.getItemLink(0, "section");
            expect(nameSection?.getNItems()).toBe(3);
            expect(nameSection?.getItemAttributeValue(0, "label", null)?.getString()[0]).toBe("Sort Ascending");
            expect(nameSection?.getItemAttributeValue(0, "action", null)?.getString()[0]).toBe("name.sort-asc");
            expect(nameSection?.getItemAttributeValue(2, "action", null)?.getString()[0]).toBe("name.sort-clear");

            const roleMenu = getColumn(columnView, 1).getHeaderMenu();
            expect(roleMenu?.getNItems()).toBe(2);

            const roleSection2 = roleMenu?.getItemLink(1, "section");
            expect(roleSection2?.getItemAttributeValue(0, "action", null)?.getString()[0]).toBe("role.hide");
        });
    });
});
