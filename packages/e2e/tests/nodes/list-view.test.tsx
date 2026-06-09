import { GtkLabel } from "@gtkx/jsx/gtk";
import { screen } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import {
    COUNTER_BASELINE_TEXTS,
    COUNTER_SINGLE_UPDATE_TEXTS,
    type CollectionView,
    counterBaselineRows,
    counterSingleUpdateRows,
    expectAllVisibleOnce,
    expectFilteredViewReorder,
    expectInitialOrder,
    expectLargeDatasetReorder,
    expectRapidReorder,
    expectReorder,
    namedRows,
    RAPID_REORDER_ORDERS,
    renderCounterCell,
} from "../helpers/list-collection-render.js";
import { renderGridView, renderListView } from "../helpers/list-fixtures.js";
import { getChildTexts } from "../helpers/widget-text.js";

const listViewView = async (items: Parameters<typeof renderListView>[0]): Promise<CollectionView> => {
    const { ref, rerender } = await renderListView(items);
    return { texts: () => getChildTexts(ref.current), rerender };
};

const gridViewView = async (items: Parameters<typeof renderGridView>[0]): Promise<CollectionView> => {
    const { ref, rerender } = await renderGridView(items);
    return { texts: () => getChildTexts(ref.current), rerender };
};

const expectSingleItemValueUpdate = async (): Promise<void> => {
    const { rerender } = await renderListView([{ id: "1", value: { name: "Initial" } }]);

    expect(screen.queryAllByText("Initial")).toHaveLength(1);

    await rerender([{ id: "1", value: { name: "Updated" } }]);

    expect(screen.queryAllByText("Updated")).toHaveLength(1);
    expect(screen.queryAllByText("Initial")).toHaveLength(0);
};

describe("render - ListView (1)", () => {
    describe("GtkListView", () => {
        it("creates ListView widget", async () => {
            const { ref } = await renderListView([{ id: "1", value: { name: "First" } }]);

            expect(ref.current).not.toBeNull();
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
            const renderItem = vi.fn((item: { name: string }) => <GtkLabel label={item.name} />);

            await renderListView([{ id: "1", value: { name: "Test Item" } }], { renderItem });

            expect(renderItem).toHaveBeenCalledWith({ name: "Test Item" });
        });

        it("updates when renderItem function changes", async () => {
            const { rerender } = await renderListView([{ id: "1", value: { name: "Test" } }], {
                renderItem: (item) => <GtkLabel label={`First: ${item.name}`} />,
            });

            await rerender([{ id: "1", value: { name: "Test" } }], {
                renderItem: (item) => <GtkLabel label={`Second: ${item.name}`} />,
            });

            expect(screen.queryAllByText("Second: Test")).toHaveLength(1);
        });
    });

    describe("GtkGridView", () => {
        it("creates GridView widget", async () => {
            const { ref } = await renderGridView([{ id: "1", value: { name: "First" } }]);

            expect(ref.current).not.toBeNull();
        });

        it("sets singleClickActivate property correctly", async () => {
            const { ref } = await renderGridView([{ id: "1", value: { name: "First" } }], {
                singleClickActivate: true,
            });

            expect(ref.current?.getSingleClickActivate()).toBe(true);
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
            expect(getChildTexts(ref.current)).toEqual(["Alice", "Bob", "Charlie"]);

            await rerender(
                namedRows([
                    ["1", "Alice Updated"],
                    ["2", "Bob Updated"],
                    ["3", "Charlie Updated"],
                ]),
            );
            expect(getChildTexts(ref.current)).toEqual(["Alice Updated", "Bob Updated", "Charlie Updated"]);
        });
    });
});

describe("render - ListView (7)", () => {
    describe("item reordering (4)", () => {
        it("preserves order when updating a single item value", async () => {
            const { ref, rerender } = await renderListView(counterBaselineRows(), { renderItem: renderCounterCell });
            expect(getChildTexts(ref.current)).toEqual(COUNTER_BASELINE_TEXTS);

            await rerender(counterSingleUpdateRows(), { renderItem: renderCounterCell });
            expect(getChildTexts(ref.current)).toEqual(COUNTER_SINGLE_UPDATE_TEXTS);
        });

        it("preserves order with frequent value updates", async () => {
            type Item = { count: number };
            const renderItem = (item: Item) => <GtkLabel label={String(item.count)} />;
            const itemsFor = (a: number, b: number, c: number) => [
                { id: "1", value: { count: a } },
                { id: "2", value: { count: b } },
                { id: "3", value: { count: c } },
            ];

            const { ref, rerender } = await renderListView(itemsFor(0, 0, 0), { renderItem });
            expect(getChildTexts(ref.current)).toEqual(["0", "0", "0"]);

            for (let i = 1; i <= 10; i++) {
                await rerender(itemsFor(i, i * 2, i * 3), { renderItem });
                expect(getChildTexts(ref.current)).toEqual([String(i), String(i * 2), String(i * 3)]);
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
