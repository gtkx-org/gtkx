import type { MenuItem } from "@gtkx/react";
import type { ReactElement, ReactNode, RefObject } from "react";
import { type Column, ColumnView, type RenderItemArgs } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, useCallback, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderChildren } from "./helpers/render-children.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type ColumnExtra = Omit<Column, "id" | "title" | "renderCell">;

type ActionSpec = {
    id: string;
    label: string;
    onActivate?: () => void;
};

type ShowcasePerson = { name: string; role: string; salary: number };
type ShowcaseSortColumn = "name" | "role" | "salary" | null;

const ROLE_SORT_HIDE_MENU = sectionedMenu("role", [
    [{ id: "sort-asc", label: "Sort Ascending" }],
    [{ id: "hide", label: "Hide Column" }],
]);

const showcasePeople: ShowcasePerson[] = [
    { name: "Alice", role: "Dev", salary: 95_000 },
    { name: "Bob", role: "Designer", salary: 85_000 },
    { name: "Charlie", role: "Manager", salary: 120_000 },
];

const noop = (): void => undefined;
const cellRenderer = () => <GtkLabel>Cell</GtkLabel>;

const defaultColumn = (id: string, title: string, extra?: ColumnExtra): Column => ({
    id,
    title,
    expand: true,
    renderCell: cellRenderer,
    ...extra,
});

const actionGroup = (prefix: string, specs: ActionSpec[]): ReactNode => (
    <GSimpleActionGroup
        prefix={prefix}
        actions={specs.map((spec) => (
            <GSimpleAction key={spec.id} name={spec.id} onActivate={spec.onActivate ?? noop} />
        ))}
    />
);

function menuEntries(prefix: string, specs: ActionSpec[]): MenuItem[] {
    return specs.map((spec) => ({ label: spec.label, action: `${prefix}.${spec.id}` }));
}

const flatMenu = (prefix: string, specs: ActionSpec[]): ReactElement => <GMenu items={menuEntries(prefix, specs)} />;

function sectionedMenu(prefix: string, sections: ActionSpec[][]): ReactElement {
    return <GMenu items={sections.map((specs) => ({ section: menuEntries(prefix, specs) }))} />;
}

