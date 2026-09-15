import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement, ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel, GtkTreeExpander } from "@gtkx/jsx/gtk";
import { screen } from "@gtkx/testing";
import { ItemFactory, renderListView } from "./list-view-render.js";

type TreeOptions = { isExpanderHidden?: boolean };

const EXPANDABLE_ROOT = "alpha";
const LEAF_ROOT = "beta";
const ROOT_NAMES = [EXPANDABLE_ROOT, LEAF_ROOT];
const CHILD_NAMES = ["alpha-child"];

const childModelFor = (item: GObject.Object): Gtk.StringList | null =>
    item instanceof Gtk.StringObject && item.getString() === EXPANDABLE_ROOT ? Gtk.StringList.new(CHILD_NAMES) : null;

const newTree = (): Gtk.TreeListModel =>
    Gtk.TreeListModel.new(Gtk.StringList.new(ROOT_NAMES), false, false, childModelFor);

const getRowText = (row: Gtk.TreeListRow): string => {
    const item = row.getItem();

    return item instanceof Gtk.StringObject ? item.getString() : "";
};

const renderTreeItem = (item: GObject.Object, isExpanderHidden: boolean): ReactNode => (
    item instanceof Gtk.TreeListRow
        ? (
                <GtkTreeExpander listRow={item} hideExpander={isExpanderHidden}>
                    <GtkLabel>{getRowText(item)}</GtkLabel>
                </GtkTreeExpander>
            )
        : null
);

const renderTree = (model: ReactElement, options: TreeOptions = {}): Promise<RefObject<Gtk.ListView | null>> =>
    renderListView({
        model,
        factory: (
            <ItemFactory
                renderItem={(item: GObject.Object) => renderTreeItem(item, options.isExpanderHidden ?? false)}
            />
        ),
    });

const findBoundExpander = async (text: string): Promise<Gtk.TreeExpander> => {
    const label = await screen.findByText(text);
    const expander = label.getAncestor(Gtk.TreeExpander);

    if (!(expander instanceof Gtk.TreeExpander)) {
        throw new TypeError(`No tree expander was bound for "${text}"`);
    }

    return expander;
};

export { CHILD_NAMES, EXPANDABLE_ROOT, LEAF_ROOT, ROOT_NAMES, findBoundExpander, newTree, renderTree };
