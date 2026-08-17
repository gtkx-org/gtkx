import type { ListItem } from "../types.js";
import type { CollectionIndex } from "./collection-index.js";
import type { CollectionModel, SlotRef } from "./collection-model.js";
import type { MatchedRows } from "./tree-order.js";
import { slotPathAt, slotRefFor } from "./collection-model.js";
import { findIds, findRows } from "./tree-order.js";

type Collection = Pick<CollectionModel, "model" | "expansion" | "rowAt"> & {
    isTree: boolean;
    itemAt: (ref: SlotRef) => ListItem | undefined;
    sectionFor: (levelPath: string) => unknown;
    idAt: (position: number) => string | null;
    idsAt: (positions: number[]) => string[];
    pathAt: (position: number) => string | null;
    positionFor: (id: string) => number;
    rowsFor: (ids: string[]) => MatchedRows;
};

const NO_ROWS: MatchedRows = { positions: [], ids: [] };
const NO_IDS: string[] = [];

function rowsFor(collectionModel: CollectionModel, ids: string[]): MatchedRows {
    if (ids.length === 0) {
        return NO_ROWS;
    }

    const { expansion } = collectionModel;

    return findRows(expansion.index, expansion.slots, new Set(ids));
}

function positionFor(collectionModel: CollectionModel, id: string): number {
    const [first = -1] = rowsFor(collectionModel, [id]).positions;

    return first;
}

function refAt(collectionModel: CollectionModel, position: number): SlotRef | null {
    if (position < 0) {
        return null;
    }

    return slotRefFor(collectionModel.model.getItem(position));
}

function itemAt(index: CollectionIndex, ref: SlotRef): ListItem | undefined {
    return index.itemAt(ref.store.level.path, ref.slot);
}

function idAt(collectionModel: CollectionModel, index: CollectionIndex, position: number): string | null {
    const ref = refAt(collectionModel, position);

    return ref === null ? null : (itemAt(index, ref)?.id ?? null);
}

function pathAt(collectionModel: CollectionModel, position: number): string | null {
    const ref = refAt(collectionModel, position);

    if (ref === null) {
        return null;
    }

    return slotPathAt(ref.store, ref.slot);
}

function idsAt(collectionModel: CollectionModel, positions: number[]): string[] {
    if (positions.length === 0) {
        return NO_IDS;
    }

    const { expansion } = collectionModel;

    return findIds(expansion.index, expansion.slots, new Set(positions));
}

function isCollectionIdle(collection: Collection): boolean {
    const { expansion } = collection;

    return !expansion.isApplying && !expansion.isSyncing;
}

function createCollection(collectionModel: CollectionModel, index: CollectionIndex): Collection {
    return {
        model: collectionModel.model,
        expansion: collectionModel.expansion,
        isTree: index.isTree,
        rowAt: collectionModel.rowAt,
        itemAt: (ref) => itemAt(index, ref),
        sectionFor: index.sectionFor,
        idAt: (position) => idAt(collectionModel, index, position),
        idsAt: (positions) => idsAt(collectionModel, positions),
        pathAt: (position) => pathAt(collectionModel, position),
        positionFor: (id) => positionFor(collectionModel, id),
        rowsFor: (ids) => rowsFor(collectionModel, ids),
    };
}

export { createCollection, isCollectionIdle, type Collection };
