import type * as GObject from "@gtkx/gi/gobject";
import type { ReactElement, ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkSignalListItemFactory, GtkTreeExpander } from "@gtkx/jsx/gtk";
import { createPortal, useProperty } from "@gtkx/react";
import { Fragment, memo, useInsertionEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { slotPathAt, type SlotRef, slotRefFor } from "./collection-model.js";
import { joinParts } from "./keys.js";

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
    identity: ItemIdentityStore;
};

type FactoryHandlers = {
    onSetup: (host: GObject.Object) => void;
    onBind: (host: GObject.Object) => void;
    onTeardown: (host: GObject.Object) => void;
};

type CellRegistry<H extends FactoryHost> = {
    handlers: FactoryHandlers;
    setSize: (size: CellSize) => void;
    subscribe: (onChange: () => void) => () => void;
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
    itemKey: string;
    item: ListItem;
    row: Gtk.TreeListRow | null;
    args: ListItemRenderArgs<unknown>;
};

type CollectionState = {
    collection: Collection;
    expandedIds: string[] | null | undefined;
};

type CollectionStateStore = {
    read: () => CollectionState;
    write: (state: CollectionState) => void;
};

type ItemIdentity = {
    itemKey: string;
    item: ListItem | undefined;
    position: number;
    isExpanded: boolean;
};

type ItemIdentityStore = {
    read: () => ItemIdentity | null;
    write: (identity: ItemIdentity) => void;
};

type ItemCellProps = {
    entry: CellEntry<Gtk.ListItem>;
    render: ListItemRenderer<never>;
    state: CollectionStateStore;
    hasExpander: boolean;
    expanderDescriptions: ExpanderDescriptions | null | undefined;
} & ItemIdentity;

type ItemPortalsProps = {
    registry: CellRegistry<Gtk.ListItem>;
    render: ListItemRenderer<never>;
    collection: Collection;
    hasExpander?: boolean | undefined;
    expandedIds?: string[] | null | undefined;
    expanderDescriptions?: ExpanderDescriptions | null | undefined;
};

type ItemRowProps = {
    entry: CellEntry<Gtk.ColumnViewRow>;
    rowProps: ListRowPropsResolver<never>;
    state: CollectionStateStore;
} & ItemIdentity;

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

const ItemCell = memo(ItemCellImpl, isSameItemCell);
const ItemRow = memo(ItemRowImpl, isSameItemRow);
const HeaderCell = memo(HeaderCellImpl);
const CELL_OPTIONS: CellRegistryOptions<Gtk.ListItem> = { isHost: isListItem, prepare: prepareCell };
const HEADER_OPTIONS: CellRegistryOptions<Gtk.ListHeader> = { isHost: isListHeader, prepare: prepareCell };
const ROW_OPTIONS: CellRegistryOptions<Gtk.ColumnViewRow> = { isHost: isColumnViewRow };
const NO_SIZE: CellSize = { width: -1, height: -1 };
const NO_ROW_PROPS: ListRowProps = {};
const placeholders: WeakSet<Gtk.Widget> = new WeakSet();

const placeholder = (size: CellSize): Gtk.Widget => {
    const widget = new Gtk.Box({ widthRequest: size.width, heightRequest: size.height });
    placeholders.add(widget);

    return widget;
};

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
    const child = host.getChild();

    if (child === null) {
        host.setChild(placeholder(size));
    } else if (placeholders.has(child)) {
        child.setSizeRequest(size.width, size.height);
    }
}

function notifyRegistry<H extends FactoryHost>(state: CellRegistryState<H>): void {
    state.snapshot = null;

    for (const listener of state.listeners) {
        listener();
    }
}

