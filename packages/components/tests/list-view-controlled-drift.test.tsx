import type { ListItem } from "@gtkx/components";
import { act, waitFor } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import type { TreeName } from "./helpers/tree-fixtures.js";
import { renderListView } from "./helpers/list-fixtures.js";
import { getSelectionModel, getTreeRow } from "./helpers/selection-model.js";
import { treeBranch, treeLeaf } from "./helpers/tree-fixtures.js";

const SELECTED_IDS = ["b"];
const EXPANDED_IDS = ["p-0"];
const EXPANDED_ROW_COUNT = 3;

const flatItems = (): ListItem<TreeName>[] => ["a", "b", "c"].map((id) => treeLeaf(id));
const treeItems = (): ListItem<TreeName>[] => [treeBranch("p-0", [treeLeaf("p-0-c-0")]), treeLeaf("p-1")];

describe("render - ListView - controlled props re-assert over widget drift", () => {
    it("restores selectedIds after the widget selects another row on its own", async () => {
        const { ref, rerender } = await renderListView<TreeName>(flatItems(), { selected: SELECTED_IDS });
        const model = getSelectionModel(ref);

        await waitFor(() => {
            expect(model.isSelected(1)).toBe(true);
        });

        await act(() => {
            model.selectItem(0, true);
        });

        await rerender(flatItems());

        await waitFor(() => {
            expect(model.isSelected(0)).toBe(false);
            expect(model.isSelected(1)).toBe(true);
        });
    });

    it("restores expandedIds after a row collapses itself", async () => {
        const { ref, rerender } = await renderListView<TreeName>(treeItems(), { expandedIds: EXPANDED_IDS });
        const model = getSelectionModel(ref);

        await waitFor(() => {
            expect(model.getNItems()).toBe(EXPANDED_ROW_COUNT);
        });

        await act(() => {
            getTreeRow(model, 0).setExpanded(false);
        });

        await rerender(treeItems());

        await waitFor(() => {
            expect(model.getNItems()).toBe(EXPANDED_ROW_COUNT);
        });
    });
});
