import type { ListItem } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { expect, vi } from "vitest";
import { ScrollWrapper } from "./scroll-wrapper.js";
import { getSelectionModel } from "./selection-model.js";

type TreeName = { name: string };

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

type TreeListState = {
    items: ListItem<TreeName>[];
    expandedIds: string[];
    selectedIds?: string[] | undefined;
};

type TreeListAppProps = TreeListState & {
    listRef: RefObject<Gtk.ListView | null>;
};

type TreeListFixture = {
    listRef: RefObject<Gtk.ListView | null>;
    show: (next: TreeListState) => Promise<void>;
};

const treeLeaf = (id: string): ListItem<TreeName> => ({ id, value: { name: id } });

const treeBranch = (id: string, children: ListItem<TreeName>[]): ListItem<TreeName> => ({
    id,
    value: { name: id },
    children,
});

const TreeListApp = ({ items, expandedIds, selectedIds, listRef }: TreeListAppProps): ReactNode => (
    <ScrollWrapper minContentHeight={600}>
        <ListView<TreeName>
            ref={listRef}
            items={items}
            expandedIds={expandedIds}
            selectedIds={selectedIds}
            renderItem={({ item }) => <GtkLabel>{item.name}</GtkLabel>}
        />
    </ScrollWrapper>
);

const renderTreeList = async (state: TreeListState): Promise<TreeListFixture> => {
    const listRef = createRef<Gtk.ListView>();
    const app = (next: TreeListState): ReactNode => <TreeListApp {...next} listRef={listRef} />;
    const { rerender } = await render(app(state));

    return {
        listRef,
        show: async (next) => {
            await rerender(app(next));
        },
    };
};

const measureRowCost = async (fixture: TreeListFixture, next: TreeListState): Promise<RowCost> => {
    const getRow = vi.spyOn(Gtk.TreeListModel.prototype, "getRow");
    const treeGetItem = vi.spyOn(Gtk.TreeListModel.prototype, "getItem");
    const setExpanded = vi.spyOn(Gtk.TreeListRow.prototype, "setExpanded");
    const isExpandable = vi.spyOn(Gtk.TreeListRow.prototype, "isExpandable");
    const getExpanded = vi.spyOn(Gtk.TreeListRow.prototype, "getExpanded");

    try {
        await fixture.show(next);

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

const expectTreeShape = async (fixture: TreeListFixture, shape: TreeListShape): Promise<void> => {
    await waitFor(() => {
        const model = getSelectionModel(fixture.listRef);
        expect(model.getNItems()).toBe(shape.rows);

        if (shape.selected !== undefined) {
            expect(model.getSelection().getSize()).toBe(shape.selected);
        }
    });
};

export {
    expectTreeShape,
    measureRowCost,
    renderTreeList,
    treeBranch,
    treeLeaf,
    type RowCost,
    type TreeListFixture,
    type TreeListState,
    type TreeName,
};
