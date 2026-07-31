import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkTreeExpander } from "@gtkx/jsx/gtk";
import { createPortal, useProperty } from "@gtkx/react";
import { memo, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ListItem, ListItemRenderArgs, ListItemRenderer, ListSectionRenderer } from "../types.js";
import type { Collection } from "./collection.js";
import { getId } from "./collection-model.js";

type CellSize = {
    width: number;
    height: number;
};

type CellHost = GObject.Object & {
    getChild: () => Gtk.Widget | null;
    setChild: (child: Gtk.Widget | null) => void;
};

type CellEntry<C extends CellHost> = {
    key: string;
    cell: C;
    item: GObject.Object | null;
    listeners: Set<() => void>;
    subscribe: (onChange: () => void) => () => void;
    getItem: () => GObject.Object | null;
};

type FactoryHandlers = {
    onSetup: (cell: GObject.Object) => void;
    onBind: (cell: GObject.Object) => void;
    onUnbind: (cell: GObject.Object) => void;
    onTeardown: (cell: GObject.Object) => void;
};

type CellStore<C extends CellHost> = {
    handlers: FactoryHandlers;
    setSize: (size: CellSize) => void;
    subscribe: (onChange: () => void) => () => void;
    getSnapshot: () => CellEntry<C>[];
};

type StoreState<C extends CellHost> = {
    size: CellSize;
    entries: Map<C, CellEntry<C>>;
    snapshot: CellEntry<C>[] | null;
    listeners: Set<() => void>;
    serial: number;
};

type CellGuard<C extends CellHost> = (value: GObject.Object) => value is C;

