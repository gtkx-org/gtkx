import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { createPortal } from "@gtkx/react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { HeaderRenderer, Item, ItemRenderer, RenderItemArgs } from "../types.js";
import type { CollectionModel } from "./collection-model.js";

export type CellSize = { width: number; height: number };

export type CellRecord = {
    key: number;
    kind: "item" | "header";
    cell: GObject.Object;
    target: GObject.Object;
    holder: GObject.Object;
    row: Gtk.TreeListRow | null;
    slot: string | null;
    position: () => number;
};

export type FactoryHandlers = {
    onSetup: (cell: GObject.Object) => void;
    onBind: (cell: GObject.Object) => void;
    onUnbind: (cell: GObject.Object) => void;
    onTeardown: (cell: GObject.Object) => void;
};

export type CellRenderers = {
    item: (record: CellRecord) => ReactNode;
    header: (record: CellRecord) => ReactNode;
};

export type Cells = {
    item: FactoryHandlers;
    header: FactoryHandlers;
    slot: (id: string) => FactoryHandlers;
    refresh: () => void;
    portals: (renderers: CellRenderers) => ReactNode[];
};

type CellsOptions = {
    collection: CollectionModel;
    size: CellSize;
};

type CellsState = {
    options: () => CellsOptions;
    records: Map<GObject.Object, CellRecord>;
    serial: number;
    refresh: () => void;
};

const placeholder = (size: CellSize): Gtk.Widget =>
    new Gtk.Box({ widthRequest: size.width, heightRequest: size.height });

const applyExpanderFlags = (expander: Gtk.TreeExpander, item: Item<unknown>): void => {
    expander.setHideExpander(item.hideExpander ?? false);
    expander.setIndentForDepth(item.indentForDepth ?? true);
    expander.setIndentForIcon(item.indentForIcon ?? true);
};

const bindExpander = (cell: Gtk.ListItem, row: Gtk.TreeListRow, options: CellsOptions): Gtk.TreeExpander | null => {
    const holder = row.getItem();
    if (holder === null) return null;
    const child = cell.getChild();
    let expander: Gtk.TreeExpander;
    if (child instanceof Gtk.TreeExpander) {
        expander = child;
    } else {
        expander = new Gtk.TreeExpander({});
        expander.setChild(placeholder(options.size));
        cell.setChild(expander);
    }
    expander.setListRow(row);
    const entry = options.collection.entryOf(holder);
    if (entry !== undefined) applyExpanderFlags(expander, entry.item);
    if (expander.getChild() === null) expander.setChild(placeholder(options.size));
    return expander;
};

const addRecord = (state: CellsState, record: Omit<CellRecord, "key">): void => {
    state.serial += 1;
    state.records.set(record.cell, { ...record, key: state.serial });
    state.refresh();
};

const removeRecord = (state: CellsState, cell: GObject.Object): void => {
    if (state.records.delete(cell)) state.refresh();
};

const bindItem = (state: CellsState, slot: string | null, cell: Gtk.ListItem): void => {
    const bound = cell.getItem();
    if (bound === null) return;
    const options = state.options();
    let holder = bound;
    let row: Gtk.TreeListRow | null = null;
    let target: GObject.Object = cell;
    if (bound instanceof Gtk.TreeListRow) {
        const expander = bindExpander(cell, bound, options);
        const inner = bound.getItem();
        if (expander === null || inner === null) return;
        row = bound;
        holder = inner;
        target = expander;
    } else if (cell.getChild() === null) {
        cell.setChild(placeholder(options.size));
    }
    addRecord(state, { kind: "item", cell, target, holder, row, slot, position: () => cell.getPosition() });
};

const itemHandlers = (state: CellsState, slot: string | null): FactoryHandlers => ({
    onSetup: (cell) => {
        if (cell instanceof Gtk.ListItem) cell.setChild(placeholder(state.options().size));
    },
    onBind: (cell) => {
        if (cell instanceof Gtk.ListItem) bindItem(state, slot, cell);
    },
    onUnbind: (cell) => {
        const child = cell instanceof Gtk.ListItem ? cell.getChild() : null;
        if (child instanceof Gtk.TreeExpander) child.setListRow(null);
        removeRecord(state, cell);
    },
    onTeardown: (cell) => removeRecord(state, cell),
});

const headerHandlers = (state: CellsState): FactoryHandlers => ({
    onSetup: (header) => {
        if (header instanceof Gtk.ListHeader) header.setChild(placeholder(state.options().size));
    },
    onBind: (header) => {
        if (!(header instanceof Gtk.ListHeader)) return;
        const holder = header.getItem();
        if (holder === null) return;
        if (header.getChild() === null) header.setChild(placeholder(state.options().size));
        addRecord(state, {
            kind: "header",
            cell: header,
            target: header,
            holder,
            row: null,
            slot: null,
            position: () => header.getStart(),
        });
    },
    onUnbind: (header) => removeRecord(state, header),
    onTeardown: (header) => removeRecord(state, header),
});

const createCells = (state: CellsState): Cells => {
    const slots = new Map<string, FactoryHandlers>();
    return {
        item: itemHandlers(state, null),
        header: headerHandlers(state),
        slot: (id) => {
            let handlers = slots.get(id);
            if (handlers === undefined) {
                handlers = itemHandlers(state, id);
                slots.set(id, handlers);
            }
            return handlers;
        },
        refresh: state.refresh,
        portals: (renderers) =>
            [...state.records.values()].map((record) =>
                createPortal(renderers[record.kind](record), record.target, `gtkx-cell-${record.key}`),
            ),
    };
};

export const useCells = (options: CellsOptions): Cells => {
    const latest = useRef(options);
    latest.current = options;
    const [, setVersion] = useState(0);
    const held = useRef<Cells | null>(null);
    held.current ??= createCells({
        options: () => latest.current,
        records: new Map(),
        serial: 0,
        refresh: () => setVersion((version) => version + 1),
    });
    return held.current;
};

export type ItemArgsOptions = {
    collection: CollectionModel;
    expandedIds?: string[] | null | undefined;
};

export const renderItemArgs = (record: CellRecord, options: ItemArgsOptions): RenderItemArgs<unknown> | null => {
    const entry = options.collection.entryOf(record.holder);
    if (entry === undefined) return null;
    const args: RenderItemArgs<unknown> = { item: entry.item.value, index: record.position() };
    if (record.row !== null) {
        args.depth = record.row.getDepth();
        if (record.row.isExpandable()) {
            args.isExpanded =
                options.expandedIds != null ? options.expandedIds.includes(entry.id) : record.row.getExpanded();
        }
    }
    return args;
};

export const headerRenderer = (
    collection: CollectionModel,
    renderHeader: HeaderRenderer<never> | null | undefined,
): ((record: CellRecord) => ReactNode) => {
    if (renderHeader == null) return () => null;
    const render = renderHeader as HeaderRenderer<unknown>;
    return (record) => render({ section: collection.entryOf(record.holder)?.sectionValue });
};

type CollectionRenderersOptions = ItemArgsOptions & {
    renderItem: ItemRenderer<never>;
    renderHeader?: HeaderRenderer<never> | null | undefined;
};

export const collectionRenderers = (options: CollectionRenderersOptions): CellRenderers => {
    const render = options.renderItem as ItemRenderer<unknown>;
    return {
        item: (record) => {
            const args = renderItemArgs(record, options);
            return args === null ? null : render(args);
        },
        header: headerRenderer(options.collection, options.renderHeader),
    };
};
