import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type { ItemNode } from "../types.js";
import type { CellTracker } from "./cell-tracker.js";
import type { CollectionSource } from "./collection-source.js";

export type SizeEstimates = {
    width: number;
    height: number;
};

export type FactoryContext = {
    tracker: CellTracker;
    source: () => CollectionSource | null;
    estimates: () => SizeEstimates;
};

const placeholder = (estimates: SizeEstimates): Gtk.Widget =>
    new Gtk.Box({ widthRequest: estimates.width, heightRequest: estimates.height });

const ensureExpander = (cell: Gtk.ListItem, estimates: SizeEstimates): Gtk.TreeExpander => {
    const child = cell.getChild();
    if (child instanceof Gtk.TreeExpander) return child;
    const expander = new Gtk.TreeExpander({});
    expander.setChild(placeholder(estimates));
    cell.setChild(expander);
    return expander;
};

const applyExpanderFlags = (expander: Gtk.TreeExpander, node: ItemNode<unknown>): void => {
    expander.setHideExpander(node.hideExpander ?? false);
    expander.setIndentForDepth(node.indentForDepth ?? true);
    expander.setIndentForIcon(node.indentForIcon ?? true);
};

const bindTreeCell = (context: FactoryContext, cell: Gtk.ListItem, row: Gtk.TreeListRow): GObject.Object | null => {
    const holder = row.getItem();
    if (holder === null) return null;
    const expander = ensureExpander(cell, context.estimates());
    expander.setListRow(row);
    const entry = context.source()?.entryOfHolder(holder);
    if (entry !== undefined) applyExpanderFlags(expander, entry.node);
    if (expander.getChild() === null) expander.setChild(placeholder(context.estimates()));
    return expander;
};

const bindItemCell = (context: FactoryContext, slot: string | null, cell: Gtk.ListItem): void => {
    const item = cell.getItem();
    if (item === null) return;
    let holder = item;
    let row: Gtk.TreeListRow | null = null;
    let target: GObject.Object = cell;
    if (item instanceof Gtk.TreeListRow) {
        const expander = bindTreeCell(context, cell, item);
        const inner = item.getItem();
        if (expander === null || inner === null) return;
        row = item;
        holder = inner;
        target = expander;
    } else if (cell.getChild() === null) {
        cell.setChild(placeholder(context.estimates()));
    }
    context.tracker.add({ kind: "item", cell, target, holder, row, slot, position: () => cell.getPosition() });
};

const unbindItemCell = (context: FactoryContext, cell: Gtk.ListItem): void => {
    const child = cell.getChild();
    if (child instanceof Gtk.TreeExpander) child.setListRow(null);
    context.tracker.remove(cell);
};

export const createItemFactory = (context: FactoryContext, slot: string | null = null): Gtk.SignalListItemFactory => {
    const factory = new Gtk.SignalListItemFactory({});
    factory.on("setup", (cell: GObject.Object) => {
        if (cell instanceof Gtk.ListItem) cell.setChild(placeholder(context.estimates()));
    });
    factory.on("bind", (cell: GObject.Object) => {
        if (cell instanceof Gtk.ListItem) bindItemCell(context, slot, cell);
    });
    factory.on("unbind", (cell: GObject.Object) => {
        if (cell instanceof Gtk.ListItem) unbindItemCell(context, cell);
    });
    factory.on("teardown", (cell: GObject.Object) => {
        context.tracker.remove(cell);
    });
    return factory;
};

const bindHeaderCell = (context: FactoryContext, header: Gtk.ListHeader): void => {
    const holder = header.getItem();
    if (holder === null) return;
    if (header.getChild() === null) header.setChild(placeholder(context.estimates()));
    context.tracker.add({
        kind: "header",
        cell: header,
        target: header,
        holder,
        row: null,
        slot: null,
        position: () => header.getStart(),
    });
};

export const createHeaderFactory = (context: FactoryContext): Gtk.SignalListItemFactory => {
    const factory = new Gtk.SignalListItemFactory({});
    factory.on("setup", (header: GObject.Object) => {
        if (header instanceof Gtk.ListHeader) header.setChild(placeholder(context.estimates()));
    });
    factory.on("bind", (header: GObject.Object) => {
        if (header instanceof Gtk.ListHeader) bindHeaderCell(context, header);
    });
    factory.on("unbind", (header: GObject.Object) => {
        context.tracker.remove(header);
    });
    factory.on("teardown", (header: GObject.Object) => {
        context.tracker.remove(header);
    });
    return factory;
};
