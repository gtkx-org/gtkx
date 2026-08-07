import type { ListItem } from "../types.js";
import type { CollectionIndex } from "./collection-index.js";
import type { CollectionModel, SlotRef } from "./collection-model.js";
import { slotRefFor } from "./collection-model.js";
import { orderFor } from "./tree-expansion.js";

type Collection = Pick<CollectionModel, "model" | "expansion" | "treeModel"> & {
    itemAt: (ref: SlotRef) => ListItem | undefined;
    sectionFor: (levelPath: string) => unknown;
    idAt: (position: number) => string | null;
    positionFor: (id: string) => number;
    positionsFor: (ids: string[]) => number[];
};

const NO_POSITIONS: number[] = [];

const ascending = (a: number, b: number): number => a - b;

function positionsFor(collectionModel: CollectionModel, ids: string[]): number[] {
    if (ids.length === 0) {
        return NO_POSITIONS;
    }

    const { positions } = orderFor(collectionModel.expansion);
    const found: Set<number> = new Set(ids.flatMap((id) => positions.get(id) ?? NO_POSITIONS));

    return [...found].toSorted(ascending);
}

function positionFor(collectionModel: CollectionModel, id: string): number {
    const [first = -1] = positionsFor(collectionModel, [id]);

    return first;
}

function idAt(collectionModel: CollectionModel, index: CollectionIndex, position: number): string | null {
    const ref = slotRefFor(collectionModel.model.getItem(position));

    if (ref === null) {
        return null;
    }

    return index.itemAt(ref.store.path, ref.slot)?.id ?? null;
}

function isCollectionIdle(collection: Collection): boolean {
    const { expansion } = collection;

    return !expansion.isApplying && !expansion.isSyncing;
}

function createCollection(collectionModel: CollectionModel, index: CollectionIndex): Collection {
    return {
        model: collectionModel.model,
        expansion: collectionModel.expansion,
        treeModel: () => (index.isTree ? collectionModel.treeModel() : null),
        itemAt: (ref) => index.itemAt(ref.store.path, ref.slot),
        sectionFor: index.sectionFor,
        idAt: (position) => idAt(collectionModel, index, position),
        positionFor: (id) => positionFor(collectionModel, id),
        positionsFor: (ids) => positionsFor(collectionModel, ids),
    };
}

export { createCollection, isCollectionIdle, type Collection };
