import type { RefObject } from "react";
import { expect } from "vitest";

type CollectionFixture<W> = {
    ref: RefObject<W>;
    rerender: (items: string[]) => Promise<void>;
};

type CollectionView = {
    texts: () => string[];
    rerender: (items: string[]) => Promise<void>;
};

type RenderCollectionView = (items: string[]) => Promise<CollectionView>;

const LARGE_COUNT = 200;

const REORDER_STEPS: string[][] = [
    ["C", "A", "B"],
    ["C", "B", "A"],
    ["B", "C", "A"],
    ["A", "C", "B", "D"],
    ["D", "B"],
    ["X", "D", "B", "Y"],
    ["X", "D", "B", "Y"],
];

const FILTER_STEPS: string[][] = [
    ["1", "2", "3", "4", "5"],
    ["1", "3", "5"],
    ["2", "4"],
    ["1", "2", "3", "4", "5"],
];

const asCollectionView = <W,>(fixture: CollectionFixture<W>, texts: (widget: W) => string[]): CollectionView => ({
    texts: () => texts(fixture.ref.current),
    rerender: (next) => fixture.rerender(next),
});

const largeItems = (): string[] => Array.from({ length: LARGE_COUNT }, (_, index) => String(index + 1));

const expectOrderSteps = async (renderView: RenderCollectionView, steps: string[][]): Promise<void> => {
    const [first = [], ...rest] = steps;
    const view = await renderView(first);
    expect(view.texts()).toEqual(first);

    for (const step of rest) {
        await view.rerender(step);
        expect(view.texts()).toEqual(step);
    }
};

const expectReordering = (renderView: RenderCollectionView): Promise<void> =>
    expectOrderSteps(renderView, REORDER_STEPS);

const expectFiltering = (renderView: RenderCollectionView): Promise<void> => expectOrderSteps(renderView, FILTER_STEPS);

const expectLargeReordering = async (renderView: RenderCollectionView): Promise<void> => {
    const items = largeItems();
    const view = await renderView(items);
    expect(view.texts()[0]).toBe("1");
    await view.rerender(items.toReversed());
    expect(view.texts()[0]).toBe(String(LARGE_COUNT));
};

export { asCollectionView, expectFiltering, expectLargeReordering, expectReordering };
