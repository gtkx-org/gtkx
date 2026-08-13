import type { ListItem, ListItemRenderArgs, ListRowProps, ListRowPropsResolver } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ColumnView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, within } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type Person = { name: string };
type RowTextProperty = Gtk.AccessibleProperty.DESCRIPTION | Gtk.AccessibleProperty.LABEL;

type RowFixture = {
    view: () => Gtk.ColumnView;
    rerender: (items: ListItem<Person>[], rowProps?: ListRowPropsResolver<Person>) => Promise<void>;
};

const flatItems: ListItem<Person>[] = [
    { id: "1", value: { name: "First" } },
    { id: "2", value: { name: "Second" } },
];

const treeItems: ListItem<Person>[] = [
    { id: "1", value: { name: "Parent" }, children: [{ id: "1.1", value: { name: "Child" } }] },
];

const columns = [
    {
        id: "name",
        title: "Name",
        renderCell: ({ item }: ListItemRenderArgs<Person>) => <GtkLabel>{item.name}</GtkLabel>,
    },
];

const allRows = (view: Gtk.ColumnView): Gtk.Widget[] => within(view).getAllByRole(Gtk.AccessibleRole.ROW);
const dataRows = (view: Gtk.ColumnView): Gtk.Widget[] => allRows(view).slice(1);
const rowFocusables = (view: Gtk.ColumnView): boolean[] => dataRows(view).map((row) => row.getFocusable());

const expectRowText = (row: Gtk.Widget, property: RowTextProperty, expected: string | null): void => {
    if (expected === null) {
        expect(row).not.toHaveAccessibleProperty(property);

        return;
    }

    expect(row).toHaveAccessibleProperty(property, expected);
};

const expectRowTexts = (view: Gtk.ColumnView, property: RowTextProperty, expected: (string | null)[]): void => {
    const rows = allRows(view);
    expect(rows).toHaveLength(expected.length);

    for (const [index, row] of rows.entries()) {
        expectRowText(row, property, expected[index] ?? null);
    }
};

const expectRowActivatable = (row: Gtk.Widget, isActivatable: boolean): void => {
    if (isActivatable) {
        expect(row).toHaveClass("activatable");

        return;
    }

    expect(row).not.toHaveClass("activatable");
};

const expectRowActivatables = (view: Gtk.ColumnView, expected: boolean[]): void => {
    const rows = dataRows(view);
    expect(rows).toHaveLength(expected.length);

    for (const [index, row] of rows.entries()) {
        expectRowActivatable(row, expected[index] === true);
    }
};

const drawRowView = (
    ref: RefObject<Gtk.ColumnView | null>,
    items: ListItem<Person>[],
    rowProps: ListRowPropsResolver<Person> | undefined,
    expandedIds: string[],
): ReactNode => (
    <ScrollWrapper minContentHeight={300}>
        <ColumnView<Person> ref={ref} items={items} columns={columns} rowProps={rowProps} expandedIds={expandedIds} />
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
            throw new TypeError("Expected the ColumnView to render");
        }

        return ref.current;
    };

    return {
        view,
        rerender: async (nextItems, nextRowProps) => {
            await rerender(drawRowView(ref, nextItems, nextRowProps, expandedIds));
        },
    };
};

const labelRowProps = ({ item }: ListItemRenderArgs<Person>): ListRowProps => ({
    accessibleLabel: `Row: ${item.name}`,
    accessibleDescription: `Details for ${item.name}`,
});

const labelFirstOnly = ({ item }: ListItemRenderArgs<Person>): ListRowProps =>
    item.name === "First" ? { accessibleLabel: "Row: First" } : {};

const focusFirstOnly = ({ item }: ListItemRenderArgs<Person>): ListRowProps => ({ isFocusable: item.name === "First" });
const inertRowProps = (): ListRowProps => ({ isFocusable: false, isActivatable: false });
const defaultRowProps = (): ListRowProps => ({});

describe("ColumnView rowProps", () => {
    it("labels the data rows the resolver names and leaves the header row alone", async () => {
        const bare = await renderRowView(flatItems);
        expectRowTexts(bare.view(), Gtk.AccessibleProperty.LABEL, [null, null, null]);
        const labeled = await renderRowView(flatItems, labelRowProps);
        expectRowTexts(labeled.view(), Gtk.AccessibleProperty.LABEL, [null, "Row: First", "Row: Second"]);

        expectRowTexts(labeled.view(), Gtk.AccessibleProperty.DESCRIPTION, [
            null,
            "Details for First",
            "Details for Second",
        ]);

        expect(within(labeled.view()).queryAllByText("First")).toHaveLength(1);
        const partial = await renderRowView(flatItems, labelFirstOnly);
        expectRowTexts(partial.view(), Gtk.AccessibleProperty.LABEL, [null, "Row: First", null]);
        expectRowTexts(partial.view(), Gtk.AccessibleProperty.DESCRIPTION, [null, null, null]);
    });

    it("unsets the props that stop being returned", async () => {
        const { view, rerender } = await renderRowView(flatItems, labelRowProps);
        expectRowTexts(view(), Gtk.AccessibleProperty.LABEL, [null, "Row: First", "Row: Second"]);
        await rerender(flatItems, defaultRowProps);
        expectRowTexts(view(), Gtk.AccessibleProperty.LABEL, [null, null, null]);
        expectRowTexts(view(), Gtk.AccessibleProperty.DESCRIPTION, [null, null, null]);
        expect(rowFocusables(view())).toEqual([true, true]);
        expectRowActivatables(view(), [true, true]);
    });

    it("applies isFocusable and isActivatable per row", async () => {
        const { view } = await renderRowView(flatItems, ({ item }) => ({
            isFocusable: item.name === "First",
            isActivatable: item.name === "Second",
        }));

        expect(rowFocusables(view())).toEqual([true, false]);
        expectRowActivatables(view(), [false, true]);
    });
});

describe("ColumnView rowProps arguments", () => {
    it("receives the arguments the cell renderer receives, depth and expansion included", async () => {
        const flatRowProps = vi.fn<ListRowPropsResolver<Person>>(() => ({}));
        await renderRowView(flatItems, flatRowProps);
        expect(flatRowProps).toHaveBeenCalledWith({ item: { name: "First" }, index: 0 });
        expect(flatRowProps).toHaveBeenCalledWith({ item: { name: "Second" }, index: 1 });
        const treeRowProps = vi.fn<ListRowPropsResolver<Person>>(() => ({}));
        await renderRowView(treeItems, treeRowProps, ["1"]);
        expect(treeRowProps).toHaveBeenCalledWith({ item: { name: "Parent" }, index: 0, depth: 0, isExpanded: true });
        expect(treeRowProps).toHaveBeenCalledWith({ item: { name: "Child" }, index: 1, depth: 1 });
    });
});

describe("ColumnView rowProps staleness", () => {
    it("re-resolves when the values, the resolver or the item set change", async () => {
        const { view, rerender } = await renderRowView(flatItems, focusFirstOnly);
        expect(rowFocusables(view())).toEqual([true, false]);

        await rerender(
            [
                { id: "1", value: { name: "Renamed" } },
                { id: "2", value: { name: "First" } },
            ],
            focusFirstOnly,
        );

        expect(rowFocusables(view())).toEqual([false, true]);
        await rerender(flatItems, inertRowProps);
        expect(rowFocusables(view())).toEqual([false, false]);
        await rerender([{ id: "2", value: { name: "Second" } }], focusFirstOnly);
        expect(rowFocusables(view())).toEqual([false]);
        expect(screen.queryAllByText("First")).toHaveLength(0);
    });
});
