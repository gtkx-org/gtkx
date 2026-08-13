import type { ColumnViewColumn } from "@gtkx/components";
import type { GMenuProps } from "@gtkx/jsx/gio";
import type { ReactElement, ReactNode, RefObject } from "react";
import { ColumnView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GMenu, GSimpleAction, GSimpleActionGroup } from "@gtkx/jsx/gio";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { getWidgetText, render, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type MenuItem = NonNullable<GMenuProps["items"]>[number];
type ActionSpec = { id: string; label: string; onActivate?: () => void };
type ColumnsDraw = { columns: ColumnViewColumn[]; actionGroups?: ReactNode };

const ROLE_MENU_SECTIONS: ActionSpec[][] = [
    [{ id: "sort-asc", label: "Sort Ascending" }],
    [{ id: "hide", label: "Hide Column" }],
];

const NAME_ACTIONS: ActionSpec[] = [{ id: "sort", label: "Sort" }];
const ROLE_ACTIONS: ActionSpec[] = [{ id: "hide", label: "Hide" }];

const noop = (): void => undefined;
const cellRenderer = (): ReactNode => <GtkLabel>Cell</GtkLabel>;

const column = (id: string, title: string, extra?: Partial<ColumnViewColumn>): ColumnViewColumn => ({
    id,
    title,
    expand: true,
    renderCell: cellRenderer,
    ...extra,
});

const menuEntries = (prefix: string, specs: ActionSpec[]): MenuItem[] =>
    specs.map((spec) => ({ label: spec.label, action: `${prefix}.${spec.id}` }));

const flatMenu = (prefix: string, specs: ActionSpec[]): ReactElement => <GMenu items={menuEntries(prefix, specs)} />;

const sectionedMenu = (prefix: string, groups: ActionSpec[][]): ReactElement => (
    <GMenu items={groups.map((specs) => ({ section: menuEntries(prefix, specs) }))} />
);

const actionGroup = (prefix: string, specs: ActionSpec[]): ReactNode => (
    <GSimpleActionGroup
        prefix={prefix}
        actions={specs.map((spec) => (
            <GSimpleAction key={spec.id} name={spec.id} onActivate={spec.onActivate ?? noop} />
        ))}
    />
);

const drawColumns = (ref: RefObject<Gtk.ColumnView | null>, draw: ColumnsDraw): ReactNode => (
    <ScrollWrapper actionGroups={draw.actionGroups}>
        <ColumnView ref={ref} items={[{ id: "1", value: { name: "First" } }]} columns={draw.columns} />
    </ScrollWrapper>
);

const columnAt = (ref: RefObject<Gtk.ColumnView | null>, index: number): Gtk.ColumnViewColumn => {
    const found = ref.current?.getColumns().getItem(index);

    if (!(found instanceof Gtk.ColumnViewColumn)) {
        throw new TypeError("Expected a column view column");
    }

    return found;
};

const menuItemCounts = (ref: RefObject<Gtk.ColumnView | null>, count: number): (number | null)[] =>
    Array.from({ length: count }, (_, index) => columnAt(ref, index).getHeaderMenu()?.getNItems() ?? null);

const columnTitles = (ref: RefObject<Gtk.ColumnView | null>): string[] => {
    const view = ref.current;

    if (view === null) {
        throw new TypeError("Expected the column view to render");
    }

    return within(view)
        .getAllByRole(Gtk.AccessibleRole.COLUMN_HEADER)
        .map((header) => {
            const [label] = within(header).getAllByRole(Gtk.AccessibleRole.LABEL);

            return label ? (getWidgetText(label) ?? "") : "";
        });
};

const titledColumns = (titles: string[]): ColumnViewColumn[] => titles.map((title) => column(title, title));

describe("ColumnView columns", () => {
    it("creates a column per definition, applies its properties and forwards its ref", async () => {
        const ref = createRef<Gtk.ColumnView>();
        const columnRef = createRef<Gtk.ColumnViewColumn>();

        await render(
            drawColumns(ref, {
                columns: [
                    column("name", "Name", { ref: columnRef, resizable: true, fixedWidth: 120 }),
                    column("age", "Age"),
                ],
            }),
        );

        expect(ref.current?.getColumns()).toHaveObjectProperty("nItems", 2);
        expect(columnAt(ref, 0)).toHaveObjectProperty("title", "Name");
        expect(columnAt(ref, 0)).toHaveObjectProperty("expand", true);
        expect(columnAt(ref, 0)).toHaveObjectProperty("resizable", true);
        expect(columnAt(ref, 0)).toHaveObjectProperty("fixedWidth", 120);
        expect(columnRef.current).toBe(columnAt(ref, 0));
    });

    it("keeps the headers in order as columns are inserted, removed and reordered", async () => {
        const ref = createRef<Gtk.ColumnView>();
        const { rerender } = await render(drawColumns(ref, { columns: titledColumns(["A", "C"]) }));
        expect(columnTitles(ref)).toEqual(["A", "C"]);
        await rerender(drawColumns(ref, { columns: titledColumns(["A", "B", "C"]) }));
        expect(columnTitles(ref)).toEqual(["A", "B", "C"]);
        await rerender(drawColumns(ref, { columns: titledColumns(["C", "A", "B"]) }));
        expect(columnTitles(ref)).toEqual(["C", "A", "B"]);
        await rerender(drawColumns(ref, { columns: titledColumns(["C", "B"]) }));
        expect(columnTitles(ref)).toEqual(["C", "B"]);
    });

    it("updates a column title when the prop changes", async () => {
        const ref = createRef<Gtk.ColumnView>();
        const { rerender } = await render(drawColumns(ref, { columns: [column("col", "Initial")] }));
        expect(columnAt(ref, 0)).toHaveObjectProperty("title", "Initial");
        await rerender(drawColumns(ref, { columns: [column("col", "Updated")] }));
        expect(columnAt(ref, 0)).toHaveObjectProperty("title", "Updated");
    });
});

describe("ColumnView header menu installation", () => {
    it("installs a menu per column that declares one and leaves the others without", async () => {
        const ref = createRef<Gtk.ColumnView>();

        const columns = [
            column("name", "Name", { headerMenu: flatMenu("name", NAME_ACTIONS) }),
            column("role", "Role", { headerMenu: sectionedMenu("role", ROLE_MENU_SECTIONS) }),
            column("email", "Email"),
        ];

        await render(drawColumns(ref, { columns }));
        expect(menuItemCounts(ref, 3)).toEqual([1, 2, null]);
    });

    it("follows the menu items as they change and clears the menu when the slot goes", async () => {
        const ref = createRef<Gtk.ColumnView>();

        const withItems = (labels: string[]): ColumnsDraw => {
            const specs = labels.map((label) => ({ id: label, label }));

            return { columns: [column("name", "Name", { headerMenu: flatMenu("name", specs) })] };
        };

        const { rerender } = await render(drawColumns(ref, withItems(["A"])));
        expect(menuItemCounts(ref, 1)).toEqual([1]);
        await rerender(drawColumns(ref, withItems(["A", "B", "C"])));
        expect(menuItemCounts(ref, 1)).toEqual([3]);
        await rerender(drawColumns(ref, { columns: [column("name", "Name")] }));
        expect(menuItemCounts(ref, 1)).toEqual([null]);
    });
});

describe("ColumnView header menu actions", () => {
    it("activates each column's header actions through its action group", async () => {
        const ref = createRef<Gtk.ColumnView>();
        const nameSort = vi.fn();
        const roleHide = vi.fn();
        const [firstNameAction = { id: "sort", label: "Sort" }] = NAME_ACTIONS;
        const [firstRoleAction = { id: "hide", label: "Hide" }] = ROLE_ACTIONS;

        const columns = [
            column("name", "Name", { headerMenu: flatMenu("name", NAME_ACTIONS) }),
            column("role", "Role", { headerMenu: flatMenu("role", ROLE_ACTIONS) }),
        ];

        const actionGroups = (
            <>
                {actionGroup("name", [{ ...firstNameAction, onActivate: nameSort }])}
                {actionGroup("role", [{ ...firstRoleAction, onActivate: roleHide }])}
            </>
        );

        await render(drawColumns(ref, { columns, actionGroups }));
        const view = ref.current;

        if (view === null) {
            throw new TypeError("Expected the column view to render");
        }

        expect(view.activateAction("name.sort", null)).toBe(true);
        expect(view.activateAction("role.hide", null)).toBe(true);
        expect(nameSort).toHaveBeenCalledTimes(1);
        expect(roleHide).toHaveBeenCalledTimes(1);
    });
});
