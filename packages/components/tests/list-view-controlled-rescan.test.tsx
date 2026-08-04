import type { ListItem } from "@gtkx/components";
import type { ReactNode, RefObject } from "react";
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, waitFor } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";
import { getSelectionModel } from "./helpers/selection-model.js";

type Named = { name: string };

type TreeAppProps = {
    items: ListItem<Named>[];
    expandedIds: string[];
    listRef: RefObject<Gtk.ListView | null>;
};

type TreeFixture = {
    listRef: RefObject<Gtk.ListView | null>;
    items: ListItem<Named>[];
    rerenderTree: (items: ListItem<Named>[], expandedIds: string[]) => Promise<void>;
};

const CHILD_COUNT = 4;
const EXPANDED_IDS = ["p-0", "p-1", "p-2"];
const FEWER_PARENT_IDS = ["p-0", "p-1"];
const COLLAPSED_IDS: string[] = [];
const SELECTED_IDS = ["p-1-c-1"];
const EXPANDED_ROW_COUNT = EXPANDED_IDS.length * (CHILD_COUNT + 1);
const FEWER_ROW_COUNT = FEWER_PARENT_IDS.length * (CHILD_COUNT + 1);

const childItems = (parent: string): ListItem<Named>[] =>
    Array.from({ length: CHILD_COUNT }, (_, index) => {
        const id = `${parent}-c-${String(index)}`;

        return { id, value: { name: id } };
    });

const treeItems = (parents: string[]): ListItem<Named>[] =>
    parents.map((parent) => ({ id: parent, value: { name: parent }, children: childItems(parent) }));

const TreeApp = ({ items, expandedIds, listRef }: TreeAppProps): ReactNode => (
    <ScrollWrapper minContentHeight={600}>
        <ListView<Named>
            ref={listRef}
            items={items}
            expandedIds={expandedIds}
            selectedIds={SELECTED_IDS}
            renderItem={({ item }) => <GtkLabel>{item.name}</GtkLabel>}
        />
    </ScrollWrapper>
);

const expectTreeState = async (
    listRef: RefObject<Gtk.ListView | null>,
    rows: number,
    selected: bigint,
): Promise<void> => {
    await waitFor(() => {
        const model = getSelectionModel(listRef);
        expect(model.getNItems()).toBe(rows);
        expect(model.getSelection().getSize()).toBe(selected);
    });
};

const countTreeScans = async (
    fixture: TreeFixture,
    items: ListItem<Named>[],
    expandedIds: string[],
): Promise<number> => {
    const getRow = vi.spyOn(Gtk.TreeListModel.prototype, "getRow");
    const getItem = vi.spyOn(Gtk.TreeListModel.prototype, "getItem");

    try {
        await fixture.rerenderTree(items, expandedIds);

        return getRow.mock.calls.length + getItem.mock.calls.length;
    } finally {
        getRow.mockRestore();
        getItem.mockRestore();
    }
};

const renderExpandedTree = async (): Promise<TreeFixture> => {
    const listRef = createRef<Gtk.ListView>();
    const items = treeItems(EXPANDED_IDS);

    const app = (next: ListItem<Named>[], expandedIds: string[]): ReactNode => (
        <TreeApp items={next} expandedIds={expandedIds} listRef={listRef} />
    );

    const { rerender } = await render(app(items, EXPANDED_IDS));
    await expectTreeState(listRef, EXPANDED_ROW_COUNT, 1n);

    return {
        listRef,
        items,
        rerenderTree: async (next, expandedIds) => {
            await rerender(app(next, expandedIds));
        },
    };
};

describe("render - ListView (tree) - controlled rescans", () => {
    it("skips the row scans when only the items array identity changes", async () => {
        const fixture = await renderExpandedTree();
        const scans = await countTreeScans(fixture, treeItems(EXPANDED_IDS), EXPANDED_IDS);
        expect(scans).toBe(0);
        await expectTreeState(fixture.listRef, EXPANDED_ROW_COUNT, 1n);
    });

    it("scans the rows when the item structure changes", async () => {
        const fixture = await renderExpandedTree();
        const scans = await countTreeScans(fixture, treeItems(FEWER_PARENT_IDS), EXPANDED_IDS);
        expect(scans).toBeGreaterThan(0);
        await expectTreeState(fixture.listRef, FEWER_ROW_COUNT, 1n);
    });

    it("scans the rows when expandedIds changes without the items changing", async () => {
        const fixture = await renderExpandedTree();
        const scans = await countTreeScans(fixture, fixture.items, COLLAPSED_IDS);
        expect(scans).toBeGreaterThan(0);

        await waitFor(() => {
            expect(getSelectionModel(fixture.listRef).getNItems()).toBe(EXPANDED_IDS.length);
        });
    });
});
