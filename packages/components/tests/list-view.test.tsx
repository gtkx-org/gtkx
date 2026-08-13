import type { ListItem, ListItemRenderer } from "@gtkx/components";
import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { act, screen, userEvent, waitFor } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    asCollectionView,
    expectFiltering,
    expectLargeReordering,
    expectReordering,
} from "./helpers/collection-view.js";
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
import { expectNoBoxBetween } from "./helpers/widget-chain.js";

type NamedItem = ListItem<{ name: string }>;
type Splice = [number, number, number];

const hundredItems: ListItem<{ name: string }>[] = Array.from({ length: 100 }, (_, index) => ({
    id: `item-${String(index)}`,
    value: { name: `Item ${String(index)}` },
}));

const branchA: NamedItem = { id: "a", value: { name: "A" }, children: [{ id: "a0", value: { name: "A0" } }] };
const leafB: NamedItem = { id: "b", value: { name: "B" } };
const branchB: NamedItem = { id: "b", value: { name: "B" }, children: [{ id: "b0", value: { name: "B0" } }] };
const leafC: NamedItem = { id: "c", value: { name: "C" } };
const branchC: NamedItem = { id: "c", value: { name: "C" }, children: [{ id: "c0", value: { name: "C0" } }] };
const leafD: NamedItem = { id: "d", value: { name: "D" } };
const branchD: NamedItem = { id: "d", value: { name: "D" }, children: [{ id: "d0", value: { name: "D0" } }] };

const collectionModelFor = (ref: RefObject<Gtk.ListView>): Gtk.FlattenListModel => {
    const selection = ref.current.getModel();

    if (!(selection instanceof Gtk.SingleSelection)) {
        throw new TypeError("Expected the list view to hold a single selection model");
    }

    const model = selection.getModel();

    if (!(model instanceof Gtk.FlattenListModel)) {
        throw new TypeError("Expected the selection to wrap the collection model");
    }

    return model;
};

const spliceLog = (ref: RefObject<Gtk.ListView>): Splice[] => {
    const splices: Splice[] = [];

    collectionModelFor(ref).connect("items-changed", (position, removed, added) => {
        splices.push([position, removed, added]);
    });

    return splices;
};

const topLevelTexts = (items: string[] | NamedItem[]): string[] =>
    items.map((item) => (typeof item === "string" ? item : item.value.name));

const expectSpliceEmissions = async (
    initial: string[] | NamedItem[],
    next: string[] | NamedItem[],
    expected: Splice[],
): Promise<void> => {
    const { ref, rerender } = await renderListView<{ name: string }>(initial);
    expect(labelTexts(ref.current)).toEqual(topLevelTexts(initial));
    const splices = spliceLog(ref);
    await rerender(next);
    expect(labelTexts(ref.current)).toEqual(topLevelTexts(next));
    expect(splices).toEqual(expected);
};

const listViewView = async (items: string[]) => asCollectionView(await renderListView(items), labelTexts);
const gridViewView = async (items: string[]) => asCollectionView(await renderGridView(items), labelTexts);
const renderCount: ListItemRenderer<{ count: number }> = ({ item }) => <GtkLabel>{String(item.count)}</GtkLabel>;

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
        const renderItem = vi.fn<ListItemRenderer<{ name: string }>>(({ item }) => <GtkLabel>{item.name}</GtkLabel>);
        const items = namedItems([["1", "Test"]]);
        const { ref, rerender } = await renderListView(items, { renderItem });
        expect(renderItem).toHaveBeenCalledWith(expect.objectContaining({ item: { name: "Test" } }));
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

    it("renders the row content as the cell's direct child", async () => {
        const { ref } = await renderListView(["First"]);
        expectNoBoxBetween(screen.getByText("First"), ref.current);
    });
});

describe("ListView model emissions", () => {
    it("emits nothing for a pure reorder and one tail splice per structural change", async () => {
        await expectSpliceEmissions(["A", "B", "C", "D"], ["D", "A", "B", "C"], []);
        await expectSpliceEmissions(["A", "B", "C"], ["A", "X", "B", "C"], [[3, 0, 1]]);
        await expectSpliceEmissions(["A", "B", "C", "D"], ["A", "C"], [[2, 2, 0]]);
    });

    it("coalesces a run of adjacent expandability flips into one replacement", async () => {
        await expectSpliceEmissions([branchA, leafB], [branchA, branchB], [[1, 1, 1]]);
        await expectSpliceEmissions([branchA, leafB, leafC, leafD], [branchA, branchB, branchC, leafD], [[1, 2, 2]]);

        await expectSpliceEmissions(
            [branchA, leafB, leafC, leafD],
            [branchA, branchB, leafC, branchD],
            [
                [1, 1, 1],
                [3, 1, 1],
            ],
        );
    });
});

describe("ListView selection", () => {
    it("selects the row named by selectedIds and reports what it selected", async () => {
        const onSelectionChanged = vi.fn();
        const { ref, rerender } = await renderListView(firstSecondItems, { selected: ["2"], onSelectionChanged });
        const model = getSelectionModel(ref);
        expect(onSelectionChanged).toHaveBeenCalledWith(["2"]);

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

describe("GridView", () => {
    it("draws a cell per item and reorders them to match the items array", async () => {
        await expectReordering(gridViewView);
    });

    it("renders the cell content as the cell's direct child and takes singleClickActivate", async () => {
        const { ref } = await renderGridView(["First"], { singleClickActivate: true });
        expect(screen.getByRole(Gtk.AccessibleRole.GRID)).toBe(ref.current);
        expect(ref.current).toHaveObjectProperty("singleClickActivate", true);
        expectNoBoxBetween(screen.getByText("First"), ref.current);
    });
});
