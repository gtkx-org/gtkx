import type { ColumnViewColumn, ExpanderDescriptions, ListItem, ListItemRenderArgs } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ColumnView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { dataRows } from "./helpers/column-rows.js";
import { expanderCount, expanderNamed } from "./helpers/expanders.js";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type Named = { name: string };
type ColumnFlags = { visible?: boolean | undefined };

const DESCRIPTIONS: ExpanderDescriptions = { expand: "Expand", collapse: "Collapse" };
const TRAILING_COLUMNS = [1, 2];
const HIDDEN: ColumnFlags = { visible: false };

const treeItems: ListItem<Named>[] = [
    {
        id: "root",
        value: { name: "Root" },
        children: [
            { id: "child-1", value: { name: "Child 1" } },
            { id: "child-2", value: { name: "Child 2" } },
        ],
    },
    { id: "solo", value: { name: "Solo" }, shouldHideExpander: true },
];

const renderName = ({ item }: ListItemRenderArgs<Named>): ReactNode => <GtkLabel>{item.name}</GtkLabel>;
const renderFiller = (): ReactNode => <GtkLabel>-</GtkLabel>;

const columnsWith = (flags: ColumnFlags[]): ColumnViewColumn<Named>[] => [
    { id: "name", title: "Name", expand: true, ...flags[0], renderCell: renderName },
    { id: "size", title: "Size", expand: true, ...flags[1], renderCell: renderFiller },
    { id: "kind", title: "Kind", expand: true, ...flags[2], renderCell: renderFiller },
];

const drawTree = (ref: RefObject<Gtk.ColumnView | null>, flags: ColumnFlags[]): ReactNode => (
    <ScrollWrapper minContentHeight={300} minContentWidth={400}>
        <ColumnView<Named>
            ref={ref}
            items={treeItems}
            expandedIds={["root"]}
            expanderDescriptions={DESCRIPTIONS}
            columns={columnsWith(flags)}
        />
    </ScrollWrapper>
);

const columnView = (ref: RefObject<Gtk.ColumnView | null>): Gtk.ColumnView => {
    if (ref.current === null) {
        throw new TypeError("Expected the column view to render");
    }

    return ref.current;
};

const hasExpander = (cell: Gtk.Widget): boolean =>
    within(cell).queryAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.TreeExpander }).length > 0;

const getExpanderColumn = (row: Gtk.Widget): number =>
    within(row)
        .getAllByRole(Gtk.AccessibleRole.GRID_CELL)
        .findIndex((cell) => hasExpander(cell));

const expanderColumns = (ref: RefObject<Gtk.ColumnView | null>): number[] =>
    dataRows(columnView(ref)).map((row) => getExpanderColumn(row));

const cellLabelLeft = (row: Gtk.Widget, index: number, view: Gtk.ColumnView): number => {
    const cells = within(row).getAllByRole(Gtk.AccessibleRole.GRID_CELL);
    const cell = cells[index];
    const [label] = cell === undefined ? [] : within(cell).getAllByRole(Gtk.AccessibleRole.LABEL);

    if (label === undefined) {
        throw new TypeError("Expected the cell to hold a label");
    }

    const [, bounds] = label.computeBounds(view);

    return bounds.origin.x;
};

const hiddenExpanderCount = (): number =>
    screen
        .queryAllByRole(Gtk.AccessibleRole.BUTTON, { as: Gtk.TreeExpander })
        .filter((expander) => expander.getHideExpander()).length;

const labelLefts = (ref: RefObject<Gtk.ColumnView | null>, index: number): number[] => {
    const view = columnView(ref);

    return dataRows(view).map((row) => cellLabelLeft(row, index, view));
};

const expectTrailingColumnsAligned = (ref: RefObject<Gtk.ColumnView | null>): void => {
    for (const index of TRAILING_COLUMNS) {
        const lefts = labelLefts(ref, index);
        expect(lefts).toHaveLength(4);
        expect(new Set(lefts).size).toBe(1);
    }
};

describe("ColumnView tree expanders", () => {
    it("draws one expander per row, in the first column, and describes that one", async () => {
        const ref = createRef<Gtk.ColumnView>();
        await render(drawTree(ref, []));
        expect(expanderColumns(ref)).toEqual([0, 0, 0, 0]);
        expect(expanderCount()).toBe(4);
        expect(expanderNamed("Root")).toHaveAccessibleDescription("Collapse");
        expect(expanderNamed("Child 1")).not.toHaveAccessibleDescription();
    });

    it("indents only the expander column, leaving the others lined up at every depth", async () => {
        const ref = createRef<Gtk.ColumnView>();
        await render(drawTree(ref, []));
        expectTrailingColumnsAligned(ref);
    });

    it("honours the item's own expander flags on the column carrying the expander", async () => {
        const ref = createRef<Gtk.ColumnView>();
        await render(drawTree(ref, []));
        expect(hiddenExpanderCount()).toBe(1);
    });

    it("moves the expander off a column hidden with visible: false", async () => {
        const ref = createRef<Gtk.ColumnView>();
        await render(drawTree(ref, [HIDDEN]));
        expect(expanderCount()).toBe(4);
        expect(expanderColumns(ref)).toEqual([0, 0, 0, 0]);
    });
});
