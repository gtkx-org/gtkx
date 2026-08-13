import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement, ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkSignalListItemFactory, GtkTreeExpander } from "@gtkx/jsx/gtk";
import { createPortal, useProperty } from "@gtkx/react";
import { setObjectProperty, t } from "@gtkx/runtime";
import { memo, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type {
    ExpanderDescriptions,
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

type FactoryHost = GObject.Object & {
    getItem: () => GObject.Object | null;
};

type CellHost = FactoryHost & {
    getChild: () => Gtk.Widget | null;
    setChild: (child: Gtk.Widget | null) => void;
};

type CellEntry<H extends FactoryHost> = {
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

type CellRegistry<H extends FactoryHost> = {
    handlers: FactoryHandlers;
    setSize: (size: CellSize) => void;
    subscribe: (onChange: () => void) => () => void;
    getVersion: () => number;
    getEntries: () => CellEntry<H>[];
};

type HostGuard<H extends FactoryHost> = (value: GObject.Object) => value is H;

type CellRegistryOptions<H extends FactoryHost> = {
    isHost: HostGuard<H>;
    prepare?: ((host: H, size: CellSize) => void) | undefined;
};

type CellRegistryState<H extends FactoryHost> = CellRegistryOptions<H> & {
    size: CellSize;
    entries: Map<H, CellEntry<H>>;
    snapshot: CellEntry<H>[] | null;
    listeners: Set<() => void>;
    serial: number;
    version: number;
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
    entry: CellEntry<Gtk.ListItem>;
    render: ListItemRenderer<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
    expanderDescriptions: ExpanderDescriptions | null | undefined;
};

type ItemPortalsProps = {
    registry: CellRegistry<Gtk.ListItem>;
    render: ListItemRenderer<never>;
    collection: Collection;
    expandedIds?: string[] | null | undefined;
    expanderDescriptions?: ExpanderDescriptions | null | undefined;
};

type ItemRowProps = {
    entry: CellEntry<Gtk.ColumnViewRow>;
    rowProps: ListRowPropsResolver<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type RowPortalsProps = {
    registry: CellRegistry<Gtk.ColumnViewRow>;
    rowProps: ListRowPropsResolver<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type HeaderCellProps = {
    entry: CellEntry<Gtk.ListHeader>;
    render: ListSectionRenderer<never>;
    collection: Collection;
};

type HeaderPortalsProps = {
    registry: CellRegistry<Gtk.ListHeader>;
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
const CELL_OPTIONS: CellRegistryOptions<Gtk.ListItem> = { isHost: isListItem, prepare: prepareCell };
const HEADER_OPTIONS: CellRegistryOptions<Gtk.ListHeader> = { isHost: isListHeader, prepare: prepareCell };
const ROW_OPTIONS: CellRegistryOptions<Gtk.ColumnViewRow> = { isHost: isColumnViewRow };
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

function notifyEntry<H extends FactoryHost>(entry: CellEntry<H>): void {
    for (const listener of entry.listeners) {
        listener();
    }
}

function notifyRegistry<H extends FactoryHost>(state: CellRegistryState<H>): void {
    state.snapshot = null;
    state.version += 1;

    for (const listener of state.listeners) {
        listener();
    }
}

function createEntry<H extends FactoryHost>(state: CellRegistryState<H>, host: H): CellEntry<H> {
    state.serial += 1;

    const entry: CellEntry<H> = {
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

function setupHost<H extends FactoryHost>(state: CellRegistryState<H>, host: H): void {
    state.prepare?.(host, state.size);
    state.entries.set(host, createEntry(state, host));
    notifyRegistry(state);
}

function teardownHost<H extends FactoryHost>(state: CellRegistryState<H>, host: H): void {
    if (state.entries.delete(host)) {
        notifyRegistry(state);
    }
}

function writeBinding<H extends FactoryHost>(state: CellRegistryState<H>, host: H, item: GObject.Object | null): void {
    const entry = state.entries.get(host);

    if (entry === undefined) {
        return;
    }

    entry.item = item;
    notifyEntry(entry);
}

function bindHost<H extends FactoryHost>(state: CellRegistryState<H>, host: H): void {
    state.prepare?.(host, state.size);
    writeBinding(state, host, host.getItem());
}

function subscribeRegistry<H extends FactoryHost>(state: CellRegistryState<H>, onChange: () => void): () => void {
    state.listeners.add(onChange);

    return () => {
        state.listeners.delete(onChange);
    };
}

function getRegistryEntries<H extends FactoryHost>(state: CellRegistryState<H>): CellEntry<H>[] {
    state.snapshot ??= state.entries.values().toArray();

    return state.snapshot;
}

function guarded<H extends FactoryHost>(isHost: HostGuard<H>, run: (host: H) => void): (host: GObject.Object) => void {
    return (host) => {
        if (isHost(host)) {
            run(host);
        }
    };
}

function createHandlers<H extends FactoryHost>(state: CellRegistryState<H>): FactoryHandlers {
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

function createCellRegistry<H extends FactoryHost>(options: CellRegistryOptions<H>, size: CellSize): CellRegistry<H> {
    const state: CellRegistryState<H> = {
        ...options,
        size,
        entries: new Map(),
        snapshot: null,
        listeners: new Set(),
        serial: 0,
        version: 0,
    };

    return {
        handlers: createHandlers(state),
        setSize: (next) => {
            state.size = next;
        },
        subscribe: (onChange) => subscribeRegistry(state, onChange),
        getVersion: () => state.version,
        getEntries: () => getRegistryEntries(state),
    };
}

function useCellRegistry<H extends FactoryHost>(options: CellRegistryOptions<H>, size: CellSize): CellRegistry<H> {
    const [registry] = useState(() => createCellRegistry(options, size));

    useLayoutEffect(() => {
        registry.setSize(size);
    });

    return registry;
}

function useItemCells(size: CellSize): CellRegistry<Gtk.ListItem> {
    return useCellRegistry(CELL_OPTIONS, size);
}

function useHeaderCells(size: CellSize): CellRegistry<Gtk.ListHeader> {
    return useCellRegistry(HEADER_OPTIONS, size);
}

function isRowWanted(options: ItemSlotOptions, item: ListItem): boolean {
    return options.expandedIds?.includes(item.id) ?? false;
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
    entry: CellEntry<PositionedHost>,
    collection: Collection,
    expandedIds: string[] | null | undefined,
): ItemSlot | null {
    const position = useProperty(entry.host, "position");
    const item = useSyncExternalStore(entry.subscribe, entry.getItem);
    const row = item instanceof Gtk.TreeListRow ? item : null;

    return slotFor({ item, position, row, collection, expandedIds });
}

function expanderDescriptionFor(
    slot: ItemSlot,
    descriptions: ExpanderDescriptions | null | undefined,
): string | undefined {
    const { isExpanded } = slot.args;

    if (isExpanded === undefined || descriptions == null) {
        return undefined;
    }

    return isExpanded ? descriptions.collapse : descriptions.expand;
}

function wrapExpander(
    slot: ItemSlot,
    content: ReactNode,
    descriptions: ExpanderDescriptions | null | undefined,
): ReactNode {
    const { item, row } = slot;

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
                        accessibleDescription={expanderDescriptionFor(slot, descriptions)}
                    >
                        {content}
                    </GtkTreeExpander>
                );

    return expander;
}

function itemBody(
    slot: ItemSlot | null,
    render: ListItemRenderer<never>,
    descriptions: ExpanderDescriptions | null | undefined,
): ReactNode {
    if (slot === null) {
        return null;
    }

    const renderItem = render as ListItemRenderer<unknown>;

    return wrapExpander(slot, renderItem(slot.args), descriptions);
}

function rowText(value: string | undefined): string | null {
    return value ?? null;
}

/* eslint-disable-next-line unicorn/consistent-boolean-name -- reads the flag off a row, paired with rowText */
function rowFlag(value: boolean | undefined): boolean {
    return value ?? true;
}

function rowPropsFor(slot: ItemSlot | null, rowProps: ListRowPropsResolver<never>): ResolvedRowProps {
    const resolve = rowProps as ListRowPropsResolver<unknown>;
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

function ItemCellImpl({ entry, render, collection, expandedIds, expanderDescriptions }: ItemCellProps): ReactNode {
    const slot = useItemSlot(entry, collection, expandedIds);
    const body = itemBody(slot, render, expanderDescriptions);

    return createPortal(body, entry.host, entry.key);
}

function ItemRowImpl({ entry, rowProps, collection, expandedIds }: ItemRowProps): ReactNode {
    const slot = useItemSlot(entry, collection, expandedIds);
    const props = rowPropsFor(slot, rowProps);

    useLayoutEffect(() => {
        applyRowProps(entry.host, props);
    });

    return null;
}

function HeaderCellImpl({ entry, render, collection }: HeaderCellProps): ReactNode {
    const item = useSyncExternalStore(entry.subscribe, entry.getItem);
    const ref = slotRefFor(item);
    const renderHeader = render as ListSectionRenderer<unknown>;
    const body = ref === null ? null : renderHeader({ section: collection.sectionFor(ref.store.level.path) });

    return createPortal(body, entry.host, entry.key);
}

function usePortalEntries<H extends FactoryHost>(registry: CellRegistry<H>): CellEntry<H>[] {
    useSyncExternalStore(registry.subscribe, registry.getVersion);

    return registry.getEntries();
}

const ItemPortals = ({
    registry,
    render,
    collection,
    expandedIds,
    expanderDescriptions,
}: ItemPortalsProps): ReactNode =>
    usePortalEntries(registry).map((entry) => (
        <ItemCell
            key={entry.key}
            entry={entry}
            render={render}
            collection={collection}
            expandedIds={expandedIds}
            expanderDescriptions={expanderDescriptions}
        />
    ));

const RowPortals = ({ registry, rowProps, collection, expandedIds }: RowPortalsProps): ReactNode =>
    usePortalEntries(registry).map((entry) => (
        <ItemRow
            key={entry.key}
            entry={entry}
            rowProps={rowProps}
            collection={collection}
            expandedIds={expandedIds}
        />
    ));

const HeaderPortals = ({ registry, render, collection }: HeaderPortalsProps): ReactNode =>
    usePortalEntries(registry).map((entry) => (
        <HeaderCell key={entry.key} entry={entry} render={render} collection={collection} />
    ));

const useSectionHeader = (
    render: ListSectionRenderer<never> | null | undefined,
    collection: Collection,
    size: CellSize,
): SectionHeaderSlot => {
    const registry = useHeaderCells(size);

    if (render == null) {
        return { factoryProps: {}, portals: null };
    }

    return {
        factoryProps: { headerFactory: <GtkSignalListItemFactory {...registry.handlers} /> },
        portals: <HeaderPortals registry={registry} render={render} collection={collection} />,
    };
};

const useRowProps = (
    rowProps: ListRowPropsResolver<never> | null | undefined,
    collection: Collection,
    expandedIds: string[] | null | undefined,
): RowSlot => {
    const registry = useCellRegistry(ROW_OPTIONS, NO_SIZE);

    if (rowProps == null) {
        return { factoryProps: {}, portals: null };
    }

    return {
        factoryProps: { rowFactory: <GtkSignalListItemFactory {...registry.handlers} /> },
        portals: (
            <RowPortals registry={registry} rowProps={rowProps} collection={collection} expandedIds={expandedIds} />
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
