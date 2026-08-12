import type { ListItem } from "../types.js";
import type { CollectionIndex } from "./collection-index.js";
import type { CollectionModel, SlotRef } from "./collection-model.js";
import { slotPathAt, slotRefFor } from "./collection-model.js";
import { findPositions } from "./tree-order.js";

type Collection = Pick<CollectionModel, "model" | "expansion" | "rowAt"> & {
    isTree: boolean;
    itemAt: (ref: SlotRef) => ListItem | undefined;
    sectionFor: (levelPath: string) => unknown;
    idAt: (position: number) => string | null;
    pathAt: (position: number) => string | null;
    positionFor: (id: string) => number;
    positionsFor: (ids: string[]) => number[];
};

const NO_POSITIONS: number[] = [];

function positionsFor(collectionModel: CollectionModel, ids: string[]): number[] {
    if (ids.length === 0) {
        return NO_POSITIONS;
    }

    const { expansion } = collectionModel;

    return findPositions(expansion.index, expansion.slots, new Set(ids));
}

function positionFor(collectionModel: CollectionModel, id: string): number {
    const [first = -1] = positionsFor(collectionModel, [id]);

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
        pathAt: (position) => pathAt(collectionModel, position),
        positionFor: (id) => positionFor(collectionModel, id),
        positionsFor: (ids) => positionsFor(collectionModel, ids),
    };
}

export { createCollection, isCollectionIdle, type Collection };
