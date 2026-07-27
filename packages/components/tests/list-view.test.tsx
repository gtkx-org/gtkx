import type { RenderItemArgs } from "@gtkx/components";
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
    expectReorder,
    namedRows,
    RAPID_REORDER_ORDERS,
    renderCounterCell,
    renderTestItemWithSpy,
} from "./helpers/list-collection-render.js";
import { renderGridView, renderListView } from "./helpers/list-fixtures.js";
import { expectNoBoxBetween } from "./helpers/widget-chain.js";

const collectLabelTexts = (container: Gtk.Widget): string[] =>
    within(container)
        .getAllByRole(Gtk.AccessibleRole.LABEL)
        .map((widget) => (widget instanceof Gtk.Label ? widget.getLabel() : ""))
        .filter((text) => text.length > 0);

const listViewView = async (items: Parameters<typeof renderListView>[0]): Promise<CollectionView> => {
    const { ref, rerender } = await renderListView(items);

    return { texts: () => collectLabelTexts(ref.current), rerender };
};

const gridViewView = async (items: Parameters<typeof renderGridView>[0]): Promise<CollectionView> => {
    const { ref, rerender } = await renderGridView(items);

    return { texts: () => collectLabelTexts(ref.current), rerender };
};

const expectSingleItemValueUpdate = async (): Promise<void> => {
    const { rerender } = await renderListView([{ id: "1", value: { name: "Initial" } }]);
    expect(screen.queryAllByText("Initial")).toHaveLength(1);
    await rerender([{ id: "1", value: { name: "Updated" } }]);
    expect(screen.queryAllByText("Updated")).toHaveLength(1);
    expect(screen.queryAllByText("Initial")).toHaveLength(0);
};

const createItems = (a: number, b: number, c: number) => [
    { id: "1", value: { count: a } },
    { id: "2", value: { count: b } },
    { id: "3", value: { count: c } },
];

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
            const renderItem = await renderTestItemWithSpy();
            expect(renderItem).toHaveBeenCalledWith(expect.objectContaining({ item: { name: "Test Item" } }));
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

            expect(ref.current.getSingleClickActivate()).toBe(true);
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
            type Item = { count: number };
            const renderItem = ({ item }: RenderItemArgs<Item>) => <GtkLabel>{String(item.count)}</GtkLabel>;
            const { ref, rerender } = await renderListView(createItems(0, 0, 0), { renderItem });
            expect(collectLabelTexts(ref.current)).toEqual(["0", "0", "0"]);

            for (let i = 1; i <= 10; i++) {
                await rerender(createItems(i, i * 2, i * 3), { renderItem });
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
