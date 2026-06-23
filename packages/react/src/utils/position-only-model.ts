import * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { ListItem } from "./element-props.js";
import type { RowValue } from "./item-resolver.js";
import { treeItemMetadata } from "./list-item-flatten.js";

const emptyStrings = (count: number): string[] => new Array<string>(Math.max(0, count)).fill("");

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

export const createFlatModel = (count: number): Gtk.StringList => Gtk.StringList.new(emptyStrings(count));

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

export const createSectionModel = <T, S>(items: ListItem<T, S>[]): Gtk.FlattenListModel => {
    const sections = Gio.ListStore.new(Gtk.StringList.prototype.__gtype__);
    for (const section of items) {
        sections.append(Gtk.StringList.new(emptyStrings(section.children?.length ?? 0)));
    }
    return Gtk.FlattenListModel.new(sections);
};
