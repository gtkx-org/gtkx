import type { ListItem, ListItemRenderer } from "@gtkx/components";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
    asCollectionView,
    expectFiltering,
    expectLargeReordering,
    expectReordering,
} from "./helpers/collection-view.js";
import { expanderCount } from "./helpers/expanders.js";
import {
    firstSecondItems,
    firstSecondThirdItems,
    namedItems,
    renderGridView,
    renderListView,
    renderStatefulListView,
} from "./helpers/list-fixtures.js";
import { labelTexts } from "./helpers/row-texts.js";
import { getSelectionModel } from "./helpers/selection-model.js";

type NamedItem = ListItem<{ name: string }>;

const LARGE_FLAT_COUNT = 200_000;
const hundredItems: ListItem<{ name: string }>[] = Array.from({ length: 100 }, (_, index) => ({
    id: `item-${String(index)}`,
    value: { name: `Item ${String(index)}` },
}));

const listViewView = async (items: string[]) => asCollectionView(await renderListView(items), labelTexts);
const gridViewView = async (items: string[]) => asCollectionView(await renderGridView(items), labelTexts);
const renderCount: ListItemRenderer<{ count: number }> = ({ item }) => <GtkLabel>{String(item.count)}</GtkLabel>;

const StatefulItem = ({ name }: { name: string }): ReactNode => {
    const [initial] = useState(name);

    return <GtkLabel>{`${name}:${initial}`}</GtkLabel>;
};
const renderStatefulItem: ListItemRenderer<{ name: string }> = ({ item }) => <StatefulItem name={item.name} />;

const countedItems = (offset: number): ListItem<{ count: number }>[] => [
    { id: "1", value: { count: offset } },
    { id: "2", value: { count: offset * 2 } },
];

describe("ListView", () => {
    it("draws a row per item and follows insertions, removals and value changes", async () => {
        const { ref, rerender } = await renderListView(
            namedItems([
                ["1", "First"],
                ["3", "Third"],
            ]),
        );

        expect(screen.getByRole(Gtk.AccessibleRole.LIST)).toBe(ref.current);
        expect(labelTexts(ref.current)).toEqual(["First", "Third"]);

        await rerender(
            namedItems([
                ["1", "First"],
                ["2", "Second"],
                ["3", "Third"],
            ]),
        );

        expect(labelTexts(ref.current)).toEqual(["First", "Second", "Third"]);

        await rerender(
            namedItems([
                ["1", "First"],
                ["3", "Renamed"],
            ]),
        );

        expect(labelTexts(ref.current)).toEqual(["First", "Renamed"]);
        expect(screen.queryAllByText("Second")).toHaveLength(0);
    });

    it("reorders the rows to match the items array", async () => {
        await expectReordering(listViewView);
    });

    it("keeps a filtered list and a large list in the order they are given", async () => {
        await expectFiltering(listViewView);
        await expectLargeReordering(listViewView);
    });
});

