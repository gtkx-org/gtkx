import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ItemNode, SectionNode } from "../types.js";
import { countDescendants, flattenListItems, type TreeItemMetadata } from "./list-item-flatten.js";

const NO_TREE_METADATA: TreeItemMetadata = { hideExpander: false, indentForDepth: true, indentForIcon: true };

const treeItemCache = new WeakMap<Gtk.TreeListRow, GObject.Object>();

const treeRowItem = (treeRow: Gtk.TreeListRow): GObject.Object | null => {
    const cached = treeItemCache.get(treeRow);
    if (cached !== undefined) return cached;
    const item = treeRow.getItem();
    if (item !== null) treeItemCache.set(treeRow, item);
    return item;
};

export type Resolved<T = unknown, S = unknown> = {
    value: T | S | undefined;
    present: boolean;
    isHeader: boolean;
    metadata: TreeItemMetadata;
};

export type ItemResolver<T = unknown, S = unknown> = {
    resolve(position: number, treeRow: Gtk.TreeListRow | null): Resolved<T, S>;
    positionOfId(id: string): number;
    idOf(position: number): string | undefined;
};

export type RowValue<T = unknown> = {
    id: string;
    value: T;
    metadata: TreeItemMetadata;
};

export const rowIdOf = <T>(
    rowValues: WeakMap<GObject.Object, RowValue<T>>,
    row: Gtk.TreeListRow,
): string | undefined => {
    const item = row.getItem();
    return item === null ? undefined : rowValues.get(item)?.id;
};

export const createItemResolver = <T, S>(
    items: ItemNode<T>[] | undefined,
    flattenTreeChildren: boolean,
    rowValues: WeakMap<GObject.Object, RowValue<T>>,
): ItemResolver<T, S> => {
    const flattened = flattenListItems(items, flattenTreeChildren);
    return {
        positionOfId(id: string): number {
            const position = flattened.idToPosition.get(id);
            return position === undefined ? -1 : position;
        },
        idOf(position: number): string | undefined {
            return flattened.positionToId.get(position);
        },
        resolve(position: number, treeRow: Gtk.TreeListRow | null): Resolved<T, S> {
            if (treeRow !== null && !flattenTreeChildren) {
                const rowItem = treeRowItem(treeRow);
                if (rowItem !== null) {
                    const tagged = rowValues.get(rowItem);
                    if (tagged !== undefined) {
                        return {
                            value: tagged.value,
                            present: true,
                            isHeader: false,
                            metadata: tagged.metadata,
                        };
                    }
                }
            }
            const record = flattened.records[position];
            if (record === undefined) {
                return {
                    value: undefined,
                    present: false,
                    isHeader: false,
                    metadata: NO_TREE_METADATA,
                };
            }
            return {
                value: record.value,
                present: true,
                isHeader: false,
                metadata: record.metadata,
            };
        },
    };
};

export const createSectionHeaderResolver = <T, S>(sections: SectionNode<S, T>[] | undefined): ItemResolver<T, S> => {
    const valueByStart = new Map<number, S>();
    let start = 0;
    for (const section of sections ?? []) {
        valueByStart.set(start, section.value);
        start += countDescendants(section.data);
    }
    return {
        positionOfId: () => -1,
        idOf: () => undefined,
        resolve(position: number): Resolved<T, S> {
            if (!valueByStart.has(position)) {
                return { value: undefined, present: false, isHeader: true, metadata: NO_TREE_METADATA };
            }
            return {
                value: valueByStart.get(position),
                present: true,
                isHeader: true,
                metadata: NO_TREE_METADATA,
            };
        },
    };
};

export const createTreeResolver = <T, S>(
    items: ItemNode<T>[] | undefined,
    rowValues: WeakMap<GObject.Object, RowValue<T>>,
    model: Gtk.TreeListModel,
): ItemResolver<T, S> => {
    const base = createItemResolver<T, S>(items, false, rowValues);
    return {
        resolve: base.resolve,
        idOf: (position: number): string | undefined => {
            const row = model.getRow(position);
            return row === null ? undefined : rowIdOf(rowValues, row);
        },
        positionOfId: (id: string): number => {
            const count = model.getNItems();
            for (let position = 0; position < count; position++) {
                const row = model.getRow(position);
                if (row !== null && rowIdOf(rowValues, row) === id) return position;
            }
            return -1;
        },
    };
};
