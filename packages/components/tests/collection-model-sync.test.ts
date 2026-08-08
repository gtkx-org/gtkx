import type { ListItem } from "@gtkx/components";
import type * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";
import type { CollectionIndex } from "../src/internal/collection-index.js";
import type { CollectionModel } from "../src/internal/collection-model.js";
import { createCollectionIndex } from "../src/internal/collection-index.js";
import { createCollectionModel } from "../src/internal/collection-model.js";
import { encodePart } from "../src/internal/keys.js";
import { trackPaths } from "../src/internal/slots.js";
import { adoptOrder } from "../src/internal/tree-expansion.js";
import { walkVisible } from "../src/internal/tree-order.js";

type Splice = [number, number, number];

const NARROW_SOURCE_COUNT = 2500;
const NARROW_TARGET_COUNT = 1250;
const SCALE_BASE_COUNT = 625;
const SCALE_FACTOR = 4;
const SCALE_LIMIT = 8;
const SCALE_REPEAT_COUNT = 9;
const SCALE_KEPT_COUNT = 4;
const DEEP_SOURCE_COUNT = 2501;
const DEEP_KEPT_COUNT = 3;
const LEVEL_WIDE_COUNT = 3;
const LEVEL_NARROW_COUNT = 2;

const leaf = (id: string): ListItem => ({ id, value: { name: id } });
const branch = (id: string, children: ListItem[]): ListItem => ({ id, value: { name: id }, children });
const treeIndex = (items: ListItem[]): CollectionIndex => createCollectionIndex(items, undefined, false);
const flatIndex = (ids: string[]): CollectionIndex => treeIndex(ids.map((id) => leaf(id)));
const leafTailTree = (): ListItem[] => [branch("a", [leaf("a0")]), leaf("b")];
const branchTailTree = (): ListItem[] => [branch("a", [leaf("a0")]), branch("b", [leaf("b0")])];
const wideTree = (): ListItem[] => [branch("a", [leaf("a0"), leaf("a1")]), leaf("b")];
const longTree = (): ListItem[] => [branch("a", [leaf("a0")]), leaf("b"), leaf("c")];
const stub = (id: string): ListItem => branch(id, [leaf(`${id}-child`)]);
const nested = (id: string): ListItem => branch(id, [stub(`${id}-child`)]);
const rootPathAt = (slot: number): string => encodePart("0") + encodePart(String(slot));
const stubs = (count: number): ListItem[] => Array.from({ length: count }, (_, slot) => stub(`b-${String(slot)}`));

const kids = (id: string, count: number): ListItem[] =>
    Array.from({ length: count }, (_, slot) => leaf(`${id}-c${String(slot)}`));

const parents = (count: number, width: number): ListItem[] =>
    Array.from({ length: count }, (_, slot) => branch(`p-${String(slot)}`, kids(`p-${String(slot)}`, width)));

const leaves = (count: number): ListItem[] => Array.from({ length: count }, (_, slot) => leaf(`l-${String(slot)}`));
const flipRunSource = (): ListItem[] => [stub("a"), leaf("b"), leaf("c"), leaf("d")];
const adjacentFlips = (): ListItem[] => [stub("a"), stub("b"), stub("c"), leaf("d")];
const splitFlips = (): ListItem[] => [stub("a"), stub("b"), leaf("c"), stub("d")];

const syncedModel = (index: CollectionIndex): CollectionModel => {
    const collectionModel = createCollectionModel();
    collectionModel.sync(index);

    return collectionModel;
};

const spliceLog = (model: Gio.ListModel): Splice[] => {
    const calls: Splice[] = [];

    model.connect("items-changed", (position, removed, added) => {
        calls.push([position, removed, added]);
    });

    return calls;
};

const getTree = (collectionModel: CollectionModel): Gtk.TreeListModel => {
    const tree = collectionModel.treeModel();

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
    const collectionModel = syncedModel(flatIndex(previous));
    const splices = spliceLog(collectionModel.model);
    collectionModel.sync(flatIndex(next));
    expect(splices).toEqual(expected);
    expect(collectionModel.model.getNItems()).toBe(next.length);
};

const expectTreeSplices = (previous: ListItem[], next: ListItem[], expected: Splice[]): void => {
    const collectionModel = syncedModel(treeIndex(previous));
    const splices = spliceLog(collectionModel.model);
    collectionModel.sync(treeIndex(next));
    expect(splices).toEqual(expected);
    expect(collectionModel.model.getNItems()).toBe(next.length);
};

const expandedModel = (items: ListItem[]): CollectionModel => {
    const index = treeIndex(items);
    const collectionModel = syncedModel(index);
    const slots = trackPaths(index.children.keys());
    adoptOrder(collectionModel.expansion, walkVisible({ index, slots }));

    return collectionModel;
};

const expandEveryRow = (collectionModel: CollectionModel, index: CollectionIndex): void => {
    const tree = getTree(collectionModel);

    const order = walkVisible({
        index,
        slots: trackPaths(index.children.keys()),
        visit: (row) => {
            if (row.isOpen) {
                expandRowAt(tree, row.position);
            }
        },
    });

    adoptOrder(collectionModel.expansion, order);
};

