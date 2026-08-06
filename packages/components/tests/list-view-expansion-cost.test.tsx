import type { ListItem } from "@gtkx/components";
import { describe, expect, it } from "vitest";
import type { TreeFixture, TreeName } from "./helpers/tree-fixtures.js";
import { renderListView } from "./helpers/list-fixtures.js";
import { getSelectionModel } from "./helpers/selection-model.js";
import { expectTreeShape, measureRowCost } from "./helpers/tree-fixtures.js";

const CHILD_COUNT = 5000;
const VISIBLE_ROW_COUNT = CHILD_COUNT + 1;
const COLLAPSED: string[] = [];
const EXPANDED = ["p"];
const SELECTED_FIRST = ["c-10"];
const SELECTED_SECOND = ["c-4321"];
const SECOND_POSITION = 4322;
const ROW_CHECK_LIMIT = CHILD_COUNT / 4;
const PARENT_COUNT = 100;
const PARENT_CHILD_COUNT = 20;

const children: ListItem<TreeName>[] = Array.from({ length: CHILD_COUNT }, (_, index) => {
    const id = `c-${String(index)}`;

    return { id, value: { name: id }, shouldHideExpander: true };
});

const items: ListItem<TreeName>[] = [{ id: "p", value: { name: "p" }, children }];

const manyParents: ListItem<TreeName>[] = Array.from({ length: PARENT_COUNT }, (_, parent) => ({
    id: `p-${String(parent)}`,
    value: { name: `p-${String(parent)}` },
    children: Array.from({ length: PARENT_CHILD_COUNT }, (_, index) => {
        const id = `p-${String(parent)}-c-${String(index)}`;

        return { id, value: { name: id } };
    }),
}));

const manyParentIds = manyParents.map((parent) => parent.id);

const renderCostFixture = async (expandedIds: string[]): Promise<TreeFixture> =>
    renderListView<TreeName>(items, { expandedIds, selected: SELECTED_FIRST });

describe(`render - ListView (tree) - row cost over ${String(VISIBLE_ROW_COUNT)} visible rows`, () => {
    it("expands one row with one getRow and one setExpanded", async () => {
        const fixture = await renderCostFixture(COLLAPSED);
        const cost = await measureRowCost(fixture, items, { expandedIds: EXPANDED, selected: SELECTED_FIRST });
        expect(cost.getRow).toBe(1);
        expect(cost.treeGetItem).toBe(0);
        expect(cost.setExpanded).toBe(1);
        expect(cost.rowChecks).toBeLessThan(ROW_CHECK_LIMIT);
        await expectTreeShape(fixture, { rows: VISIBLE_ROW_COUNT });
    });

    it("moves the controlled selection without walking the rows", async () => {
        const fixture = await renderCostFixture(EXPANDED);
        await expectTreeShape(fixture, { rows: VISIBLE_ROW_COUNT, selected: 1n });
        const cost = await measureRowCost(fixture, items, { expandedIds: EXPANDED, selected: SELECTED_SECOND });
        expect(cost.getRow).toBe(0);
        expect(cost.treeGetItem).toBe(0);
        expect(cost.setExpanded).toBe(0);
        expect(cost.rowChecks).toBeLessThan(ROW_CHECK_LIMIT);
        expect(getSelectionModel(fixture.ref).isSelected(SECOND_POSITION)).toBe(true);
    });

    it("expands many rows at once with one getRow and one setExpanded per changed row", async () => {
        const fixture = await renderListView<TreeName>(manyParents, { expandedIds: COLLAPSED });
        const cost = await measureRowCost(fixture, manyParents, { expandedIds: manyParentIds });
        expect(cost.getRow).toBe(PARENT_COUNT);
        expect(cost.treeGetItem).toBe(0);
        expect(cost.setExpanded).toBe(PARENT_COUNT);
        await expectTreeShape(fixture, { rows: PARENT_COUNT * (PARENT_CHILD_COUNT + 1) });
    });
});