function createEntry<H extends FactoryHost>(state: CellRegistryState<H>, host: H): CellEntry<H> {
    state.serial += 1;

    return { key: `gtkx-cell-${String(state.serial)}`, host, identity: createItemIdentityStore() };
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

function bindHost<H extends FactoryHost>(state: CellRegistryState<H>, host: H): void {
    state.prepare?.(host, state.size);
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
    };

    return {
        handlers: createHandlers(state),
        setSize: (next) => {
            if (state.size.width === next.width && state.size.height === next.height) {
                return;
            }

            state.size = next;

            for (const host of state.entries.keys()) {
                state.prepare?.(host, next);
            }
        },
        subscribe: (onChange) => subscribeRegistry(state, onChange),
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

function itemArgs(
    item: ListItem,
    position: number | undefined,
    row: Gtk.TreeListRow | null,
    isExpanded: boolean,
): ListItemRenderArgs<unknown> {
    const args: ListItemRenderArgs<unknown> = { item: item.value, index: position ?? 0 };

    if (row === null) {
        return args;
    }

    args.depth = row.getDepth();

    if (row.isExpandable()) {
        args.isExpanded = isExpanded;
    }

    return args;
}

function keyForItem(ref: SlotRef, item: ListItem): string {
    return joinParts([slotPathAt(ref.store, ref.slot), item.id]);
}

function slotFor(options: ItemSlotOptions): ItemSlot | null {
    const ref = slotRefFor(options.item);

    if (ref === null) {
        return null;
    }

    const item = options.collection.itemAt(ref);

    if (item === undefined) {
        return null;
    }

    return {
        itemKey: keyForItem(ref, item),
        item,
        row: options.row,
        args: itemArgs(item, options.position, options.row, isRowWanted(options, item)),
    };
}

function useItemSlot(
    entry: CellEntry<PositionedHost>,
    state: CollectionStateStore,
    identity: ItemIdentity,
): ItemSlot | null {
    const position = useProperty(entry.host, "position");
    const item = useProperty(entry.host, "item") ?? null;
    const row = item instanceof Gtk.TreeListRow ? item : null;

    if (position === identity.position) {
        return identity.item === undefined
            ? null
            : {
                    itemKey: identity.itemKey,
                    item: identity.item,
                    row,
                    args: itemArgs(identity.item, position, row, identity.isExpanded),
                };
    }

    const { collection, expandedIds } = state.read();

    return slotFor({ item, position, row, collection, expandedIds });
}

function itemIdentity(
    entry: CellEntry<PositionedHost>,
    collection: Collection,
    expandedIds: string[] | null | undefined,
): ItemIdentity {
    const ref = slotRefFor(entry.host.getItem());
    const item = ref === null ? undefined : collection.itemAt(ref);

    return {
        itemKey: ref === null || item === undefined ? "" : keyForItem(ref, item),
        item,
        position: entry.host.getPosition(),
        isExpanded: item === undefined ? false : (expandedIds?.includes(item.id) ?? false),
    };
}

function isSameItemIdentity(previous: ItemIdentity, next: ItemIdentity): boolean {
    return (
        previous.item === next.item &&
        previous.itemKey === next.itemKey &&
        previous.position === next.position &&
        previous.isExpanded === next.isExpanded
    );
}

function isSameItemCell(previous: ItemCellProps, next: ItemCellProps): boolean {
    const identity = previous.entry.identity.read() ?? previous;

    return (
        previous.entry === next.entry &&
        previous.render === next.render &&
        previous.hasExpander === next.hasExpander &&
        previous.expanderDescriptions === next.expanderDescriptions &&
        isSameItemIdentity(identity, next)
    );
}

function isSameItemRow(previous: ItemRowProps, next: ItemRowProps): boolean {
    const identity = previous.entry.identity.read() ?? previous;

    return previous.entry === next.entry && previous.rowProps === next.rowProps && isSameItemIdentity(identity, next);
}

function createItemIdentityStore(): ItemIdentityStore {
    let current: ItemIdentity | null = null;

    return {
        read: () => current,
        write: (identity) => {
            current = identity;
        },
    };
}

function renderedIdentity(entry: CellEntry<PositionedHost>, slot: ItemSlot | null): ItemIdentity {
    return {
        itemKey: slot?.itemKey ?? "",
        item: slot?.item,
        position: slot?.args.index ?? entry.host.getPosition(),
        isExpanded: slot?.args.isExpanded ?? false,
    };
}

function useRememberIdentity(entry: CellEntry<PositionedHost>, slot: ItemSlot | null): void {
    useLayoutEffect(() => {
        entry.identity.write(renderedIdentity(entry, slot));
    });
}

function createCollectionStateStore(initial: CollectionState): CollectionStateStore {
    let current = initial;

    return {
        read: () => current,
        write: (state) => {
            current = state;
        },
    };
}

function useCollectionState(
    collection: Collection,
    expandedIds: string[] | null | undefined,
): CollectionStateStore {
    const [state] = useState(() => createCollectionStateStore({ collection, expandedIds }));

    useInsertionEffect(() => {
        state.write({ collection, expandedIds });
    }, [state, collection, expandedIds]);

    return state;
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
    hasExpander: boolean,
    descriptions: ExpanderDescriptions | null | undefined,
): ReactNode {
    if (slot === null) {
        return null;
    }

    const renderItem = render as ListItemRenderer<unknown>;
    const content = renderItem(slot.args);

    return (
        <Fragment key={slot.itemKey}>{hasExpander ? wrapExpander(slot, content, descriptions) : content}</Fragment>
    );
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

function applyRowProps(
    host: Gtk.ColumnViewRow,
    props: ResolvedRowProps,
    previous: ResolvedRowProps | null,
): void {
    if (previous?.accessibleLabel !== props.accessibleLabel) {
        host.accessibleLabel = props.accessibleLabel;
    }

    if (previous?.accessibleDescription !== props.accessibleDescription) {
        host.accessibleDescription = props.accessibleDescription;
    }

    if (previous?.isActivatable !== props.isActivatable) {
        host.setActivatable(props.isActivatable);
    }

    if (previous?.isFocusable !== props.isFocusable) {
        host.setFocusable(props.isFocusable);
    }

    if (previous?.isSelectable !== props.isSelectable) {
        host.setSelectable(props.isSelectable);
    }
}

function ItemCellImpl({
    entry,
    render,
    state,
    hasExpander,
    expanderDescriptions,
    ...identity
}: ItemCellProps): ReactNode {
    const slot = useItemSlot(entry, state, identity);
    useRememberIdentity(entry, slot);
    const body = itemBody(slot, render, hasExpander, expanderDescriptions);

    return createPortal(body, entry.host, entry.key);
}

function ItemRowImpl({ entry, rowProps, state, ...identity }: ItemRowProps): ReactNode {
    const slot = useItemSlot(entry, state, identity);
    useRememberIdentity(entry, slot);
    const props = rowPropsFor(slot, rowProps);
    const previous = useRef<ResolvedRowProps | null>(null);

    useLayoutEffect(() => {
        applyRowProps(entry.host, props, previous.current);
        previous.current = props;
    }, [entry.host, props]);

    return null;
}

function HeaderCellImpl({ entry, render, collection }: HeaderCellProps): ReactNode {
    const item = useProperty(entry.host, "item") ?? null;

    return createPortal(headerBody(slotRefFor(item), render, collection), entry.host, entry.key);
}

function headerBody(
    ref: SlotRef | null,
    render: ListSectionRenderer<never>,
    collection: Collection,
): ReactNode {
    if (ref === null) {
        return null;
    }

    const section = collection.sectionFor(ref.store.level.path);

    if (section === undefined) {
        return null;
    }

    const renderHeader = render as ListSectionRenderer<unknown>;
    const key = joinParts([ref.store.level.path, section.id]);

    return <Fragment key={key}>{renderHeader({ section: section.value })}</Fragment>;
}

function usePortalEntries<H extends FactoryHost>(registry: CellRegistry<H>): CellEntry<H>[] {
    return useSyncExternalStore(registry.subscribe, registry.getEntries);
}

const ItemPortals = ({
    registry,
    render,
    collection,
    hasExpander,
    expandedIds,
    expanderDescriptions,
}: ItemPortalsProps): ReactNode => {
    const entries = usePortalEntries(registry);
    const state = useCollectionState(collection, expandedIds);

    return entries.map((entry) => (
        <ItemCell
            key={entry.key}
            entry={entry}
            render={render}
            state={state}
            hasExpander={hasExpander ?? true}
            expanderDescriptions={expanderDescriptions}
            {...itemIdentity(entry, collection, expandedIds)}
        />
    ));
};

const RowPortals = ({ registry, rowProps, collection, expandedIds }: RowPortalsProps): ReactNode => {
    const entries = usePortalEntries(registry);
    const state = useCollectionState(collection, expandedIds);

    return entries.map((entry) => (
        <ItemRow
            key={entry.key}
            entry={entry}
            rowProps={rowProps}
            state={state}
            {...itemIdentity(entry, collection, expandedIds)}
        />
    ));
};

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
