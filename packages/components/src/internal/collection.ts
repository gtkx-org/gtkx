import type * as Gtk from "@gtkx/gi/gtk";
import type { ListItem } from "../types.js";
import type { CollectionIndex } from "./collection-index.js";
import type { CollectionModel } from "./collection-model.js";
import type { TreeExpansion } from "./tree-expansion.js";
import { nodeRefFor } from "./collection-model.js";
import { orderFor } from "./tree-expansion.js";

type Collection = {
    isTree: boolean;
    structureKey: string;
    model: Gtk.FlattenListModel;
    expansion: TreeExpansion;
    treeModel: () => Gtk.TreeListModel | null;
    itemFor: (key: string) => ListItem | undefined;
    sectionFor: (levelKey: string) => unknown;
    idAt: (position: number) => string | null;
    positionFor: (id: string) => number;
    positionsFor: (ids: string[]) => number[];
};

const NO_POSITIONS: number[] = [];

const ascending = (a: number, b: number): number => a - b;

function positionsFor(gtk: CollectionModel, ids: string[]): number[] {
    const { positions } = orderFor(gtk.expansion);
    const found: Set<number> = new Set(ids.flatMap((id) => positions.get(id) ?? NO_POSITIONS));

    return [...found].toSorted(ascending);
}

function positionFor(gtk: CollectionModel, id: string): number {
    const [first = -1] = positionsFor(gtk, [id]);

    return first;
}

function isCollectionIdle(collection: Collection): boolean {
    const { expansion } = collection;

    return !expansion.isApplying && !expansion.isSyncing;
}

function createCollection(gtk: CollectionModel, index: CollectionIndex): Collection {
    return {
        isTree: index.isTree,
        structureKey: index.structureKey,
        model: gtk.model,
        expansion: gtk.expansion,
        treeModel: () => (index.isTree ? gtk.treeModel() : null),
        itemFor: index.itemFor,
        sectionFor: index.sectionFor,
        idAt: (position) => nodeRefFor(gtk.model.getItem(position))?.id ?? null,
        positionFor: (id) => positionFor(gtk, id),
        positionsFor: (ids) => positionsFor(gtk, ids),
    };
}

export { createCollection, isCollectionIdle, type Collection };
