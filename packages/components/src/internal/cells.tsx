import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement, ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkSignalListItemFactory, GtkTreeExpander } from "@gtkx/jsx/gtk";
import { createPortal, useProperty } from "@gtkx/react";
import { setObjectProperty, t } from "@gtkx/runtime";
import { memo, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type {
    ListItem,
    ListItemRenderArgs,
    ListItemRenderer,
    ListRowProps,
    ListRowPropsResolver,
    ListSectionRenderer,
} from "../types.js";
import type { Collection } from "./collection.js";
import { slotRefFor } from "./collection-model.js";

type CellSize = {
    width: number;
    height: number;
};

type RosterHost = GObject.Object & {
    getItem: () => GObject.Object | null;
};

type CellHost = RosterHost & {
    getChild: () => Gtk.Widget | null;
    setChild: (child: Gtk.Widget | null) => void;
};

type RosterEntry<H extends RosterHost> = {
    key: string;
    host: H;
    item: GObject.Object | null;
    listeners: Set<() => void>;
    subscribe: (onChange: () => void) => () => void;
    getItem: () => GObject.Object | null;
};

type FactoryHandlers = {
    onSetup: (host: GObject.Object) => void;
    onBind: (host: GObject.Object) => void;
    onUnbind: (host: GObject.Object) => void;
    onTeardown: (host: GObject.Object) => void;
};

type Roster<H extends RosterHost> = {
    handlers: FactoryHandlers;
    setSize: (size: CellSize) => void;
    subscribe: (onChange: () => void) => () => void;
    getSnapshot: () => RosterEntry<H>[];
};

type RosterGuard<H extends RosterHost> = (value: GObject.Object) => value is H;

type RosterOptions<H extends RosterHost> = {
    isHost: RosterGuard<H>;
    prepare?: ((host: H, size: CellSize) => void) | undefined;
};

type RosterState<H extends RosterHost> = RosterOptions<H> & {
    size: CellSize;
    entries: Map<H, RosterEntry<H>>;
    snapshot: RosterEntry<H>[] | null;
    listeners: Set<() => void>;
    serial: number;
};

type ResolvedRowProps = {
    accessibleLabel: string | null;
    accessibleDescription: string | null;
    isActivatable: boolean;
    isFocusable: boolean;
    isSelectable: boolean;
};

type ItemSlotOptions = {
    item: GObject.Object | null;
    position: number | undefined;
    row: Gtk.TreeListRow | null;
    isRowExpanded: boolean | undefined;
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type PositionedHost = Gtk.ListItem | Gtk.ColumnViewRow;

type ItemSlot = {
    item: ListItem;
    row: Gtk.TreeListRow | null;
    args: ListItemRenderArgs<unknown>;
};

type ItemCellProps = {
    entry: RosterEntry<Gtk.ListItem>;
    render: ListItemRenderer<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type ItemPortalsProps = {
    store: Roster<Gtk.ListItem>;
    render: ListItemRenderer<never>;
    collection: Collection;
    expandedIds?: string[] | null | undefined;
};

type ItemRowProps = {
    entry: RosterEntry<Gtk.ColumnViewRow>;
    getRowProps: ListRowPropsResolver<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type RowPortalsProps = {
    store: Roster<Gtk.ColumnViewRow>;
    getRowProps: ListRowPropsResolver<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type HeaderCellProps = {
    entry: RosterEntry<Gtk.ListHeader>;
    render: ListSectionRenderer<never>;
    collection: Collection;
};

type HeaderPortalsProps = {
    store: Roster<Gtk.ListHeader>;
    render: ListSectionRenderer<never>;
    collection: Collection;
};

type SectionHeaderSlot = {
    factoryProps: { headerFactory?: ReactElement };
    portals: ReactNode;
};

type RowSlot = {
    factoryProps: { rowFactory?: ReactElement };
    portals: ReactNode;
};

const ItemCell = memo(ItemCellImpl);
const ItemRow = memo(ItemRowImpl);
const HeaderCell = memo(HeaderCellImpl);
const CELL_OPTIONS: RosterOptions<Gtk.ListItem> = { isHost: isListItem, prepare: prepareCell };
const HEADER_OPTIONS: RosterOptions<Gtk.ListHeader> = { isHost: isListHeader, prepare: prepareCell };
const ROW_OPTIONS: RosterOptions<Gtk.ColumnViewRow> = { isHost: isColumnViewRow };
const NO_SIZE: CellSize = { width: -1, height: -1 };
const NO_ROW_PROPS: ListRowProps = {};
const ROW_TEXT_DESCRIPTOR = t.string("borrowed");

const placeholder = (size: CellSize): Gtk.Widget =>
    new Gtk.Box({ widthRequest: size.width, heightRequest: size.height });

function isListItem(value: GObject.Object): value is Gtk.ListItem {
    return value instanceof Gtk.ListItem;
}

function isListHeader(value: GObject.Object): value is Gtk.ListHeader {
    return value instanceof Gtk.ListHeader;
}

function isColumnViewRow(value: GObject.Object): value is Gtk.ColumnViewRow {
    return value instanceof Gtk.ColumnViewRow;
}

function prepareCell(host: CellHost, size: CellSize): void {
    if (host.getChild() === null) {
        host.setChild(placeholder(size));
    }
}

function notifyEntry<H extends RosterHost>(entry: RosterEntry<H>): void {
    for (const listener of entry.listeners) {
        listener();
    }
}

function notifyRoster<H extends RosterHost>(state: RosterState<H>): void {
    state.snapshot = null;

    for (const listener of state.listeners) {
        listener();
    }
}

function createEntry<H extends RosterHost>(state: RosterState<H>, host: H): RosterEntry<H> {
    state.serial += 1;

    const entry: RosterEntry<H> = {
        key: `gtkx-cell-${String(state.serial)}`,
        host,
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

function setupHost<H extends RosterHost>(state: RosterState<H>, host: H): void {
    state.prepare?.(host, state.size);
    state.entries.set(host, createEntry(state, host));
    notifyRoster(state);
}

function teardownHost<H extends RosterHost>(state: RosterState<H>, host: H): void {
    if (state.entries.delete(host)) {
        notifyRoster(state);
    }
}

function writeBinding<H extends RosterHost>(state: RosterState<H>, host: H, item: GObject.Object | null): void {
    const entry = state.entries.get(host);

    if (entry === undefined) {
        return;
    }

    entry.item = item;
    notifyEntry(entry);
}

function bindHost<H extends RosterHost>(state: RosterState<H>, host: H): void {
    state.prepare?.(host, state.size);
    writeBinding(state, host, host.getItem());
}

function subscribeRoster<H extends RosterHost>(state: RosterState<H>, onChange: () => void): () => void {
    state.listeners.add(onChange);

    return () => {
        state.listeners.delete(onChange);
    };
}

function rosterSnapshot<H extends RosterHost>(state: RosterState<H>): RosterEntry<H>[] {
    state.snapshot ??= state.entries.values().toArray();

    return state.snapshot;
}

function guarded<H extends RosterHost>(isHost: RosterGuard<H>, run: (host: H) => void): (host: GObject.Object) => void {
    return (host) => {
        if (isHost(host)) {
            run(host);
        }
    };
}

function createHandlers<H extends RosterHost>(state: RosterState<H>): FactoryHandlers {
    const { isHost } = state;

    return {
        onSetup: guarded(isHost, (host) => {
            setupHost(state, host);
        }),
        onBind: guarded(isHost, (host) => {
            bindHost(state, host);
        }),
        onUnbind: guarded(isHost, (host) => {
            writeBinding(state, host, null);
        }),
        onTeardown: guarded(isHost, (host) => {
            teardownHost(state, host);
        }),
    };
}

function createRoster<H extends RosterHost>(options: RosterOptions<H>, size: CellSize): Roster<H> {
    const state: RosterState<H> = {
        ...options,
        size,
        entries: new Map(),
        snapshot: null,
        listeners: new Set(),
        serial: 0,
    };

    return {
        handlers: createHandlers(state),
        setSize: (next) => {
            state.size = next;
        },
        subscribe: (onChange) => subscribeRoster(state, onChange),
        getSnapshot: () => rosterSnapshot(state),
    };
}

function useRoster<H extends RosterHost>(options: RosterOptions<H>, size: CellSize): Roster<H> {
    const [roster] = useState(() => createRoster(options, size));

    useLayoutEffect(() => {
        roster.setSize(size);
    });

    return roster;
}

function useItemCells(size: CellSize): Roster<Gtk.ListItem> {
    return useRoster(CELL_OPTIONS, size);
}

function useHeaderCells(size: CellSize): Roster<Gtk.ListHeader> {
    return useRoster(HEADER_OPTIONS, size);
}

function isRowWanted(options: ItemSlotOptions, item: ListItem): boolean {
    const { expandedIds } = options;

    return expandedIds == null ? options.isRowExpanded === true : expandedIds.includes(item.id);
}

function itemArgs(item: ListItem, options: ItemSlotOptions): ListItemRenderArgs<unknown> {
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

function slotFor(options: ItemSlotOptions): ItemSlot | null {
    const ref = slotRefFor(options.item);
    const item = ref === null ? undefined : options.collection.itemAt(ref);

    if (item === undefined) {
        return null;
    }

    return { item, row: options.row, args: itemArgs(item, options) };
}

function useItemSlot(
    entry: RosterEntry<PositionedHost>,
    collection: Collection,
    expandedIds: string[] | null | undefined,
): ItemSlot | null {
    const position = useProperty(entry.host, "position");
    const item = useSyncExternalStore(entry.subscribe, entry.getItem);
    const row = item instanceof Gtk.TreeListRow ? item : null;
    const isRowExpanded = useProperty(row, "expanded");

    return slotFor({ item, position, row, isRowExpanded, collection, expandedIds });
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
                        hideExpander={item.shouldHideExpander ?? false}
                        indentForDepth={item.shouldIndentForDepth ?? true}
                        indentForIcon={item.shouldIndentForIcon ?? true}
                    >
                        {content}
                    </GtkTreeExpander>
                );

    return expander;
}

function itemBody(slot: ItemSlot | null, render: ListItemRenderer<never>): ReactNode {
    if (slot === null) {
        return null;
    }

    const renderItem = render as ListItemRenderer<unknown>;

    return wrapExpander(slot.item, slot.row, renderItem(slot.args));
}

function rowText(value: string | undefined): string | null {
    return value ?? null;
}

function rowFlag(value: boolean | undefined): boolean {
    return value ?? true;
}

function rowPropsFor(slot: ItemSlot | null, getRowProps: ListRowPropsResolver<never>): ResolvedRowProps {
    const resolve = getRowProps as ListRowPropsResolver<unknown>;
    const props = slot === null ? NO_ROW_PROPS : resolve(slot.args);

    return {
        accessibleLabel: rowText(props.accessibleLabel),
        accessibleDescription: rowText(props.accessibleDescription),
        isActivatable: rowFlag(props.isActivatable),
        isFocusable: rowFlag(props.isFocusable),
        isSelectable: rowFlag(props.isSelectable),
    };
}

function setRowText(host: Gtk.ColumnViewRow, name: string, value: string | null): void {
    setObjectProperty(host, name, ROW_TEXT_DESCRIPTOR, value);
}

function applyRowProps(host: Gtk.ColumnViewRow, props: ResolvedRowProps): void {
    setRowText(host, "accessible-label", props.accessibleLabel);
    setRowText(host, "accessible-description", props.accessibleDescription);
    host.setActivatable(props.isActivatable);
    host.setFocusable(props.isFocusable);
    host.setSelectable(props.isSelectable);
}

function ItemCellImpl({ entry, render, collection, expandedIds }: ItemCellProps): ReactNode {
    const slot = useItemSlot(entry, collection, expandedIds);
    const body = itemBody(slot, render);

    return createPortal(body, entry.host, entry.key);
}

function ItemRowImpl({ entry, getRowProps, collection, expandedIds }: ItemRowProps): ReactNode {
    const slot = useItemSlot(entry, collection, expandedIds);
    const props = rowPropsFor(slot, getRowProps);

    useLayoutEffect(() => {
        applyRowProps(entry.host, props);
    });

    return null;
}

function HeaderCellImpl({ entry, render, collection }: HeaderCellProps): ReactNode {
    const item = useSyncExternalStore(entry.subscribe, entry.getItem);
    const ref = slotRefFor(item);
    const renderHeader = render as ListSectionRenderer<unknown>;
    const body = ref === null ? null : renderHeader({ section: collection.sectionFor(ref.store.path) });

    return createPortal(body, entry.host, entry.key);
}

function usePortalEntries<H extends RosterHost>(store: Roster<H>): RosterEntry<H>[] {
    return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

const ItemPortals = ({ store, render, collection, expandedIds }: ItemPortalsProps): ReactNode =>
    usePortalEntries(store).map((entry) => (
        <ItemCell key={entry.key} entry={entry} render={render} collection={collection} expandedIds={expandedIds} />
    ));

const RowPortals = ({ store, getRowProps, collection, expandedIds }: RowPortalsProps): ReactNode =>
    usePortalEntries(store).map((entry) => (
        <ItemRow
            key={entry.key}
            entry={entry}
            getRowProps={getRowProps}
            collection={collection}
            expandedIds={expandedIds}
        />
    ));

const HeaderPortals = ({ store, render, collection }: HeaderPortalsProps): ReactNode =>
    usePortalEntries(store).map((entry) => (
        <HeaderCell key={entry.key} entry={entry} render={render} collection={collection} />
    ));

const useSectionHeader = (
    render: ListSectionRenderer<never> | null | undefined,
    collection: Collection,
    size: CellSize,
): SectionHeaderSlot => {
    const store = useHeaderCells(size);

    if (render == null) {
        return { factoryProps: {}, portals: null };
    }

    return {
        factoryProps: { headerFactory: <GtkSignalListItemFactory {...store.handlers} /> },
        portals: <HeaderPortals store={store} render={render} collection={collection} />,
    };
};

const useRowProps = (
    getRowProps: ListRowPropsResolver<never> | null | undefined,
    collection: Collection,
    expandedIds: string[] | null | undefined,
): RowSlot => {
    const store = useRoster(ROW_OPTIONS, NO_SIZE);

    if (getRowProps == null) {
        return { factoryProps: {}, portals: null };
    }

    return {
        factoryProps: { rowFactory: <GtkSignalListItemFactory {...store.handlers} /> },
        portals: (
            <RowPortals store={store} getRowProps={getRowProps} collection={collection} expandedIds={expandedIds} />
        ),
    };
};

export {
    useItemCells,
    useRowProps,
    useSectionHeader,
    ItemPortals,
    type CellSize,
};
