import * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { ListItem } from "./element-props.js";
import type { RowValue } from "./item-resolver.js";
import { treeItemMetadata } from "./list-item-flatten.js";

const emptyStrings = (count: number): string[] => new Array<string>(Math.max(0, count)).fill("");

/**
 * Re-tags existing position-only placeholders with fresh values when the structure is unchanged.
 *
 * When a controlled tree or section model is reused in place across an `items` change with the same
 * structural shape, this walks the new items in order and updates each materialized placeholder's
 * entry in `rowValues` so the resolver returns the current value. Placeholders for not-yet-realized
 * children are absent from `placeholdersById` and are tagged when their child store is created.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param items - The new declaration-ordered items carrying the fresh values.
 * @param rowValues - The map to update with the new values, keyed by placeholder GObject.
 * @param placeholdersById - The id-to-placeholder map populated when the model was built.
 */
export const retagRows = <T, S>(
    items: ListItem<T, S>[],
    rowValues: WeakMap<GObject.Object, RowValue<T, S>>,
    placeholdersById: Map<string, GObject.Object>,
): void => {
    const walk = (list: ListItem<T, S>[]): void => {
        for (const item of list) {
            const placeholder = placeholdersById.get(item.id);
            if (placeholder !== undefined) {
                rowValues.set(placeholder, {
                    id: item.id,
                    value: item.value,
                    isHeader: item.section === true,
                    metadata: treeItemMetadata(item),
                });
            }
            if (item.children !== undefined && item.children.length > 0) walk(item.children);
        }
    };
    walk(items);
};

/**
 * Creates a position-only `Gtk.StringList` sized to `count` empty entries.
 *
 * The list carries no real values; it exists solely so the GTK widget realizes the correct number
 * of containers. Real values live React-side keyed by position.
 *
 * @param count - The number of logical positions to back.
 * @returns A `Gtk.StringList` of `count` empty strings.
 */
export const createFlatModel = (count: number): Gtk.StringList => Gtk.StringList.new(emptyStrings(count));

/**
 * Resizes a position-only `Gtk.StringList` in place to `count` entries.
 *
 * The model GObject identity is preserved so the widget's `model` property and `getModel()` never
 * transiently null. Only the delta between the current and target counts is spliced.
 *
 * @param model - The position-only string list to resize.
 * @param count - The target number of logical positions.
 */
export const resizeFlatModel = (model: Gtk.StringList, count: number): void => {
    const target = Math.max(0, count);
    const current = model.getNItems();
    if (current === target) return;
    if (target > current) {
        model.splice(current, 0, emptyStrings(target - current));
        return;
    }
    model.splice(target, current - target, null);
};

/**
 * Creates one position-only placeholder GObject and tags it with its resolved row value.
 *
 * The placeholder is an empty `Gtk.StringObject`; the real value is recorded in `rowValues` so the
 * resolver recovers it synchronously when the row is realized, avoiding any placeholder state.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param row - The id, value, and header flag to tag onto the placeholder.
 * @param rowValues - The map populated with the placeholder's value.
 * @returns The tagged placeholder GObject.
 */
const createTaggedRow = <T, S>(
    row: RowValue<T, S>,
    rowValues: WeakMap<GObject.Object, RowValue<T, S>>,
    placeholdersById?: Map<string, GObject.Object>,
): GObject.Object => {
    const placeholder = Gtk.StringObject.new("");
    rowValues.set(placeholder, row);
    if (placeholdersById !== undefined) placeholdersById.set(row.id, placeholder);
    return placeholder;
};

const childModelOf = <T, S>(
    children: ListItem<T, S>[],
    rowValues: WeakMap<GObject.Object, RowValue<T, S>>,
    placeholdersById: Map<string, GObject.Object>,
): Gio.ListStore => {
    const store = Gio.ListStore.new(Gtk.StringObject.prototype.__gtype__);
    for (const child of children) {
        store.append(
            createTaggedRow(
                { id: child.id, value: child.value, isHeader: false, metadata: treeItemMetadata(child) },
                rowValues,
                placeholdersById,
            ),
        );
    }
    return store;
};

/**
 * Builds a `Gtk.TreeListModel` over position-only placeholder stores for a controlled tree.
 *
 * Each node is a tagged placeholder so the resolver recovers its value synchronously on bind. The
 * `createFunc` returns a child store for expandable nodes, recursively tagging descendants. GTK
 * holds only structure; values stay in `rowValues`.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param items - The root-level declaration-ordered items.
 * @param autoexpand - Whether all expandable rows expand automatically.
 * @param rowValues - The map populated with every node's value as it is materialized.
 * @returns A tree model backing the supplied items.
 */
export const createTreeModel = <T, S>(
    items: ListItem<T, S>[],
    autoexpand: boolean,
    rowValues: WeakMap<GObject.Object, RowValue<T, S>>,
    placeholdersById: Map<string, GObject.Object>,
): Gtk.TreeListModel => {
    const childrenByRow = new WeakMap<GObject.Object, ListItem<T, S>[]>();
    const root = Gio.ListStore.new(Gtk.StringObject.prototype.__gtype__);
    for (const item of items) {
        const placeholder = createTaggedRow(
            { id: item.id, value: item.value, isHeader: item.section === true, metadata: treeItemMetadata(item) },
            rowValues,
            placeholdersById,
        );
        if (item.children !== undefined && item.children.length > 0) {
            childrenByRow.set(placeholder, item.children);
        }
        root.append(placeholder);
    }
    const createFunc = (rowItem: GObject.Object): Gio.ListModel | null => {
        const children = childrenByRow.get(rowItem);
        if (children === undefined) return null;
        const store = childModelOf(children, rowValues, placeholdersById);
        for (let index = 0; index < children.length; index++) {
            const child = children[index];
            if (child !== undefined && child.children !== undefined && child.children.length > 0) {
                const placeholder = store.getItem(index);
                if (placeholder !== null) childrenByRow.set(placeholder, child.children);
            }
        }
        return store;
    };
    return Gtk.TreeListModel.new(root, false, autoexpand, createFunc);
};

/**
 * Builds a flattened section model from a `Gio.ListStore` of per-section position-only stores.
 *
 * Each section contributes a header placeholder followed by its children placeholders, all tagged
 * in `rowValues`; a `Gtk.FlattenListModel` presents them as one flat position-only model.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 * @param items - The top-level section items, each carrying its children.
 * @param rowValues - The map populated with every header and child value.
 * @returns A flattened model backing the sectioned items.
 */
export const createSectionModel = <T, S>(
    items: ListItem<T, S>[],
    rowValues: WeakMap<GObject.Object, RowValue<T, S>>,
    placeholdersById: Map<string, GObject.Object>,
): Gtk.FlattenListModel => {
    const sections = Gio.ListStore.new(Gio.ListStore.prototype.__gtype__);
    for (const section of items) {
        const store = Gio.ListStore.new(Gtk.StringObject.prototype.__gtype__);
        store.append(
            createTaggedRow(
                { id: section.id, value: section.value, isHeader: true, metadata: treeItemMetadata(section) },
                rowValues,
                placeholdersById,
            ),
        );
        if (section.children !== undefined) {
            for (const child of section.children) {
                store.append(
                    createTaggedRow(
                        { id: child.id, value: child.value, isHeader: false, metadata: treeItemMetadata(child) },
                        rowValues,
                        placeholdersById,
                    ),
                );
            }
        }
        sections.append(store);
    }
    return Gtk.FlattenListModel.new(sections);
};
