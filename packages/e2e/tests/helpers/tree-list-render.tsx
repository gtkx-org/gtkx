import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { waitFor } from "@gtkx/testing";
import { expect } from "vitest";
import { renderListView } from "./list-view-render.js";

type TreeOptions = { isExpanderHidden?: boolean };

const EXPANDABLE_ROOT = "alpha";
const LEAF_ROOT = "beta";
const ROOT_NAMES = [EXPANDABLE_ROOT, LEAF_ROOT];
const CHILD_NAMES = ["alpha-child"];
const boundExpanders: Map<string, Gtk.TreeExpander> = new Map();
const treeOptions: TreeOptions = {};

const childModelFor = (item: GObject.Object): Gtk.StringList | null =>
    item instanceof Gtk.StringObject && item.getString() === EXPANDABLE_ROOT ? Gtk.StringList.new(CHILD_NAMES) : null;

const newTree = (): Gtk.TreeListModel =>
    Gtk.TreeListModel.new(Gtk.StringList.new(ROOT_NAMES), false, false, childModelFor);

const getRowText = (row: Gtk.TreeListRow): string => {
    const item = row.getItem();

    return item instanceof Gtk.StringObject ? item.getString() : "";
};

const getItemExpander = (object: GObject.Object): Gtk.TreeExpander | null => {
    const child = object instanceof Gtk.ListItem ? object.getChild() : null;

    return child instanceof Gtk.TreeExpander ? child : null;
};

const getItemRow = (object: GObject.Object): Gtk.TreeListRow | null => {
    const item = object instanceof Gtk.ListItem ? object.getItem() : null;

    return item instanceof Gtk.TreeListRow ? item : null;
};

const handleSetup = (object: GObject.Object): void => {
    if (!(object instanceof Gtk.ListItem)) {
        return;
    }

    const expander = new Gtk.TreeExpander();
    expander.setChild(new Gtk.Label());
    expander.setHideExpander(treeOptions.isExpanderHidden ?? false);
    object.setChild(expander);
};

const handleBind = (object: GObject.Object): void => {
    const expander = getItemExpander(object);
    const row = getItemRow(object);

    if (expander === null || row === null) {
        return;
    }

    const text = getRowText(row);
    expander.setListRow(row);

    if (expander.getChild() instanceof Gtk.Label) {
        (expander.getChild() as Gtk.Label).setLabel(text);
    }

    boundExpanders.set(text, expander);
};

const resetTree = (): void => {
    boundExpanders.clear();
    treeOptions.isExpanderHidden = false;
};

const renderTree = (model: ReactElement, options: TreeOptions = {}): Promise<RefObject<Gtk.ListView | null>> => {
    treeOptions.isExpanderHidden = options.isExpanderHidden ?? false;

    return renderListView({
        model,
        factory: <GtkSignalListItemFactory onSetup={handleSetup} onBind={handleBind} />,
    });
};

const findBoundExpander = async (text: string): Promise<Gtk.TreeExpander> => {
    await waitFor(() => {
        expect(boundExpanders.has(text)).toBe(true);
    });

    const expander = boundExpanders.get(text);

    if (expander === undefined) {
        throw new TypeError(`No tree expander was bound for "${text}"`);
    }

    return expander;
};

export { CHILD_NAMES, EXPANDABLE_ROOT, LEAF_ROOT, ROOT_NAMES, findBoundExpander, newTree, renderTree, resetTree };
