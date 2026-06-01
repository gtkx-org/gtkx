import { GtkLabel } from "@gtkx/react";
import { screen } from "@gtkx/testing";
import type { ReactNode } from "react";
import { expect } from "vitest";
import { filterableIds } from "./filterable-items.js";
import type { FixtureInput, NamedValue } from "./list-fixtures.js";

/**
 * Asserts that each of the given texts is rendered exactly once on screen.
 *
 * @param texts - Texts expected to each appear a single time.
 */
export const expectAllVisibleOnce = (...texts: string[]): void => {
    for (const text of texts) {
        expect(screen.queryAllByText(text)).toHaveLength(1);
    }
};

/**
 * A rendered list, grid, or column collection whose currently realized item
 * texts can be read back and whose items can be swapped with a new list.
 */
export interface CollectionView {
    /** Reads the item texts the collection currently renders, in order. */
    texts: () => string[];
    /** Re-renders the collection with a new list of items. */
    rerender: (items: FixtureInput<NamedValue>) => Promise<void>;
}

/**
 * Renders a list, grid, or column collection from a list of items and returns a
 * {@link CollectionView} for reading back and re-rendering its contents.
 */
export type RenderCollectionView = (items: FixtureInput<NamedValue>) => Promise<CollectionView>;

/** A `{ id, value: { name } }` row built from an `[id, name]` entry. */
export type NamedRow = { id: string; value: NamedValue };

/**
 * Builds list rows shaped as `{ id, value: { name } }` from `[id, name]` pairs.
 *
 * @param entries - `[id, name]` pairs, one per row.
 */
export const namedRows = (entries: [string, string][]): NamedRow[] =>
    entries.map(([id, name]) => ({ id, value: { name } }));

/** A `{ id, value: { name, count } }` row carrying a numeric counter. */
export type CounterRow = { id: string; value: { name: string; count: number } };

/**
 * Builds counter rows shaped as `{ id, value: { name, count } }` from
 * `[id, name, count]` triples.
 *
 * @param entries - `[id, name, count]` triples, one per row.
 */
const counterRows = (entries: [string, string, number][]): CounterRow[] =>
    entries.map(([id, name, count]) => ({ id, value: { name, count } }));

/** Renders a counter row's `name: count` label. */
export const renderCounterCell = (item: { name: string; count: number }): ReactNode => (
    <GtkLabel label={`${item.name}: ${item.count}`} />
);

/** Order sequence shared by the rapid-reorder scenario across collections. */
export const RAPID_REORDER_ORDERS: string[][] = [
    ["A", "B", "C"],
    ["C", "A", "B"],
    ["B", "C", "A"],
    ["A", "B", "C"],
];

/** Three counters all at zero, used as the baseline for value-update scenarios. */
export const counterBaselineRows = (): CounterRow[] =>
    counterRows([
        ["1", "Counter A", 0],
        ["2", "Counter B", 0],
        ["3", "Counter C", 0],
    ]);

/** The baseline counters with only "Counter B" advanced to five. */
export const counterSingleUpdateRows = (): CounterRow[] =>
    counterRows([
        ["1", "Counter A", 0],
        ["2", "Counter B", 5],
        ["3", "Counter C", 0],
    ]);

/** Texts rendered for {@link counterBaselineRows}, in order. */
export const COUNTER_BASELINE_TEXTS: string[] = ["Counter A: 0", "Counter B: 0", "Counter C: 0"];

/** Texts rendered for {@link counterSingleUpdateRows}, in order. */
export const COUNTER_SINGLE_UPDATE_TEXTS: string[] = ["Counter A: 0", "Counter B: 5", "Counter C: 0"];

/**
 * Renders a collection in declaration order and asserts that its realized item
 * texts match `order`, without re-rendering.
 *
 * @param renderView - Renders the collection under test.
 * @param order - Item ids expected in render order.
 */
export const expectInitialOrder = async (renderView: RenderCollectionView, order: string[]): Promise<void> => {
    const view = await renderView(order);
    expect(view.texts()).toEqual(order);
};

/**
 * Renders a collection with `initial` items, asserts the realized texts match
 * it, re-renders with `reordered` items, and asserts the realized texts now
 * match the new order.
 *
 * @param renderView - Renders the collection under test.
 * @param initial - Item ids rendered first.
 * @param reordered - Item ids rendered after the re-render.
 */
export const expectReorder = async (
    renderView: RenderCollectionView,
    initial: string[],
    reordered: string[],
): Promise<void> => {
    const view = await renderView(initial);
    expect(view.texts()).toEqual(initial);

    await view.rerender(reordered);
    expect(view.texts()).toEqual(reordered);
};

/**
 * Renders a collection with the first order, re-renders it through every
 * subsequent order, then asserts the realized texts match the final order.
 *
 * @param renderView - Renders the collection under test.
 * @param orders - Successive item-id orders; the first is the initial render.
 */
export const expectRapidReorder = async (renderView: RenderCollectionView, orders: string[][]): Promise<void> => {
    const [first, ...rest] = orders;
    const view = await renderView(first ?? []);
    for (const order of rest) {
        await view.rerender(order);
    }
    expect(view.texts()).toEqual(orders[orders.length - 1]);
};

/**
 * Renders a 200-item collection, asserts the first realized item is `"1"`,
 * re-renders it reversed, and asserts the first realized item is `"200"`,
 * confirming a large virtualized dataset reorders correctly.
 *
 * @param renderView - Renders the collection under test.
 */
export const expectLargeDatasetReorder = async (renderView: RenderCollectionView): Promise<void> => {
    const initialItems = Array.from({ length: 200 }, (_, i) => String(i + 1));
    const reversedItems = [...initialItems].reverse();

    const view = await renderView(initialItems);
    const visibleBefore = view.texts();
    expect(visibleBefore.length).toBeGreaterThan(0);
    expect(visibleBefore[0]).toBe("1");

    await view.rerender(reversedItems);
    const visibleAfter = view.texts();
    expect(visibleAfter.length).toBeGreaterThan(0);
    expect(visibleAfter[0]).toBe("200");
};

/**
 * Renders a collection of every filterable id, then re-renders it through the
 * active, inactive, and full filter results, asserting the realized texts at
 * each step.
 *
 * @param renderView - Renders the collection under test.
 */
export const expectFilteredViewReorder = async (renderView: RenderCollectionView): Promise<void> => {
    const view = await renderView(filterableIds("all"));
    expect(view.texts()).toEqual(["1", "2", "3", "4", "5"]);

    await view.rerender(filterableIds("active"));
    expect(view.texts()).toEqual(["1", "3", "5"]);

    await view.rerender(filterableIds("inactive"));
    expect(view.texts()).toEqual(["2", "4"]);

    await view.rerender(filterableIds("all"));
    expect(view.texts()).toEqual(["1", "2", "3", "4", "5"]);
};