describe("ListView rendering", () => {
    it("hands the renderer the item and redraws when the renderer changes", async () => {
        let renderedItemName: string | undefined;
        const renderItem: ListItemRenderer<{ name: string }> = ({ item }) => {
            renderedItemName = item.name;

            return <GtkLabel>{item.name}</GtkLabel>;
        };
        const items = namedItems([["1", "Test"]]);
        const { ref, rerender } = await renderListView(items, { renderItem });
        expect(renderedItemName).toBe("Test");
        await rerender(items, { renderItem: ({ item }) => <GtkLabel>{`Second: ${item.name}`}</GtkLabel> });
        expect(labelTexts(ref.current)).toEqual(["Second: Test"]);
    });

    it("keeps the row order through repeated value updates", async () => {
        const { ref, rerender } = await renderListView(countedItems(0), { renderItem: renderCount });

        for (let round = 1; round <= 10; round++) {
            await rerender(countedItems(round), { renderItem: renderCount });
            expect(labelTexts(ref.current)).toEqual([String(round), String(round * 2)]);
        }
    });

    it("does not carry component state between reordered items", async () => {
        const { ref, rerender } = await renderListView(["A", "B"], { renderItem: renderStatefulItem });
        expect(labelTexts(ref.current)).toEqual(["A:A", "B:B"]);
        await rerender(["B", "A"], { renderItem: renderStatefulItem });
        expect(labelTexts(ref.current)).toEqual(["B:B", "A:A"]);
    });

    it("displays updates and appended items in a large flat source", async () => {
        const items: NamedItem[] = Array.from({ length: LARGE_FLAT_COUNT }, (_, index) => ({
            id: String(index),
            value: { name: `Item ${String(index)}` },
        }));
        const options = { isFlat: true, estimatedItemHeight: 40, maxContentHeight: 200 };
        const { ref, rerender } = await renderListView(items, options);
        expect(screen.getByText("Item 0")).toBeVisible();

        const appendedItems = [...items, { id: "appended", value: { name: "Appended" } }];
        await rerender(appendedItems);
        expect(screen.getByText("Item 0")).toBeVisible();

        await rerender(appendedItems.with(0, { id: "replacement", value: { name: "Replacement" } }));
        expect(screen.getByText("Replacement")).toBeVisible();
        expect(screen.queryByText("Item 0")).toBeNull();

        await act(() => {
            ref.current.scrollTo(LARGE_FLAT_COUNT, Gtk.ListScrollFlags.NONE, null);
        });
        await waitFor(() => {
            expect(screen.getByText("Appended")).toBeVisible();
        });
    });
});

describe("ListView selection", () => {
    it("selects the row named by selectedIds and reports what it selected", async () => {
        let selectedIds: string[] = [];
        const onSelectionChanged = (ids: string[]): void => {
            selectedIds = ids;
        };
        const { ref, rerender } = await renderListView(firstSecondItems, { selected: ["2"], onSelectionChanged });
        const model = getSelectionModel(ref);
        expect(selectedIds).toEqual(["2"]);

        await waitFor(() => {
            expect(model.isSelected(1)).toBe(true);
        });

        await rerender(firstSecondItems, { selected: [] });
        expect(labelTexts(ref.current)).toEqual(["First", "Second"]);
    });
});

describe("ListView selection through the widget", () => {
    it("moves the selection to the row the user clicks, label included", async () => {
        await renderStatefulListView(firstSecondItems);
        const [, second] = await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);

        if (second === undefined) {
            throw new TypeError("Expected a second row");
        }

        await userEvent.click(second);

        await waitFor(() => {
            expect(screen.queryAllByText("selected:2")).toHaveLength(1);
        });

        await userEvent.click(screen.getByText("First"));

        await waitFor(() => {
            expect(screen.queryAllByText("selected:1")).toHaveLength(1);
        });
    });

    it("re-asserts selectedIds after the widget selects another row on its own", async () => {
        const { ref, rerender } = await renderListView(firstSecondItems, { selected: ["2"] });
        const model = getSelectionModel(ref);

        await waitFor(() => {
            expect(model.isSelected(1)).toBe(true);
        });

        await act(() => {
            model.selectItem(0, true);
        });

        await rerender(firstSecondItems, { selected: ["2"] });

        await waitFor(() => {
            expect(model.isSelected(0)).toBe(false);
            expect(model.isSelected(1)).toBe(true);
        });
    });
});

describe("ListView selection while scrolled", () => {
    it("keeps the scroll position when a row is selected after scrolling", async () => {
        const { ref } = await renderStatefulListView(hundredItems, { maxContentHeight: 200 });
        const scroller = ref.current.getAncestor(Gtk.ScrolledWindow.prototype.__type__);

        if (!(scroller instanceof Gtk.ScrolledWindow)) {
            throw new TypeError("Expected the list to sit inside a scrolled window");
        }

        const adjustment = scroller.getVadjustment();
        ref.current.scrollTo(99, Gtk.ListScrollFlags.FOCUS, null);

        await waitFor(() => {
            adjustment.setValue(adjustment.getUpper() - adjustment.getPageSize());
            expect(adjustment.getValue()).toBeGreaterThan(0);
        });

        const before = adjustment.getValue();
        await userEvent.selectOptions(ref.current, 99);
        expect(adjustment.getValue()).toBe(before);
    });
});

