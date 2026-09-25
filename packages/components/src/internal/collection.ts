import type * as Gtk from "@gtkx/gi/gtk";
import type { ListItem } from "../types.js";
import type { CollectionIndex, SectionIdentity } from "./collection-index.js";
import type { CollectionModel, SlotRef } from "./collection-model.js";
import type { MatchedRows } from "./tree-order.js";
import { slotPathAt, slotRefFor } from "./collection-model.js";
import { findIds, findRows } from "./tree-order.js";

type Collection = Pick<CollectionModel, "expansion" | "rowAt"> & {
    isTree: boolean;
    itemAt: (ref: SlotRef) => ListItem | undefined;
    sectionFor: (levelPath: string) => SectionIdentity | undefined;
    idAt: (position: number) => string | null;
    idsAt: (positions: number[]) => string[];
    pathAt: (position: number) => string | null;
    positionFor: (id: string) => number;
    rowsFor: (ids: string[]) => MatchedRows;
};

const NO_ROWS: MatchedRows = { positions: [], ids: [] };
const NO_IDS: string[] = [];

function rowsFor(gtkModel: CollectionModel, ids: string[]): MatchedRows {
    if (ids.length === 0) {
        return NO_ROWS;
    }

    const { expansion } = gtkModel;

    return findRows(expansion.index, expansion.slots, new Set(ids));
}

function positionFor(gtkModel: CollectionModel, id: string): number {
    const [first = -1] = rowsFor(gtkModel, [id]).positions;

    return first;
}

function refAt(model: Gtk.FlattenListModel | null, position: number): SlotRef | null {
    if (position < 0) {
        return null;
    }

    return slotRefFor(model?.getItem(position) ?? null);
}

function itemAt(index: CollectionIndex, ref: SlotRef): ListItem | undefined {
    return index.itemAt(ref.store.level.path, ref.slot);
}

function idAt(model: Gtk.FlattenListModel | null, index: CollectionIndex, position: number): string | null {
    const ref = refAt(model, position);

    return ref === null ? null : (itemAt(index, ref)?.id ?? null);
}

function pathAt(model: Gtk.FlattenListModel | null, position: number): string | null {
    const ref = refAt(model, position);

    if (ref === null) {
        return null;
    }

    return slotPathAt(ref.store, ref.slot);
}

function idsAt(gtkModel: CollectionModel, positions: number[]): string[] {
    if (positions.length === 0) {
        return NO_IDS;
    }

    const { expansion } = gtkModel;

    return findIds(expansion.index, expansion.slots, new Set(positions));
}

function isCollectionIdle(collection: Collection): boolean {
    const { expansion } = collection;

    return !expansion.isApplying && !expansion.isSyncing;
}

function createCollection(
    gtkModel: CollectionModel,
    index: CollectionIndex,
    model: Gtk.FlattenListModel | null,
): Collection {
    return {
        expansion: gtkModel.expansion,
        isTree: index.isTree,
        rowAt: gtkModel.rowAt,
        itemAt: (ref) => itemAt(index, ref),
        sectionFor: index.sectionFor,
        idAt: (position) => idAt(model, index, position),
        idsAt: (positions) => idsAt(gtkModel, positions),
        pathAt: (position) => pathAt(model, position),
        positionFor: (id) => positionFor(gtkModel, id),
        rowsFor: (ids) => rowsFor(gtkModel, ids),
    };
}

export { createCollection, isCollectionIdle, type Collection };
