import type { RenderItemArgs } from "@gtkx/components";
import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { screen } from "@gtkx/testing";
import { expect, vi } from "vitest";
import { filterableIds } from "./filterable-items.js";
import { type FixtureInput, type NamedValue, renderListView } from "./list-fixtures.js";

type CollectionView = {
    texts: () => string[];
    rerender: (items: FixtureInput<NamedValue>) => Promise<void>;
};

type RenderCollectionView = (items: FixtureInput<NamedValue>) => Promise<CollectionView>;
type NamedRow = { id: string; value: NamedValue };
type CounterRow = { id: string; value: { name: string; count: number } };

const RAPID_REORDER_ORDERS: string[][] = [
    ["A", "B", "C"],
    ["C", "A", "B"],
    ["B", "C", "A"],
    ["A", "B", "C"],
];

const COUNTER_BASELINE_TEXTS: string[] = ["Counter A: 0", "Counter B: 0", "Counter C: 0"];
const COUNTER_SINGLE_UPDATE_TEXTS: string[] = ["Counter A: 0", "Counter B: 5", "Counter C: 0"];

const expectAllVisibleOnce = (...texts: string[]): void => {
    for (const text of texts) {
        expect(screen.queryAllByText(text)).toHaveLength(1);
    }
};

const namedLabelRenderItem = () =>
    vi.fn(({ item }: RenderItemArgs<{ name: string }>) => <GtkLabel>{item.name}</GtkLabel>);

const renderTestItemWithSpy = async (): Promise<ReturnType<typeof namedLabelRenderItem>> => {
    const renderItem = namedLabelRenderItem();
    await renderListView([{ id: "1", value: { name: "Test Item" } }], { renderItem });

    return renderItem;
};

const expectRenderItemFunctionUpdate = async (): Promise<void> => {
    const { rerender } = await renderListView([{ id: "1", value: { name: "Test" } }], {
        renderItem: ({ item }) => <GtkLabel>{`First: ${item.name}`}</GtkLabel>,
    });

    await rerender([{ id: "1", value: { name: "Test" } }], {
        renderItem: ({ item }) => <GtkLabel>{`Second: ${item.name}`}</GtkLabel>,
    });

    expect(screen.queryAllByText("Second: Test")).toHaveLength(1);
};

const namedRows = (entries: [string, string][]): NamedRow[] =>
    entries.map(([id, name]) => ({ id, value: { name } }));

const counterRows = (entries: [string, string, number][]): CounterRow[] =>
    entries.map(([id, name, count]) => ({ id, value: { name, count } }));

const renderCounterCell = ({ item }: RenderItemArgs<{ name: string; count: number }>): ReactNode => (
    <GtkLabel>{`${item.name}: ${String(item.count)}`}</GtkLabel>
);

const counterBaselineRows = (): CounterRow[] =>
    counterRows([
        ["1", "Counter A", 0],
        ["2", "Counter B", 0],
        ["3", "Counter C", 0],
    ]);

const counterSingleUpdateRows = (): CounterRow[] =>
    counterRows([
        ["1", "Counter A", 0],
        ["2", "Counter B", 5],
        ["3", "Counter C", 0],
    ]);

const expectInitialOrder = async (renderView: RenderCollectionView, order: string[]): Promise<void> => {
    const view = await renderView(order);
    expect(view.texts()).toEqual(order);
};

const expectReorder = async (
    renderView: RenderCollectionView,
    initial: string[],
    reordered: string[],
): Promise<void> => {
    const view = await renderView(initial);
    expect(view.texts()).toEqual(initial);
    await view.rerender(reordered);
    expect(view.texts()).toEqual(reordered);
};

const expectRapidReorder = async (renderView: RenderCollectionView, orders: string[][]): Promise<void> => {
    const [first, ...rest] = orders;
    const view = await renderView(first ?? []);

    for (const order of rest) {
        await view.rerender(order);
    }

    expect(view.texts()).toEqual(orders.at(-1));
};

const expectLargeDatasetReorder = async (renderView: RenderCollectionView): Promise<void> => {
    const initialItems = Array.from({ length: 200 }, (_, i) => String(i + 1));
    const reversedItems = initialItems.toReversed();
    const view = await renderView(initialItems);
    const visibleBefore = view.texts();
    expect(visibleBefore.length).toBeGreaterThan(0);
    expect(visibleBefore[0]).toBe("1");
    await view.rerender(reversedItems);
    const visibleAfter = view.texts();
    expect(visibleAfter.length).toBeGreaterThan(0);
    expect(visibleAfter[0]).toBe("200");
};

const expectFilteredViewReorder = async (renderView: RenderCollectionView): Promise<void> => {
    const view = await renderView(filterableIds("all"));
    expect(view.texts()).toEqual(["1", "2", "3", "4", "5"]);
    await view.rerender(filterableIds("active"));
    expect(view.texts()).toEqual(["1", "3", "5"]);
    await view.rerender(filterableIds("inactive"));
    expect(view.texts()).toEqual(["2", "4"]);
    await view.rerender(filterableIds("all"));
    expect(view.texts()).toEqual(["1", "2", "3", "4", "5"]);
};

export {
    expectAllVisibleOnce,
    namedLabelRenderItem,
    renderTestItemWithSpy,
    expectRenderItemFunctionUpdate,
    namedRows,
    renderCounterCell,
    RAPID_REORDER_ORDERS,
    counterBaselineRows,
    counterSingleUpdateRows,
    COUNTER_BASELINE_TEXTS,
    COUNTER_SINGLE_UPDATE_TEXTS,
    expectInitialOrder,
    expectReorder,
    expectRapidReorder,
    expectLargeDatasetReorder,
    expectFilteredViewReorder,
    type CollectionView,
    type RenderCollectionView,
    type NamedRow,
    type CounterRow,
};