describe("ListView selection modes", () => {
    it("reports every row the user selects when the mode allows several", async () => {
        const { ref } = await renderStatefulListView(firstSecondItems, {
            selectionMode: Gtk.SelectionMode.MULTIPLE,
        });

        await userEvent.selectOptions(ref.current, [0, 1]);

        await waitFor(() => {
            expect(screen.queryAllByText("selected:1,2")).toHaveLength(1);
        });
    });

    it("keeps the selection when selectionMode and selectedIds change together", async () => {
        const { ref, rerender } = await renderListView(firstSecondThirdItems, {
            selectionMode: Gtk.SelectionMode.SINGLE,
            selected: ["1"],
        });

        await rerender(firstSecondThirdItems, {
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            selected: ["1", "3"],
        });

        await waitFor(() => {
            const selection = getSelectionModel(ref).getSelection();
            expect(selection.getSize()).toBe(2n);
            expect(selection.contains(0)).toBe(true);
            expect(selection.contains(2)).toBe(true);
        });
    });

    it("selects a row that only comes into view after scrolling", async () => {
        const { ref } = await renderStatefulListView(hundredItems);
        ref.current.scrollTo(99, Gtk.ListScrollFlags.NONE, null);
        await userEvent.selectOptions(ref.current, 99);

        await waitFor(() => {
            expect(screen.queryAllByText("selected:item-99")).toHaveLength(1);
        });
    });
});

describe("ListView selection across many rows", () => {
    it("selects every row when selectedIds names the whole list", async () => {
        let selectedIds: string[] = [];
        const onSelectionChanged = (ids: string[]): void => {
            selectedIds = ids;
        };
        const everyId = hundredItems.map((item) => item.id);

        const { ref } = await renderListView(hundredItems, {
            selectionMode: Gtk.SelectionMode.MULTIPLE,
            selected: everyId,
            onSelectionChanged,
        });

        await waitFor(() => {
            const selection = getSelectionModel(ref).getSelection();
            expect(selection.getSize()).toBe(BigInt(hundredItems.length));
            expect(selection.getMinimum()).toBe(0);
            expect(selection.getMaximum()).toBe(hundredItems.length - 1);
        });

        expect(selectedIds).toEqual(everyId);
    });

    it("narrows a whole-list selection to scattered rows and then to none", async () => {
        let selectedIds: string[] = [];
        const onSelectionChanged = (ids: string[]): void => {
            selectedIds = ids;
        };
        const options = { selectionMode: Gtk.SelectionMode.MULTIPLE, onSelectionChanged };
        const everyId = hundredItems.map((item) => item.id);
        const scattered = ["item-0", "item-50", "item-99"];
        const { ref, rerender } = await renderListView(hundredItems, { ...options, selected: everyId });
        await rerender(hundredItems, { ...options, selected: scattered });

        await waitFor(() => {
            const selection = getSelectionModel(ref).getSelection();
            expect(selection.getSize()).toBe(3n);
            expect(selection.contains(0)).toBe(true);
            expect(selection.contains(50)).toBe(true);
            expect(selection.contains(99)).toBe(true);
        });

        expect(selectedIds).toEqual(scattered);
        await rerender(hundredItems, { ...options, selected: [] });

        await waitFor(() => {
            expect(getSelectionModel(ref).getSelection().getSize()).toBe(0n);
        });

        expect(selectedIds).toEqual([]);
    });
});

describe("GridView", () => {
    it("draws a cell per item and reorders them to match the items array", async () => {
        await expectReordering(gridViewView);
    });

    it("renders the grid with single-click activation", async () => {
        const { ref } = await renderGridView(["First"], { singleClickActivate: true });
        expect(screen.getByRole(Gtk.AccessibleRole.GRID)).toBe(ref.current);
        expect(ref.current).toHaveObjectProperty("singleClickActivate", true);
        expect(screen.getByText("First")).toBeVisible();
    });

    it("ignores nested children and draws no expander", async () => {
        const { ref } = await renderGridView([
            { id: "a", value: { name: "A" }, children: [{ id: "a0", value: { name: "A0" } }] },
            { id: "b", value: { name: "B" } },
        ]);
        expect(labelTexts(ref.current)).toEqual(["A", "B"]);
        expect(expanderCount()).toBe(0);
    });
});