const levelTrimCost = (count: number): number => {
    const collectionModel = expandedModel(parents(count, LEVEL_WIDE_COUNT));
    const trimmed = treeIndex(parents(count, LEVEL_NARROW_COUNT));
    const start = performance.now();
    collectionModel.sync(trimmed);

    return performance.now() - start;
};

const narrowingCost = (count: number): number => {
    const items = stubs(count);
    const collectionModel = expandedModel(items);
    const narrowed = treeIndex(items.slice(0, SCALE_KEPT_COUNT));
    const start = performance.now();
    collectionModel.sync(narrowed);

    return performance.now() - start;
};

const fastestCost = (measure: (count: number) => number, count: number): number => {
    const runs = Array.from({ length: SCALE_REPEAT_COUNT }, () => measure(count));

    return Math.min(...runs);
};

const expectLinearScaling = (measure: (count: number) => number): void => {
    fastestCost(measure, SCALE_BASE_COUNT);
    const base = fastestCost(measure, SCALE_BASE_COUNT);
    const scaled = fastestCost(measure, SCALE_BASE_COUNT * SCALE_FACTOR);
    expect(scaled / base).toBeLessThan(SCALE_LIMIT);
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
        const collectionModel = syncedModel(treeIndex(leafTailTree()));
        const tree = getTree(collectionModel);
        expect(isRowExpandableAt(tree, 1)).toBe(false);
        const splices = spliceLog(collectionModel.model);
        collectionModel.sync(treeIndex(branchTailTree()));
        expect(splices).toEqual([[1, 1, 1]]);
        expect(isRowExpandableAt(tree, 1)).toBe(true);
    });

    it("coalesces a run of adjacent expandability flips into one replacement", () => {
        expectTreeSplices(flipRunSource(), adjacentFlips(), [[1, 2, 2]]);
    });

    it("keeps expandability flips separated by a stable slot apart", () => {
        expectTreeSplices(flipRunSource(), splitFlips(), [
            [1, 1, 1],
            [3, 1, 1],
        ]);
    });

    it("narrows a large tree with one tail splice and one coalesced replacement", () => {
        const kept = [stub("b-0"), ...leaves(NARROW_TARGET_COUNT - 1)];

        expectTreeSplices(stubs(NARROW_SOURCE_COUNT), kept, [
            [NARROW_TARGET_COUNT, NARROW_SOURCE_COUNT - NARROW_TARGET_COUNT, 0],
            [1, NARROW_TARGET_COUNT - 1, NARROW_TARGET_COUNT - 1],
        ]);
    });

    it("narrows a fully expanded five thousand row tree with a single emission", () => {
        const index = treeIndex(stubs(DEEP_SOURCE_COUNT));
        const collectionModel = syncedModel(index);
        expandEveryRow(collectionModel, index);
        expect(collectionModel.model.getNItems()).toBe(DEEP_SOURCE_COUNT * 2);
        const splices = spliceLog(collectionModel.model);
        collectionModel.sync(treeIndex(stubs(DEEP_KEPT_COUNT)));
        expect(splices).toEqual([[DEEP_KEPT_COUNT * 2, (DEEP_SOURCE_COUNT - DEEP_KEPT_COUNT) * 2, 0]]);
        expect(collectionModel.model.getNItems()).toBe(DEEP_KEPT_COUNT * 2);
    });
});

describe("createCollectionModel - expansion pruning", () => {
    it("drops a removed slot's own path and its expanded descendants", () => {
        const collectionModel = expandedModel([stub("keep"), nested("drop")]);
        expect(collectionModel.expansion.expanded.has(rootPathAt(1))).toBe(true);
        collectionModel.sync(treeIndex([stub("keep")]));
        expect([...collectionModel.expansion.expanded]).toEqual([rootPathAt(0)]);
    });

    it("drops the expanded subtree of a slot that stops being expandable", () => {
        const collectionModel = expandedModel([nested("flip"), stub("keep")]);
        collectionModel.sync(treeIndex([leaf("flip"), stub("keep")]));
        expect([...collectionModel.expansion.expanded]).toEqual([rootPathAt(1)]);
    });

    it("narrows in time linear in the number of removed slots", () => {
        expectLinearScaling(narrowingCost);
    });

    it("trims every expanded level in time linear in the number of levels", () => {
        expectLinearScaling(levelTrimCost);
    });
});

describe("createCollectionModel - level stores", () => {
    it("serves each slot's children through the tree model", () => {
        const collectionModel = syncedModel(treeIndex(wideTree()));
        const tree = getTree(collectionModel);
        expect(tree.getNItems()).toBe(2);
        expandRowAt(tree, 0);
        expect(tree.getNItems()).toBe(4);
        expect(getRowDepthAt(tree, 1)).toBe(1);
        expect(getRowDepthAt(tree, 2)).toBe(1);
    });

    it("keeps the surviving rows when the tail shrinks", () => {
        const collectionModel = syncedModel(treeIndex(longTree()));
        const tree = getTree(collectionModel);
        expandRowAt(tree, 0);
        expect(tree.getNItems()).toBe(4);
        collectionModel.sync(treeIndex(leafTailTree()));
        expect(tree.getNItems()).toBe(3);
        expect(isRowExpandedAt(tree, 0)).toBe(true);
    });
});
