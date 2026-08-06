import type { ListItem } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { waitFor } from "@gtkx/testing";
import { expect, vi } from "vitest";
import type { ListViewFixture, RenderListViewOptions } from "./list-fixtures.js";
import { getSelectionModel } from "./selection-model.js";

type TreeName = { name: string };
type TreeFixture = ListViewFixture<TreeName>;
type TreeOptions = RenderListViewOptions<TreeName>;

type RowCost = {
    getRow: number;
    treeGetItem: number;
    setExpanded: number;
    rowChecks: number;
};

type TreeListShape = {
    rows: number;
    selected?: bigint | undefined;
};

const treeLeaf = (id: string): ListItem<TreeName> => ({ id, value: { name: id } });

const treeBranch = (id: string, children: ListItem<TreeName>[]): ListItem<TreeName> => ({
    id,
    value: { name: id },
    children,
});

const measureRowCost = async (
    fixture: TreeFixture,
    items: ListItem<TreeName>[],
    options: TreeOptions,
): Promise<RowCost> => {
    const getRow = vi.spyOn(Gtk.TreeListModel.prototype, "getRow");
    const treeGetItem = vi.spyOn(Gtk.TreeListModel.prototype, "getItem");
    const setExpanded = vi.spyOn(Gtk.TreeListRow.prototype, "setExpanded");
    const isExpandable = vi.spyOn(Gtk.TreeListRow.prototype, "isExpandable");
    const getExpanded = vi.spyOn(Gtk.TreeListRow.prototype, "getExpanded");

    try {
        await fixture.rerender(items, options);

        return {
            getRow: getRow.mock.calls.length,
            treeGetItem: treeGetItem.mock.calls.length,
            setExpanded: setExpanded.mock.calls.length,
            rowChecks: isExpandable.mock.calls.length + getExpanded.mock.calls.length,
        };
    } finally {
        for (const spy of [getRow, treeGetItem, setExpanded, isExpandable, getExpanded]) {
            spy.mockRestore();
        }
    }
};

const expectTreeShape = async (fixture: TreeFixture, shape: TreeListShape): Promise<void> => {
    await waitFor(() => {
        const model = getSelectionModel(fixture.ref);
        expect(model.getNItems()).toBe(shape.rows);

        if (shape.selected !== undefined) {
            expect(model.getSelection().getSize()).toBe(shape.selected);
        }
    });
};

export { expectTreeShape, measureRowCost, treeBranch, treeLeaf, type TreeFixture, type TreeName, type TreeOptions };
