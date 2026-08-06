import type { ListItem, ListItemRenderer } from "@gtkx/components";
import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { screen, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import {
    type CollectionView,
    COUNTER_BASELINE_TEXTS,
    COUNTER_SINGLE_UPDATE_TEXTS,
    counterBaselineRows,
    counterSingleUpdateRows,
    expectAllVisibleOnce,
    expectFilteredViewReorder,
    expectInitialOrder,
    expectLargeDatasetReorder,
    expectRapidReorder,
    expectRenderItemFunctionUpdate,
    expectRenderItemReceivesData,
    expectReorder,
    expectSingleItemValueUpdate,
    namedRows,
    RAPID_REORDER_ORDERS,
    renderCounterCell,
} from "./helpers/list-collection-render.js";
import { renderGridView, renderListView } from "./helpers/list-fixtures.js";
import { expectNoBoxBetween } from "./helpers/widget-chain.js";

type NamedItem = ListItem<{ name: string }>;
type Splice = [number, number, number];

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

const collectLabelTexts = (container: Gtk.Widget): string[] =>
    within(container)
        .getAllByRole(Gtk.AccessibleRole.LABEL)
        .map((widget) => (widget instanceof Gtk.Label ? widget.getLabel() : ""))
        .filter((text) => text.length > 0);

const asCollectionView = (fixture: {
    ref: RefObject<Gtk.Widget>;
    rerender: CollectionView["rerender"];
}): CollectionView => ({
    texts: () => collectLabelTexts(fixture.ref.current),
    rerender: fixture.rerender,
});

const listViewView = async (items: Parameters<typeof renderListView>[0]): Promise<CollectionView> =>
    asCollectionView(await renderListView(items));

const gridViewView = async (items: Parameters<typeof renderGridView>[0]): Promise<CollectionView> =>
    asCollectionView(await renderGridView(items));

const topLevelTexts = (items: string[] | NamedItem[]): string[] =>
    items.map((item) => (typeof item === "string" ? item : item.value.name));

const expectSpliceEmissions = async (
    initial: string[] | NamedItem[],
    next: string[] | NamedItem[],
    expected: Splice[],
): Promise<void> => {
    const { ref, rerender } = await renderListView<{ name: string }>(initial);
    expect(collectLabelTexts(ref.current)).toEqual(topLevelTexts(initial));
    const splices = spliceLog(ref);
    await rerender(next);
    expect(collectLabelTexts(ref.current)).toEqual(topLevelTexts(next));
    expect(splices).toEqual(expected);
};

const createItems = (a: number, b: number, c: number) => [
    { id: "1", value: { count: a } },
    { id: "2", value: { count: b } },
    { id: "3", value: { count: c } },
];

const renderCount: ListItemRenderer<{ count: number }> = ({ item }) => <GtkLabel>{String(item.count)}</GtkLabel>;

describe("render - ListView (1)", () => {
    describe("GtkListView", () => {
        it("creates ListView widget", async () => {
            await renderListView([{ id: "1", value: { name: "First" } }]);
            expect(screen.getByRole(Gtk.AccessibleRole.LIST)).toBeTruthy();
        });
    });

    describe("ListItem (1)", () => {
        it("adds item to list model", async () => {
            await renderListView(
                namedRows([
                    ["1", "First"],
                    ["2", "Second"],
                ]),
            );

            expectAllVisibleOnce("First", "Second");
        });

        it("inserts item before existing item", async () => {
            const { rerender } = await renderListView(
                namedRows([
                    ["1", "First"],
                    ["3", "Third"],
                ]),
            );

            expectAllVisibleOnce("First", "Third");

            await rerender(
                namedRows([
                    ["1", "First"],
                    ["2", "Second"],
                    ["3", "Third"],
                ]),
            );

            expectAllVisibleOnce("First", "Second", "Third");
        });
    });
});

describe("render - ListView (2)", () => {
    describe("ListItem (2)", () => {
        it("removes item from list model", async () => {
            const { rerender } = await renderListView(
                namedRows([
                    ["1", "A"],
                    ["2", "B"],
                    ["3", "C"],
                ]),
            );

            expectAllVisibleOnce("A", "B", "C");

            await rerender(
                namedRows([
                    ["1", "A"],
                    ["3", "C"],
                ]),
            );

            expect(screen.queryAllByText("A")).toHaveLength(1);
            expect(screen.queryAllByText("B")).toHaveLength(0);
            expect(screen.queryAllByText("C")).toHaveLength(1);
        });

        it("updates item value", async () => {
            await expectSingleItemValueUpdate();
        });

        it("re-renders bound items when value changes", async () => {
            await expectSingleItemValueUpdate();
        });
    });
});

describe("render - ListView (3)", () => {
    describe("renderItem", () => {
        it("receives item data in renderItem", async () => {
            await expectRenderItemReceivesData();
        });

        it("updates when renderItem function changes", async () => {
            await expectRenderItemFunctionUpdate();
        });
    });

    describe("GtkGridView", () => {
        it("creates GridView widget", async () => {
            await renderGridView([{ id: "1", value: { name: "First" } }]);
            expect(screen.getByRole(Gtk.AccessibleRole.GRID)).toBeTruthy();
        });

        it("sets singleClickActivate property correctly", async () => {
            const { ref } = await renderGridView([{ id: "1", value: { name: "First" } }], {
                singleClickActivate: true,
            });

            expect(ref.current).toHaveObjectProperty("singleClickActivate", true);
        });
    });
});

describe("render - ListView (4)", () => {
    describe("item reordering (1)", () => {
        it("respects React declaration order on initial render", async () => {
            await expectInitialOrder(listViewView, ["C", "A", "B"]);
        });

        it("handles complete reversal of items", async () => {
            await expectReorder(listViewView, ["A", "B", "C", "D", "E"], ["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            await expectReorder(listViewView, ["A", "B", "C", "D"], ["B", "D", "A", "C"]);
        });

        it("handles removing and adding while reordering", async () => {
            await expectReorder(listViewView, ["A", "B", "C"], ["D", "B", "E"]);
        });

        it("handles insert at beginning", async () => {
            await expectReorder(listViewView, ["B", "C"], ["A", "B", "C"]);
        });

        it("handles single item to multiple items", async () => {
            await expectReorder(listViewView, ["A"], ["X", "A", "Y"]);
        });
    });
});

describe("render - ListView (5)", () => {
    describe("item reordering (2)", () => {
        it("handles rapid reordering", async () => {
            await expectRapidReorder(listViewView, RAPID_REORDER_ORDERS);
        });

        it("handles large dataset reordering (200 items)", async () => {
            await expectLargeDatasetReorder(listViewView);
        });

        it("handles move first item to last position", async () => {
            await expectReorder(listViewView, ["A", "B", "C", "D"], ["B", "C", "D", "A"]);
        });

        it("handles move last item to first position", async () => {
            await expectReorder(listViewView, ["A", "B", "C", "D"], ["D", "A", "B", "C"]);
        });

        it("handles swap of two items", async () => {
            await expectReorder(listViewView, ["A", "B", "C", "D"], ["A", "C", "B", "D"]);
        });
    });
});

describe("render - ListView (6)", () => {
    describe("item reordering (3)", () => {
        it("handles filtered view reordering", async () => {
            await expectFilteredViewReorder(listViewView);
        });

        it("preserves order when only item values change", async () => {
            const { ref, rerender } = await renderListView(
                namedRows([
                    ["1", "Alice"],
                    ["2", "Bob"],
                    ["3", "Charlie"],
                ]),
            );

            expect(collectLabelTexts(ref.current)).toEqual(["Alice", "Bob", "Charlie"]);

            await rerender(
                namedRows([
                    ["1", "Alice Updated"],
                    ["2", "Bob Updated"],
                    ["3", "Charlie Updated"],
                ]),
            );

            expect(collectLabelTexts(ref.current)).toEqual(["Alice Updated", "Bob Updated", "Charlie Updated"]);
        });
    });
});

describe("render - ListView (7)", () => {
    describe("item reordering (4)", () => {
        it("preserves order when updating a single item value", async () => {
            const { ref, rerender } = await renderListView(counterBaselineRows(), { renderItem: renderCounterCell });
            expect(collectLabelTexts(ref.current)).toEqual(COUNTER_BASELINE_TEXTS);
            await rerender(counterSingleUpdateRows(), { renderItem: renderCounterCell });
            expect(collectLabelTexts(ref.current)).toEqual(COUNTER_SINGLE_UPDATE_TEXTS);
        });

        it("preserves order with frequent value updates", async () => {
            const { ref, rerender } = await renderListView(createItems(0, 0, 0), { renderItem: renderCount });
            expect(collectLabelTexts(ref.current)).toEqual(["0", "0", "0"]);

            for (let i = 1; i <= 10; i++) {
                await rerender(createItems(i, i * 2, i * 3), { renderItem: renderCount });
                expect(collectLabelTexts(ref.current)).toEqual([String(i), String(i * 2), String(i * 3)]);
            }
        });
    });
});

describe("render - ListView (8)", () => {
    describe("GridView item reordering", () => {
        it("handles complete reversal of items", async () => {
            await expectReorder(gridViewView, ["A", "B", "C", "D", "E"], ["E", "D", "C", "B", "A"]);
        });

        it("handles interleaved reordering", async () => {
            await expectReorder(gridViewView, ["A", "B", "C", "D"], ["B", "D", "A", "C"]);
        });

        it("handles rapid reordering", async () => {
            await expectRapidReorder(gridViewView, RAPID_REORDER_ORDERS);
        });
    });
});

describe("render - ListView (9)", () => {
    describe("direct cell rendering", () => {
        it("renders the item label as the list cell's direct content with no wrapper container", async () => {
            const { ref } = await renderListView(["First"]);
            expectNoBoxBetween(screen.getByText("First"), ref.current);
        });

        it("renders the item label as the grid cell's direct content with no wrapper container", async () => {
            const { ref } = await renderGridView(["First"]);
            expectNoBoxBetween(screen.getByText("First"), ref.current);
        });
    });
});

describe("render - ListView (10)", () => {
    describe("model emission policy", () => {
        it("emits no items-changed for a pure reorder", async () => {
            await expectSpliceEmissions(["A", "B", "C", "D"], ["D", "A", "B", "C"], []);
        });

        it("emits one tail splice when a row is inserted in the middle", async () => {
            await expectSpliceEmissions(["A", "B", "C"], ["A", "X", "B", "C"], [[3, 0, 1]]);
        });

        it("emits one tail splice when rows are removed", async () => {
            await expectSpliceEmissions(["A", "B", "C", "D"], ["A", "C"], [[2, 2, 0]]);
        });

        it("emits one replacement when a row's expandability flips", async () => {
            await expectSpliceEmissions([branchA, leafB], [branchA, branchB], [[1, 1, 1]]);
        });

        it("emits one replacement covering a run of adjacent expandability flips", async () => {
            await expectSpliceEmissions(
                [branchA, leafB, leafC, leafD],
                [branchA, branchB, branchC, leafD],
                [[1, 2, 2]],
            );
        });

        it("emits one replacement per run when the flips are not adjacent", async () => {
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
});