type ItemBodyOptions = {
    item: GObject.Object | null;
    position: number | undefined;
    row: Gtk.TreeListRow | null;
    isRowExpanded: boolean | undefined;
    render: ListItemRenderer<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type ItemCellProps = {
    entry: CellEntry<Gtk.ListItem>;
    render: ListItemRenderer<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type ItemPortalsProps = {
    store: CellStore<Gtk.ListItem>;
    render: ListItemRenderer<never>;
    collection: Collection;
    expandedIds?: string[] | null | undefined;
};

type HeaderCellProps = {
    entry: CellEntry<Gtk.ListHeader>;
    render: ListSectionRenderer<never>;
    collection: Collection;
};

type HeaderPortalsProps = {
    store: CellStore<Gtk.ListHeader>;
    render: ListSectionRenderer<never>;
    collection: Collection;
};

const ItemCell = memo(ItemCellImpl);
const HeaderCell = memo(HeaderCellImpl);

const isListItem = (value: GObject.Object): value is Gtk.ListItem => value instanceof Gtk.ListItem;
const isListHeader = (value: GObject.Object): value is Gtk.ListHeader => value instanceof Gtk.ListHeader;

const placeholder = (size: CellSize): Gtk.Widget =>
    new Gtk.Box({ widthRequest: size.width, heightRequest: size.height });

function notifyEntry<C extends CellHost>(entry: CellEntry<C>): void {
    for (const listener of entry.listeners) {
        listener();
    }
}

function notifyRoster<C extends CellHost>(state: StoreState<C>): void {
    state.snapshot = null;

    for (const listener of state.listeners) {
        listener();
    }
}

function createEntry<C extends CellHost>(state: StoreState<C>, cell: C): CellEntry<C> {
    state.serial += 1;

    const entry: CellEntry<C> = {
        key: `gtkx-cell-${String(state.serial)}`,
        cell,
        item: null,
        listeners: new Set(),
        subscribe: (onChange) => {
            entry.listeners.add(onChange);

            return () => {
                entry.listeners.delete(onChange);
            };
        },
        getItem: () => entry.item,
    };

    return entry;
}

function setupCell<C extends CellHost>(state: StoreState<C>, cell: C): void {
    cell.setChild(placeholder(state.size));
    state.entries.set(cell, createEntry(state, cell));
    notifyRoster(state);
}

function teardownCell<C extends CellHost>(state: StoreState<C>, cell: C): void {
    if (state.entries.delete(cell)) {
        notifyRoster(state);
    }
}

function writeBinding<C extends CellHost>(state: StoreState<C>, cell: C, item: GObject.Object | null): void {
    const entry = state.entries.get(cell);

    if (entry === undefined) {
        return;
    }

    entry.item = item;
    notifyEntry(entry);
}

function boundItem(cell: CellHost): GObject.Object | null {
    if (cell instanceof Gtk.ListItem) {
        return cell.getItem();
    }

    return cell instanceof Gtk.ListHeader ? cell.getItem() : null;
}

function bindCell<C extends CellHost>(state: StoreState<C>, cell: C): void {
    if (cell.getChild() === null) {
        cell.setChild(placeholder(state.size));
    }

    writeBinding(state, cell, boundItem(cell));
}

function subscribeRoster<C extends CellHost>(state: StoreState<C>, onChange: () => void): () => void {
    state.listeners.add(onChange);

    return () => {
        state.listeners.delete(onChange);
    };
}

function rosterSnapshot<C extends CellHost>(state: StoreState<C>): CellEntry<C>[] {
    state.snapshot ??= state.entries.values().toArray();

    return state.snapshot;
}

function guarded<C extends CellHost>(isCell: CellGuard<C>, run: (cell: C) => void): (cell: GObject.Object) => void {
    return (cell) => {
        if (isCell(cell)) {
            run(cell);
        }
    };
}

function createHandlers<C extends CellHost>(state: StoreState<C>, isCell: CellGuard<C>): FactoryHandlers {
    return {
        onSetup: guarded(isCell, (cell) => {
            setupCell(state, cell);
        }),
        onBind: guarded(isCell, (cell) => {
            bindCell(state, cell);
        }),
        onUnbind: guarded(isCell, (cell) => {
            writeBinding(state, cell, null);
        }),
        onTeardown: guarded(isCell, (cell) => {
            teardownCell(state, cell);
        }),
    };
}

function createCellStore<C extends CellHost>(isCell: CellGuard<C>, size: CellSize): CellStore<C> {
    const state: StoreState<C> = {
        size,
        entries: new Map(),
        snapshot: null,
        listeners: new Set(),
        serial: 0,
    };

    return {
        handlers: createHandlers(state, isCell),
        setSize: (next) => {
            state.size = next;
        },
        subscribe: (onChange) => subscribeRoster(state, onChange),
        getSnapshot: () => rosterSnapshot(state),
    };
}

function useCellStore<C extends CellHost>(isCell: CellGuard<C>, size: CellSize): CellStore<C> {
    const [store] = useState(() => createCellStore(isCell, size));

    useLayoutEffect(() => {
        store.setSize(size);
    });

    return store;
}

function useItemCells(size: CellSize): CellStore<Gtk.ListItem> {
    return useCellStore(isListItem, size);
}

function useHeaderCells(size: CellSize): CellStore<Gtk.ListHeader> {
    return useCellStore(isListHeader, size);
}

function isRowWanted(options: ItemBodyOptions, item: ListItem): boolean {
    const { expandedIds } = options;

    return expandedIds == null ? options.isRowExpanded === true : expandedIds.includes(item.id);
}

function itemArgs(item: ListItem, options: ItemBodyOptions): ListItemRenderArgs<unknown> {
    const args: ListItemRenderArgs<unknown> = { item: item.value, index: options.position ?? 0 };
    const row = options.row;

    if (row === null) {
        return args;
    }

    args.depth = row.getDepth();

    if (row.isExpandable()) {
        args.isExpanded = isRowWanted(options, item);
    }

    return args;
}

function wrapExpander(item: ListItem, row: Gtk.TreeListRow | null, content: ReactNode): ReactNode {
    const expander: ReactNode =
        row === null
            ? (
                    content
                )
            : (
                    <GtkTreeExpander
                        listRow={row}
                        hideExpander={item.hideExpander ?? false}
                        indentForDepth={item.indentForDepth ?? true}
                        indentForIcon={item.indentForIcon ?? true}
                    >
                        {content}
                    </GtkTreeExpander>
                );

    return expander;
}

function itemBody(options: ItemBodyOptions): ReactNode {
    const id = getId(options.item);
    const item = id === null ? undefined : options.collection.itemFor(id);

    if (item === undefined) {
        return null;
    }

    const render = options.render as ListItemRenderer<unknown>;

    return wrapExpander(item, options.row, render(itemArgs(item, options)));
}

function ItemCellImpl({ entry, render, collection, expandedIds }: ItemCellProps): ReactNode {
    const item = useSyncExternalStore(entry.subscribe, entry.getItem);
    const position = useProperty(entry.cell, "position");
    const row = item instanceof Gtk.TreeListRow ? item : null;
    const isRowExpanded = useProperty(row, "expanded");
    const body = itemBody({ item, position, row, isRowExpanded, render, collection, expandedIds });

    return createPortal(body, entry.cell, entry.key);
}

function HeaderCellImpl({ entry, render, collection }: HeaderCellProps): ReactNode {
    const item = useSyncExternalStore(entry.subscribe, entry.getItem);
    const id = getId(item);
    const renderHeader = render as ListSectionRenderer<unknown>;
    const body = id === null ? null : renderHeader({ section: collection.sectionFor(id) });

    return createPortal(body, entry.cell, entry.key);
}

function usePortalEntries<C extends CellHost>(store: CellStore<C>): CellEntry<C>[] {
    return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

const ItemPortals = ({ store, render, collection, expandedIds }: ItemPortalsProps): ReactNode =>
    usePortalEntries(store).map((entry) => (
        <ItemCell key={entry.key} entry={entry} render={render} collection={collection} expandedIds={expandedIds} />
    ));

const HeaderPortals = ({ store, render, collection }: HeaderPortalsProps): ReactNode =>
    usePortalEntries(store).map((entry) => (
        <HeaderCell key={entry.key} entry={entry} render={render} collection={collection} />
    ));

export {
    useItemCells,
    useHeaderCells,
    ItemPortals,
    HeaderPortals,
    type CellSize,
    type CellStore,
};
