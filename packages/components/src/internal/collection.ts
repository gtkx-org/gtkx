import type * as Gtk from "@gtkx/gi/gtk";
import type { ListItem } from "../types.js";
import type { CollectionIndex } from "./collection-index.js";
import type { CollectionModel } from "./collection-model.js";
import type { TreeExpansion } from "./tree-expansion.js";
import { getId } from "./collection-model.js";
import { orderFor } from "./tree-expansion.js";

type Collection = {
    isTree: boolean;
    structureKey: string;
    model: Gtk.FlattenListModel;
    expansion: TreeExpansion;
    treeModel: () => Gtk.TreeListModel | null;
    itemFor: (id: string) => ListItem | undefined;
    sectionFor: (id: string) => unknown;
    idAt: (position: number) => string | null;
    positionFor: (id: string) => number;
    positionsFor: (ids: string[]) => number[];
};

const ascending = (a: number, b: number): number => a - b;

function indexPositions(index: CollectionIndex, ids: string[]): number[] {
    const positions: number[] = [];

    for (const id of ids) {
        const position = index.positionFor(id);

        if (position >= 0) {
            positions.push(position);
        }
    }

    return positions.toSorted(ascending);
}

function treePositions(expansion: TreeExpansion, ids: string[]): number[] {
    const { positions } = orderFor(expansion);
    const found: number[] = [];

    for (const id of ids) {
        const position = positions.get(id);

        if (position !== undefined) {
            found.push(position);
        }
    }

    return found.toSorted(ascending);
}

function positionsFor(gtk: CollectionModel, index: CollectionIndex, ids: string[]): number[] {
    return index.isTree ? treePositions(gtk.expansion, ids) : indexPositions(index, ids);
}

function positionFor(gtk: CollectionModel, index: CollectionIndex, id: string): number {
    const [first = -1] = positionsFor(gtk, index, [id]);

    return first;
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
        idAt: (position) => getId(gtk.model.getItem(position)),
        positionFor: (id) => positionFor(gtk, index, id),
        positionsFor: (ids) => positionsFor(gtk, index, ids),
    };
}

export { createCollection, type Collection };
