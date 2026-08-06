import type { ListItem } from "@gtkx/components";
import { describe, expect, it } from "vitest";
import type { TreeFixture, TreeName } from "./helpers/tree-fixtures.js";
import { renderListView } from "./helpers/list-fixtures.js";
import { expectTreeShape, measureRowCost } from "./helpers/tree-fixtures.js";

const CHILD_COUNT = 4;
const EXPANDED_IDS = ["p-0", "p-1", "p-2"];
const FEWER_PARENT_IDS = ["p-0", "p-1"];
const COLLAPSED_IDS: string[] = [];
const SELECTED_IDS = ["p-1-c-1"];
const EXPANDED_ROW_COUNT = EXPANDED_IDS.length * (CHILD_COUNT + 1);
const FEWER_ROW_COUNT = FEWER_PARENT_IDS.length * (CHILD_COUNT + 1);

const childItems = (parent: string): ListItem<TreeName>[] =>
    Array.from({ length: CHILD_COUNT }, (_, index) => {
        const id = `${parent}-c-${String(index)}`;

        return { id, value: { name: id } };
    });

const treeItems = (parents: string[]): ListItem<TreeName>[] =>
    parents.map((parent) => ({ id: parent, value: { name: parent }, children: childItems(parent) }));

const renderExpandedTree = async (items: ListItem<TreeName>[]): Promise<TreeFixture> => {
    const fixture = await renderListView<TreeName>(items, { expandedIds: EXPANDED_IDS, selected: SELECTED_IDS });
    await expectTreeShape(fixture, { rows: EXPANDED_ROW_COUNT, selected: 1n });

    return fixture;
};

describe("render - ListView (tree) - controlled rescans", () => {
    it("touches no row when only the items array identity changes", async () => {
        const fixture = await renderExpandedTree(treeItems(EXPANDED_IDS));
        const items = treeItems(EXPANDED_IDS);
        const cost = await measureRowCost(fixture, items, { expandedIds: EXPANDED_IDS, selected: SELECTED_IDS });
        expect(cost.getRow + cost.treeGetItem).toBe(0);
        expect(cost.setExpanded).toBe(0);
        await expectTreeShape(fixture, { rows: EXPANDED_ROW_COUNT, selected: 1n });
    });

    it("touches no row when a structure change leaves every surviving row in the wanted state", async () => {
        const fixture = await renderExpandedTree(treeItems(EXPANDED_IDS));
        const items = treeItems(FEWER_PARENT_IDS);
        const cost = await measureRowCost(fixture, items, { expandedIds: EXPANDED_IDS, selected: SELECTED_IDS });
        expect(cost.getRow + cost.treeGetItem).toBe(0);
        expect(cost.setExpanded).toBe(0);
        await expectTreeShape(fixture, { rows: FEWER_ROW_COUNT, selected: 1n });
    });

    it("touches one row per collapse when expandedIds changes without the items changing", async () => {
        const items = treeItems(EXPANDED_IDS);
        const fixture = await renderExpandedTree(items);
        const cost = await measureRowCost(fixture, items, { expandedIds: COLLAPSED_IDS, selected: SELECTED_IDS });
        expect(cost.getRow).toBe(EXPANDED_IDS.length);
        expect(cost.treeGetItem).toBe(0);
        expect(cost.setExpanded).toBe(EXPANDED_IDS.length);
        await expectTreeShape(fixture, { rows: EXPANDED_IDS.length });
    });
});
