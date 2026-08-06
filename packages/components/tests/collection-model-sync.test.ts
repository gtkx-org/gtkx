import type { ListItem } from "@gtkx/components";
import type * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import type { CollectionIndex } from "../src/internal/collection-index.js";
import type { CollectionModel } from "../src/internal/collection-model.js";
import { createCollectionIndex } from "../src/internal/collection-index.js";
import { createCollectionModel } from "../src/internal/collection-model.js";

type Splice = [number, number, number];

const leaf = (id: string): ListItem => ({ id, value: { name: id } });
const branch = (id: string, children: ListItem[]): ListItem => ({ id, value: { name: id }, children });
const treeIndex = (items: ListItem[]): CollectionIndex => createCollectionIndex(items, undefined, false);
const flatIndex = (ids: string[]): CollectionIndex => treeIndex(ids.map((id) => leaf(id)));
const leafTailTree = (): ListItem[] => [branch("a", [leaf("a0")]), leaf("b")];
const branchTailTree = (): ListItem[] => [branch("a", [leaf("a0")]), branch("b", [leaf("b0")])];
const wideTree = (): ListItem[] => [branch("a", [leaf("a0"), leaf("a1")]), leaf("b")];
const longTree = (): ListItem[] => [branch("a", [leaf("a0")]), leaf("b"), leaf("c")];

const syncedModel = (index: CollectionIndex): CollectionModel => {
    const gtk = createCollectionModel();
    gtk.sync(index);

    return gtk;
};

const spliceLog = (model: Gio.ListModel): Splice[] => {
    const calls: Splice[] = [];

    model.connect("items-changed", (position, removed, added) => {
        calls.push([position, removed, added]);
    });

    return calls;
};

const getTree = (gtk: CollectionModel): Gtk.TreeListModel => {
    const tree = gtk.treeModel();

    if (tree === null) {
        throw new TypeError("Expected the collection model to hold a tree");
    }

    return tree;
};

const getRowAt = (tree: Gtk.TreeListModel, position: number): Gtk.TreeListRow => {
    const row = tree.getRow(position);

    if (row === null) {
        throw new TypeError("Expected a tree list row");
    }

    return row;
};

const isRowExpandableAt = (tree: Gtk.TreeListModel, position: number): boolean =>
    getRowAt(tree, position).isExpandable();

const isRowExpandedAt = (tree: Gtk.TreeListModel, position: number): boolean => getRowAt(tree, position).getExpanded();
const getRowDepthAt = (tree: Gtk.TreeListModel, position: number): number => getRowAt(tree, position).getDepth();

const expandRowAt = (tree: Gtk.TreeListModel, position: number): void => {
    getRowAt(tree, position).setExpanded(true);
};

const expectFlatSplices = (previous: string[], next: string[], expected: Splice[]): void => {
    const gtk = syncedModel(flatIndex(previous));
    const splices = spliceLog(gtk.model);
    gtk.sync(flatIndex(next));
    expect(splices).toEqual(expected);
    expect(gtk.model.getNItems()).toBe(next.length);
};

describe("createCollectionModel - sync emissions", () => {
    it("emits nothing for a pure reorder", () => {
        expectFlatSplices(["a", "b", "c"], ["c", "a", "b"], []);
    });

    it("emits one tail splice when a row is inserted in the middle", () => {
        expectFlatSplices(["a", "b"], ["a", "x", "b"], [[2, 0, 1]]);
    });

    it("emits one tail splice when rows are removed", () => {
        expectFlatSplices(["a", "b", "c"], ["a"], [[1, 2, 0]]);
    });

    it("emits one replacement when a slot's expandability flips", () => {
        const gtk = syncedModel(treeIndex(leafTailTree()));
        const tree = getTree(gtk);
        expect(isRowExpandableAt(tree, 1)).toBe(false);
        const splices = spliceLog(gtk.model);
        gtk.sync(treeIndex(branchTailTree()));
        expect(splices).toEqual([[1, 1, 1]]);
        expect(isRowExpandableAt(tree, 1)).toBe(true);
    });
});

describe("createCollectionModel - level stores", () => {
    it("serves each slot's children through the tree model", () => {
        const gtk = syncedModel(treeIndex(wideTree()));
        const tree = getTree(gtk);
        expect(tree.getNItems()).toBe(2);
        expandRowAt(tree, 0);
        expect(tree.getNItems()).toBe(4);
        expect(getRowDepthAt(tree, 1)).toBe(1);
        expect(getRowDepthAt(tree, 2)).toBe(1);
    });

    it("keeps the surviving rows when the tail shrinks", () => {
        const gtk = syncedModel(treeIndex(longTree()));
        const tree = getTree(gtk);
        expandRowAt(tree, 0);
        expect(tree.getNItems()).toBe(4);
        gtk.sync(treeIndex(leafTailTree()));
        expect(tree.getNItems()).toBe(3);
        expect(isRowExpandedAt(tree, 0)).toBe(true);
    });
});
