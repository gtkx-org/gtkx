import type { ListItem, ListItemRenderArgs, ListRowProps, ListRowPropsResolver } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ColumnView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type Person = {
    name: string;
};

type RowFixture = {
    view: () => Gtk.ColumnView;
    rerender: (items: ListItem<Person>[], rowProps?: ListRowPropsResolver<Person>) => Promise<void>;
};

const flatItems: ListItem<Person>[] = [
    { id: "1", value: { name: "First" } },
    { id: "2", value: { name: "Second" } },
];

const treeItems: ListItem<Person>[] = [
    {
        id: "1",
        value: { name: "Parent" },
        children: [{ id: "1.1", value: { name: "Child" } }],
    },
];

const columns = [
    {
        id: "name",
        title: "Name",
        renderCell: ({ item }: ListItemRenderArgs<Person>) => <GtkLabel>{item.name}</GtkLabel>,
    },
];

const hasLabel = (row: Gtk.Widget): boolean => Gtk.testAccessibleHasProperty(row, Gtk.AccessibleProperty.LABEL);

const hasDescription = (row: Gtk.Widget): boolean =>
    Gtk.testAccessibleHasProperty(row, Gtk.AccessibleProperty.DESCRIPTION);

const allRows = (view: Gtk.ColumnView): Gtk.Widget[] => within(view).getAllByRole(Gtk.AccessibleRole.ROW);
const dataRows = (view: Gtk.ColumnView): Gtk.Widget[] => allRows(view).slice(1);

const probeRows = (rows: Gtk.Widget[], isMatch: (row: Gtk.Widget) => boolean): boolean[] =>
    rows.map((row) => isMatch(row));

const rowLabelFlags = (view: Gtk.ColumnView): boolean[] => probeRows(allRows(view), hasLabel);
const rowDescriptionFlags = (view: Gtk.ColumnView): boolean[] => probeRows(allRows(view), hasDescription);
const rowFocusables = (view: Gtk.ColumnView): boolean[] => probeRows(dataRows(view), (row) => row.getFocusable());

const rowActivatables = (view: Gtk.ColumnView): boolean[] =>
    probeRows(dataRows(view), (row) => row.getCssClasses().includes("activatable"));

const drawRowView = (
    ref: RefObject<Gtk.ColumnView | null>,
    items: ListItem<Person>[],
    rowProps: ListRowPropsResolver<Person> | undefined,
    expandedIds: string[],
): ReactNode => (
    <ScrollWrapper minContentHeight={300}>
        <ColumnView<Person>
            ref={ref}
            items={items}
            columns={columns}
            rowProps={rowProps}
            expandedIds={expandedIds}
        />
    </ScrollWrapper>
);

const renderRowView = async (
    items: ListItem<Person>[],
    rowProps?: ListRowPropsResolver<Person>,
    expandedIds: string[] = [],
): Promise<RowFixture> => {
    const ref = createRef<Gtk.ColumnView>();
    const { rerender } = await render(drawRowView(ref, items, rowProps, expandedIds));

    const view = (): Gtk.ColumnView => {
        if (ref.current === null) {
            throw new Error("Expected the ColumnView to render");
        }

        return ref.current;
    };

    return {
        view,
        rerender: async (nextItems, nextGetRowProps) => {
            await rerender(drawRowView(ref, nextItems, nextGetRowProps, expandedIds));
        },
    };
};

const labelRowProps = ({ item }: ListItemRenderArgs<Person>): ListRowProps => ({
    accessibleLabel: `Row: ${item.name}`,
    accessibleDescription: `Details for ${item.name}`,
});

const focusFirstOnly = ({ item }: ListItemRenderArgs<Person>): ListRowProps => ({
    isFocusable: item.name === "First",
});

const inertRowProps = (): ListRowProps => ({ isFocusable: false, isActivatable: false });
const defaultRowProps = (): ListRowProps => ({});

const labelFirstOnly = ({ item }: ListItemRenderArgs<Person>): ListRowProps =>
    item.name === "First" ? { accessibleLabel: "Row: First" } : {};

describe("ColumnView rowProps", () => {
    it("leaves every row unlabeled when rowProps is omitted", async () => {
        const { view } = await renderRowView(flatItems);
        expect(rowLabelFlags(view())).toEqual([false, false, false]);
        expect(rowDescriptionFlags(view())).toEqual([false, false, false]);
    });

    it("labels the data rows and leaves the header row alone", async () => {
        const { view } = await renderRowView(flatItems, labelRowProps);
        expect(rowLabelFlags(view())).toEqual([false, true, true]);
        expect(rowDescriptionFlags(view())).toEqual([false, true, true]);
    });

    it("keeps rendering the cells of a labeled row", async () => {
        const { view } = await renderRowView(flatItems, labelRowProps);
        expect(dataRows(view())).toHaveLength(2);
        expect(screen.queryAllByText("First")).toHaveLength(1);
        expect(screen.queryAllByText("Second")).toHaveLength(1);
    });
});

