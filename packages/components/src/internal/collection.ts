import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { Item } from "../types.js";
import type { CollectionIndex } from "./collection-index.js";
import type { CollectionModel } from "./collection-model.js";
import { getId } from "./collection-model.js";

type Collection = {
    isTree: boolean;
    model: Gtk.FlattenListModel;
    treeModel: () => Gtk.TreeListModel | null;
    itemFor: (id: string) => Item | undefined;
    sectionFor: (id: string) => unknown;
    idAt: (position: number) => string | null;
    positionFor: (id: string) => number;
    positionsFor: (ids: string[]) => number[];
};

const ascending = (a: number, b: number): number => a - b;

function visitRow(
    tree: Gtk.TreeListModel,
    position: number,
    visit: (row: Gtk.TreeListRow, id: string | null) => void,
): void {
    const row = tree.getRow(position);

    if (row === null) {
        return;
    }

    visit(row, getId(row.getItem()));
}

function eachRow(tree: Gtk.TreeListModel, visit: (row: Gtk.TreeListRow, id: string | null) => void): void {
    for (let position = 0; position < tree.getNItems(); position++) {
        visitRow(tree, position, visit);
    }
}

function collectWanted(item: GObject.Object | null, position: number, wanted: Set<string>, out: number[]): void {
    const id = getId(item);

    if (id !== null && wanted.has(id)) {
        out.push(position);
    }
}

function scanPositions(tree: Gtk.TreeListModel, ids: string[]): number[] {
    const wanted = new Set(ids);
    const positions: number[] = [];
    const count = tree.getNItems();

    for (let position = 0; position < count; position++) {
        collectWanted(tree.getItem(position), position, wanted, positions);
    }

    return positions;
}

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

function positionsFor(gtk: CollectionModel, index: CollectionIndex, ids: string[]): number[] {
    if (!index.isTree) {
        return indexPositions(index, ids);
    }

    const tree = gtk.treeModel();

    return tree === null ? [] : scanPositions(tree, ids);
}

function positionFor(gtk: CollectionModel, index: CollectionIndex, id: string): number {
    const [first = -1] = positionsFor(gtk, index, [id]);

    return first;
}

function createCollection(gtk: CollectionModel, index: CollectionIndex): Collection {
    return {
        isTree: index.isTree,
        model: gtk.model,
        treeModel: () => (index.isTree ? gtk.treeModel() : null),
        itemFor: index.itemFor,
        sectionFor: index.sectionFor,
        idAt: (position) => getId(gtk.model.getItem(position)),
        positionFor: (id) => positionFor(gtk, index, id),
        positionsFor: (ids) => positionsFor(gtk, index, ids),
    };
}

export { createCollection, eachRow, type Collection };