const renderColumns = async (
    columnViewRef: RefObject<Gtk.ColumnView | null>,
    columns: Column[],
    actionGroups?: ReactNode,
): Promise<void> => {
    await render(
        <ScrollWrapper actionGroups={actionGroups}>
            <ColumnView ref={columnViewRef} columns={columns} />
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

    for (const [index, expectedCount] of expectedCounts.entries()) {
        const headerMenu = getColumn(columnView, index).getHeaderMenu();

        if (expectedCount === null) {
            expect(headerMenu).toBeNull();
        } else {
            expect(headerMenu?.getNItems()).toBe(expectedCount);
        }
    }
};

const renderNameAndRoleColumns = async (
    columnViewRef: RefObject<Gtk.ColumnView | null>,
    nameMenu: ReactElement,
    roleMenu: ReactElement,
    actionGroups?: ReactNode,
): Promise<void> => {
    await renderColumns(
        columnViewRef,
        [
            defaultColumn("name", "Name", { headerMenu: nameMenu }),
            defaultColumn("role", "Role", { headerMenu: roleMenu }),
        ],
        actionGroups,
    );
};

const buildColumnMenu = (columnViewRef: RefObject<Gtk.ColumnView | null>) => (items: string[]) => (
    <ScrollWrapper>
        <ColumnView
            ref={columnViewRef}
            columns={[
                defaultColumn("name", "Name", {
                    headerMenu: flatMenu(
                        "name",
                        items.map((label) => ({ id: label, label })),
                    ),
                }),
            ]}
        />
    </ScrollWrapper>
);

const sortShowcasePeople = (sortColumn: ShowcaseSortColumn, sortOrder: Gtk.SortType): ShowcasePerson[] => {
    if (!sortColumn) {
        return showcasePeople;
    }

    return showcasePeople.toSorted((a, b) => {
        const av = a[sortColumn];
        const bv = b[sortColumn];
        const cmp = typeof av === "number" ? av - (bv as number) : av.localeCompare(String(bv));

        return sortOrder === Gtk.SortType.ASCENDING ? cmp : -cmp;
    });
};

const buildSortActions = (
    column: ShowcaseSortColumn,
    onSort: (column: string | null, order: Gtk.SortType) => void,
): ActionSpec[] => [
    { id: "sort-asc", label: "Sort Ascending", onActivate: () => {
        onSort(column, Gtk.SortType.ASCENDING);
    } },
    { id: "sort-desc", label: "Sort Descending", onActivate: () => {
        onSort(column, Gtk.SortType.DESCENDING);
    } },
    { id: "sort-clear", label: "Clear Sort", onActivate: () => {
        onSort(null, Gtk.SortType.ASCENDING);
    } },
];

const ShowcaseActionGroups = ({ sortActions }: { sortActions: (column: ShowcaseSortColumn) => ActionSpec[] }) => (
    <>
        {actionGroup("name", sortActions("name"))}
        {actionGroup("role", [...sortActions("role"), { id: "hide", label: "Hide Column" }])}
        {actionGroup("salary", [...sortActions("salary"), { id: "hide", label: "Hide Column" }])}
    </>
);

const ShowcaseColumns = ({
    sortActions,
}: {
    sortActions: (column: ShowcaseSortColumn) => ActionSpec[];
}): Column<ShowcasePerson>[] => [
    {
        id: "name",
        title: "Name",
        expand: true,
        sortable: true,
        renderCell: ({ item }: RenderItemArgs<ShowcasePerson>) => <GtkLabel>{item.name}</GtkLabel>,
        headerMenu: sectionedMenu("name", [sortActions("name")]),
    },
    {
        id: "role",
        title: "Role",
        fixedWidth: 100,
        sortable: true,
        renderCell: ({ item }: RenderItemArgs<ShowcasePerson>) => <GtkLabel>{item.role}</GtkLabel>,
        headerMenu: sectionedMenu("role", [sortActions("role"), [{ id: "hide", label: "Hide Column" }]]),
    },
    {
        id: "salary",
        title: "Salary",
        fixedWidth: 100,
        sortable: true,
        renderCell: ({ item }: RenderItemArgs<ShowcasePerson>) => <GtkLabel>{item.salary.toString()}</GtkLabel>,
        headerMenu: sectionedMenu("salary", [sortActions("salary"), [{ id: "hide", label: "Hide Column" }]]),
    },
];

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
            <ColumnView
                ref={columnViewRef}
                estimatedItemHeight={48}
                sortColumn={sortColumn}
                sortOrder={sortOrder}
                onSortChanged={handleSortChange}
                items={sortedPeople.map((person) => ({ id: person.name, value: person }))}
                columns={ShowcaseColumns({ sortActions })}
            />
        </ScrollWrapper>
    );
}

describe("render - ColumnViewColumn (1)", () => {
    describe("ColumnViewColumn (1)", () => {
        it("adds column to ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            await renderColumns(columnViewRef, [defaultColumn("name", "Name")]);
            expect(columnViewRef.current?.getColumns()).toHaveObjectProperty("nItems", 1);
        });

        it("sets column title", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            await renderColumns(columnViewRef, [defaultColumn("col", "My Column")]);
            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column).toHaveObjectProperty("title", "My Column");
        });

        it("sets column expand property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(columnViewRef, [
                { id: "expand", title: "Expandable", expand: true, renderCell: cellRenderer },
            ]);

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column).toHaveObjectProperty("expand", true);
        });
    });
});

describe("render - ColumnViewColumn (2)", () => {
    describe("ColumnViewColumn (2)", () => {
        it("sets column property", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(columnViewRef, [
                { id: "resize", title: "Resizable", expand: true, resizable: true, renderCell: cellRenderer },
            ]);

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column).toHaveObjectProperty("resizable", true);
        });

        it("adds multiple columns", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(columnViewRef, [
                { id: "col1", title: "Column 1", expand: true, renderCell: () => <GtkLabel>Cell 1</GtkLabel> },
                { id: "col2", title: "Column 2", expand: true, renderCell: () => <GtkLabel>Cell 2</GtkLabel> },
                { id: "col3", title: "Column 3", expand: true, renderCell: () => <GtkLabel>Cell 3</GtkLabel> },
            ]);

            expect(columnViewRef.current?.getColumns()).toHaveObjectProperty("nItems", 3);
        });
    });
});