describe("ColumnView rowProps omissions", () => {
    it("leaves the accessibility strings unset when only flags are returned", async () => {
        const { view } = await renderRowView(flatItems, inertRowProps);
        expect(rowLabelFlags(view())).toEqual([false, false, false]);
        expect(rowDescriptionFlags(view())).toEqual([false, false, false]);
    });

    it("leaves the rows the resolver did not name unset", async () => {
        const { view } = await renderRowView(flatItems, labelFirstOnly);
        expect(rowLabelFlags(view())).toEqual([false, true, false]);
        expect(rowDescriptionFlags(view())).toEqual([false, false, false]);
    });

    it("unsets a label that stops being returned", async () => {
        const { view, rerender } = await renderRowView(flatItems, labelRowProps);
        expect(rowLabelFlags(view())).toEqual([false, true, true]);
        await rerender(flatItems, defaultRowProps);
        expect(rowLabelFlags(view())).toEqual([false, false, false]);
        expect(rowDescriptionFlags(view())).toEqual([false, false, false]);
    });
});

describe("ColumnView rowProps arguments", () => {
    it("receives the same args the cell renderer receives", async () => {
        const rowProps = vi.fn<ListRowPropsResolver<Person>>(() => ({}));
        await renderRowView(flatItems, rowProps);
        expect(rowProps).toHaveBeenCalledWith({ item: { name: "First" }, index: 0 });
        expect(rowProps).toHaveBeenCalledWith({ item: { name: "Second" }, index: 1 });
    });

    it("reports depth and expansion for tree rows", async () => {
        const rowProps = vi.fn<ListRowPropsResolver<Person>>(() => ({}));
        await renderRowView(treeItems, rowProps, ["1"]);
        expect(rowProps).toHaveBeenCalledWith({ item: { name: "Parent" }, index: 0, depth: 0, isExpanded: true });
        expect(rowProps).toHaveBeenCalledWith({ item: { name: "Child" }, index: 1, depth: 1 });
    });
});

describe("ColumnView rowProps flags", () => {
    it("applies isFocusable and isActivatable per row", async () => {
        const { view } = await renderRowView(flatItems, ({ item }) => ({
            isFocusable: item.name === "First",
            isActivatable: item.name === "Second",
        }));

        expect(rowFocusables(view())).toEqual([true, false]);
        expect(rowActivatables(view())).toEqual([false, true]);
    });

    it("restores the row defaults when a field stops being returned", async () => {
        const { view, rerender } = await renderRowView(flatItems, inertRowProps);
        expect(rowFocusables(view())).toEqual([false, false]);
        expect(rowActivatables(view())).toEqual([false, false]);
        await rerender(flatItems, defaultRowProps);
        expect(rowFocusables(view())).toEqual([true, true]);
        expect(rowActivatables(view())).toEqual([true, true]);
    });
});

describe("ColumnView rowProps staleness", () => {
    it("re-resolves row props when an item's value changes without a rebind", async () => {
        const { view, rerender } = await renderRowView(flatItems, focusFirstOnly);
        expect(rowFocusables(view())).toEqual([true, false]);

        await rerender(
            [
                { id: "1", value: { name: "Renamed" } },
                { id: "2", value: { name: "First" } },
            ],
            focusFirstOnly,
        );

        expect(screen.queryAllByText("Renamed")).toHaveLength(1);
        expect(rowFocusables(view())).toEqual([false, true]);
    });

    it("re-resolves row props when the resolver itself changes", async () => {
        const { view, rerender } = await renderRowView(flatItems, inertRowProps);
        await rerender(flatItems, ({ item }) => ({ isFocusable: item.name === "Second" }));
        expect(rowFocusables(view())).toEqual([false, true]);
    });

    it("drops the row of a removed item without leaving its props behind", async () => {
        const { view, rerender } = await renderRowView(flatItems, focusFirstOnly);
        await rerender([{ id: "2", value: { name: "Second" } }], focusFirstOnly);
        expect(rowFocusables(view())).toEqual([false]);
        expect(screen.queryAllByText("First")).toHaveLength(0);
    });
});
