import type { ListItem } from "@gtkx/components";
import { readHandleRoundTrips } from "@gtkx/runtime/internal";
import process from "node:process";
import { describe, expect, it } from "vitest";
import type { ListViewFixture } from "./helpers/list-fixtures.js";
import type { TreeName } from "./helpers/tree-fixtures.js";
import { renderListView } from "./helpers/list-fixtures.js";

const SMALL_CHILD_COUNT = 500;
const LARGE_CHILD_COUNT = 5000;
const ROUNDS = 10;
const WARMUP_ROUNDS = 2;
const VIEWPORT_HEIGHT = 500;
const ROUND_TRIP_BUDGET = 1000;
const GROWTH_BUDGET = 100;

const treeItems = (childCount: number): ListItem<TreeName>[] => {
    const children: ListItem<TreeName>[] = Array.from({ length: childCount }, (_, index) => {
        const id = `c-${String(index)}`;

        return { id, value: { name: id }, shouldHideExpander: true };
    });

    return [{ id: "p", value: { name: "p" }, children }];
};

const report = (childCount: number, roundTrips: number): void => {
    process.stderr.write(
        `${String(childCount)} children: ${roundTrips.toFixed(1)} handle round trips per expand and collapse\n`,
    );
};

async function cycle(fixture: ListViewFixture<TreeName>, items: ListItem<TreeName>[], rounds: number): Promise<void> {
    for (let round = 0; round < rounds; round += 1) {
        await fixture.rerender(items, { expandedIds: ["p"] });
        await fixture.rerender(items, { expandedIds: [] });
    }
}

async function roundTripsPerCycle(childCount: number): Promise<number> {
    const items = treeItems(childCount);

    const fixture = await renderListView<TreeName>(items, {
        expandedIds: [],
        minContentHeight: VIEWPORT_HEIGHT,
    });

    await cycle(fixture, items, WARMUP_ROUNDS);
    const before = readHandleRoundTrips();
    await cycle(fixture, items, ROUNDS);
    const spent = (readHandleRoundTrips() - before) / ROUNDS;
    report(childCount, spent);

    return spent;
}

describe("collection handle traffic", () => {
    it("mints the same handles however many rows an expansion adds", async () => {
        const small = await roundTripsPerCycle(SMALL_CHILD_COUNT);
        const large = await roundTripsPerCycle(LARGE_CHILD_COUNT);
        expect(large).toBeLessThan(ROUND_TRIP_BUDGET);
        expect(large - small).toBeLessThan(GROWTH_BUDGET);
    });
});
