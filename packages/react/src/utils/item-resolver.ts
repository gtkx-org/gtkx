import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ListItem } from "./element-props.js";
import { flattenListItems, type TreeItemMetadata } from "./list-item-flatten.js";

const NO_TREE_METADATA: TreeItemMetadata = { hideExpander: false, indentForDepth: true, indentForIcon: true };

/**
 * The resolution of a single realized position into its value and structural metadata.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export interface Resolved<T = unknown, S = unknown> {
    value: T | S | undefined;
    /** Whether a value backs this position; `false` for a stale slot past the current contents. */
    present: boolean;
    isHeader: boolean;
    treeRow: Gtk.TreeListRow | null;
    metadata: TreeItemMetadata;
}

/**
 * The value index for one view: maps positions to values and ids to/from positions.
 *
 * The resolver is the data axis of the list. It never touches GTK realization; it answers
 * "what value sits at position p" and "what id is at position p" so the slots can render and the
 * selection layer can translate between ids and positions. A new `items` array (controlled) or a
 * fresh model (uncontrolled) yields a new resolver that flows into slots as an ordinary prop.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export interface ItemResolver<T = unknown, S = unknown> {
    resolve(position: number, treeRow: Gtk.TreeListRow | null): Resolved<T, S>;
    positionOf(id: string): number;
    idOf(position: number): string | undefined;
    count: number;
}

/**
 * The value carried by a realized tree row's underlying position-only GObject.
 *
 * When a controlled tree or section model is built, each placeholder GObject is tagged in this
 * map so that the resolver can recover the real value synchronously on the first bind, with no
 * asynchronous lookup and therefore no transient placeholder state.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export interface RowValue<T = unknown, S = unknown> {
    id: string;
    value: T | S;
    isHeader: boolean;
    metadata: TreeItemMetadata;
}

/**
 * Builds an `ItemResolver` for a controlled `items` array.
 *
 * For a flat or auto-expanded structure the values resolve from the precomputed flattened records.
 * For a lazily expanded tree the resolver consults `rowValues` keyed by the realized row's item
 * GObject so newly realized children resolve to their real value immediately.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param items - The declaration-ordered list to index, or `undefined` for an empty resolver.
 * @param flattenTreeChildren - Whether children are inlined into the records (auto-expanded).
 * @param rowValues - Tags realized tree/section row GObjects with their resolved value.
 * @returns A resolver indexing the supplied items.
 */
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
        resolve(position: number, treeRow: Gtk.TreeListRow | null): Resolved<T, S> {
            if (treeRow !== null && !flattenTreeChildren) {
                const rowItem = treeRow.getItem();
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

/**
 * Builds an `ItemResolver` for an uncontrolled external `Gio.ListModel`.
 *
 * Values come straight from `model.getItem(position)`, relying on FFI wrapper identity so the
 * renderer receives the original user object. Ids are derived from the position so selection
 * callbacks remain position-stable for the external model.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param model - The external model owning the values.
 * @param count - The current item count read from the model.
 * @returns A resolver reading values from the external model.
 */
export const createModelResolver = <T, S>(model: Gio.ListModel, count: number): ItemResolver<T, S> => {
    return {
        count,
        positionOf(id: string): number {
            const numeric = Number(id);
            return Number.isInteger(numeric) ? numeric : -1;
        },
        idOf(position: number): string {
            return String(position);
        },
        resolve(position: number, treeRow: Gtk.TreeListRow | null): Resolved<T, S> {
            const item = model.getItem(position);
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
