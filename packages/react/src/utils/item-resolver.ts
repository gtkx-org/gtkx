import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ListItem } from "./element-props.js";
import { flattenListItems, type TreeItemMetadata } from "./list-item-flatten.js";

const NO_TREE_METADATA: TreeItemMetadata = { hideExpander: false, indentForDepth: true, indentForIcon: true };

const treeItemCache = new WeakMap<Gtk.TreeListRow, GObject.Object>();

const treeRowItem = (treeRow: Gtk.TreeListRow): GObject.Object | null => {
    const cached = treeItemCache.get(treeRow);
    if (cached !== undefined) return cached;
    const item = treeRow.getItem();
    if (item !== null) treeItemCache.set(treeRow, item);
    return item;
};

export interface Resolved<T = unknown, S = unknown> {
    value: T | S | undefined;
    present: boolean;
    isHeader: boolean;
    treeRow: Gtk.TreeListRow | null;
    metadata: TreeItemMetadata;
}

export interface ItemResolver<T = unknown, S = unknown> {
    resolve(position: number, treeRow: Gtk.TreeListRow | null, boundItem: GObject.Object | null): Resolved<T, S>;
    positionOf(id: string): number;
    idOf(position: number): string | undefined;
    count: number;
}

export interface RowValue<T = unknown, S = unknown> {
    id: string;
    value: T | S;
    isHeader: boolean;
    metadata: TreeItemMetadata;
}

export const createControlledResolver = <T, S>(
    items: ListItem<T, S>[] | undefined,
    flattenTreeChildren: boolean,
    rowValues: WeakMap<GObject.Object, RowValue<T, S>>,
): ItemResolver<T, S> => {
    const flattened = flattenListItems(items, flattenTreeChildren);
    return {
        count: flattened.records.length,
        positionOf(id: string): number {
            const position = flattened.idToPosition.get(id);
            return position === undefined ? -1 : position;
        },
        idOf(position: number): string | undefined {
            return flattened.positionToId.get(position);
        },
        resolve(position: number, treeRow: Gtk.TreeListRow | null, _boundItem: GObject.Object | null): Resolved<T, S> {
            if (treeRow !== null && !flattenTreeChildren) {
                const rowItem = treeRowItem(treeRow);
                if (rowItem !== null) {
                    const tagged = rowValues.get(rowItem);
                    if (tagged !== undefined) {
                        return {
                            value: tagged.value,
                            present: true,
                            isHeader: tagged.isHeader,
                            treeRow,
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
                    treeRow,
                    metadata: NO_TREE_METADATA,
                };
            }
            return {
                value: record.value,
                present: true,
                isHeader: record.isHeader,
                treeRow,
                metadata: record.metadata,
            };
        },
    };
};

export const createModelResolver = <T, S>(model: Gio.ListModel): ItemResolver<T, S> => {
    return {
        get count(): number {
            return model.getNItems();
        },
        positionOf(id: string): number {
            const numeric = Number(id);
            return Number.isInteger(numeric) ? numeric : -1;
        },
        idOf(position: number): string {
            return String(position);
        },
        resolve(position: number, treeRow: Gtk.TreeListRow | null, boundItem: GObject.Object | null): Resolved<T, S> {
            const item = boundItem ?? model.getItem(position);
            return {
                value: (item ?? undefined) as T | undefined,
                present: item !== null,
                isHeader: false,
                treeRow,
                metadata: NO_TREE_METADATA,
            };
        },
    };
};

export const createSectionHeaderResolver = <T, S>(items: ListItem<T, S>[] | undefined): ItemResolver<T, S> => {
    const valueByStart = new Map<number, S>();
    let start = 0;
    for (const section of items ?? []) {
        if (section.section !== true) continue;
        valueByStart.set(start, section.value);
        start += section.children?.length ?? 0;
    }
    return {
        count: valueByStart.size,
        positionOf: () => -1,
        idOf: () => undefined,
        resolve(position: number): Resolved<T, S> {
            if (!valueByStart.has(position)) {
                return { value: undefined, present: false, isHeader: true, treeRow: null, metadata: NO_TREE_METADATA };
            }
            return {
                value: valueByStart.get(position),
                present: true,
                isHeader: true,
                treeRow: null,
                metadata: NO_TREE_METADATA,
            };
        },
    };
};