describe("render - ColumnViewColumn (3)", () => {
    describe("ColumnViewColumn (3)", () => {
        it("updates column title on prop change", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ title }: { title: string }) {
                return (
                    <ScrollWrapper>
                        <ColumnView
                            ref={columnViewRef}
                            columns={[{ id: "col", title, expand: true, renderCell: cellRenderer }]}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App title="Initial" />);
            expect(getColumn(columnViewRef.current as Gtk.ColumnView, 0)).toHaveObjectProperty("title", "Initial");
            await render(<App title="Updated" />);
            expect(getColumn(columnViewRef.current as Gtk.ColumnView, 0)).toHaveObjectProperty("title", "Updated");
        });
    });
});

describe("render - ColumnViewColumn (4)", () => {
    describe("ColumnViewColumn (4)", () => {
        it("removes column from ColumnView", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            function App({ columns }: { columns: string[] }) {
                return (
                    <ScrollWrapper>
                        <ColumnView
                            ref={columnViewRef}
                            columns={columns.map((title) => ({
                                id: title,
                                title,
                                expand: true,
                                renderCell: () => <GtkLabel>{title}</GtkLabel>,
                            }))}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App columns={["A", "B", "C"]} />);
            expect(columnViewRef.current?.getColumns()).toHaveObjectProperty("nItems", 3);
            await render(<App columns={["A", "C"]} />);
            expect(columnViewRef.current?.getColumns()).toHaveObjectProperty("nItems", 2);
        });
    });
});

describe("render - ColumnViewColumn (5)", () => {
    describe("header menu slot", () => {
        it("installs a header menu from the headerMenu slot", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(columnViewRef, [
                defaultColumn("name", "Name", {
                    headerMenu: flatMenu("name", [
                        { id: "sort-asc", label: "Sort A-Z" },
                        { id: "sort-desc", label: "Sort Z-A" },
                    ]),
                }),
            ]);

            const column = getColumn(columnViewRef.current as Gtk.ColumnView, 0);
            expect(column.getHeaderMenu()?.getNItems()).toBe(2);
        });

        it("has no header menu without the slot", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            await renderColumns(columnViewRef, [defaultColumn("name", "Name")]);
            expect(getColumn(columnViewRef.current as Gtk.ColumnView, 0).getHeaderMenu()).toBeNull();
        });

        it("supports sections in the header menu", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();

            await renderColumns(columnViewRef, [
                defaultColumn("name", "Name", {
                    headerMenu: sectionedMenu("name", [
                        [
                            { id: "sort-asc", label: "Sort A-Z" },
                            { id: "sort-desc", label: "Sort Z-A" },
                        ],
                        [{ id: "hide", label: "Hide Column" }],
                    ]),
                }),
            ]);

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
                        <ColumnView
                            ref={columnViewRef}
                            columns={[
                                defaultColumn("name", "Name", {
                                    headerMenu: showMenu
                                        ? flatMenu("name", [{ id: "action", label: "Action" }])
                                        : undefined,
                                }),
                            ]}
                        />
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

            await renderColumns(columnViewRef, [
                defaultColumn("name", "Name", {
                    headerMenu: flatMenu("name", [{ id: "sort", label: "Sort" }]),
                }),
                defaultColumn("age", "Age", {
                    headerMenu: flatMenu("age", [
                        { id: "sort", label: "Sort" },
                        { id: "filter", label: "Filter" },
                    ]),
                }),
                defaultColumn("email", "Email"),
            ]);

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
                        <ColumnView
                            ref={columnViewRef}
                            columns={[
                                ...(showColumn
                                    ? [
                                            defaultColumn("name", "Name", {
                                                headerMenu: flatMenu("name", [{ id: "action", label: "Action" }]),
                                            }),
                                        ]
                                    : []),
                                defaultColumn("other", "Other"),
                            ]}
                        />
                    </ScrollWrapper>
                );
            }

            await render(<App showColumn={true} />);
            expect(columnViewRef.current?.getColumns()).toHaveObjectProperty("nItems", 2);
            await render(<App showColumn={false} />);
            expect(columnViewRef.current?.getColumns()).toHaveObjectProperty("nItems", 1);
        });
    });
});

describe("render - ColumnViewColumn (13)", () => {
    describe("column def ref", () => {
        it("forwards a column def ref to the Gtk.ColumnViewColumn instance", async () => {
            const columnViewRef = createRef<Gtk.ColumnView>();
            const columnRef = createRef<Gtk.ColumnViewColumn>();
            await renderColumns(columnViewRef, [{ ...defaultColumn("name", "Name"), ref: columnRef }]);
            expect(columnRef.current).not.toBeNull();
            expect(columnRef.current).toBe(getColumn(columnViewRef.current as Gtk.ColumnView, 0));
        });
    });
});

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
