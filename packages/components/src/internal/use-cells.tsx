import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkTreeExpander } from "@gtkx/jsx/gtk";
import { createPortal } from "@gtkx/react";
import { useLayoutEffect, useState } from "react";
import type { HeaderRenderer, ItemRenderer, RenderItemArgs } from "../types.js";
import type { CollectionModel } from "./collection-model.js";

type CellSize = { width: number; height: number };

type CellRecord = {
    key: number;
    kind: "item" | "header";
    cell: GObject.Object;
    holder: GObject.Object;
    row: Gtk.TreeListRow | null;
    slot: string | null;
    position: () => number;
};

type FactoryHandlers = {
    onSetup: (cell: GObject.Object) => void;
    onBind: (cell: GObject.Object) => void;
    onUnbind: (cell: GObject.Object) => void;
    onTeardown: (cell: GObject.Object) => void;
};

type CellRenderers = {
    item: (record: CellRecord) => ReactNode;
    header: (record: CellRecord) => ReactNode;
};

type Cells = {
    item: FactoryHandlers;
    header: FactoryHandlers;
    slot: (id: string) => FactoryHandlers;
    refresh: () => void;
    portals: (renderers: CellRenderers, collection: CollectionModel) => ReactNode[];
};

type CellsState = {
    size: () => CellSize;
    records: Map<GObject.Object, CellRecord>;
    serial: number;
    refresh: () => void;
};

type ItemArgsOptions = {
    collection: CollectionModel;
    expandedIds?: string[] | null | undefined;
};

type CollectionRenderersOptions = ItemArgsOptions & {
    renderItem: ItemRenderer<never>;
    renderHeader?: HeaderRenderer<never> | null | undefined;
};

const cellSizes: WeakMap<Cells, CellSize> = new WeakMap();

const placeholder = (size: CellSize): Gtk.Widget =>
    new Gtk.Box({ widthRequest: size.width, heightRequest: size.height });

const expanded = (record: CellRecord, content: ReactNode, collection: CollectionModel): ReactNode => {
    const item = collection.entryFor(record.holder)?.item;
    const row = record.row;

    const expander: ReactNode =
        row === null
            ? (
                    content
                )
            : (
                    <GtkTreeExpander
                        listRow={row}
                        hideExpander={item?.hideExpander ?? false}
                        indentForDepth={item?.indentForDepth ?? true}
                        indentForIcon={item?.indentForIcon ?? true}
                    >
                        {content}
                    </GtkTreeExpander>
                );

    return expander;
};

const addRecord = (state: CellsState, record: Omit<CellRecord, "key">): void => {
    state.serial += 1;
    state.records.set(record.cell, { ...record, key: state.serial });
    state.refresh();
};

const removeRecord = (state: CellsState, cell: GObject.Object): void => {
    if (state.records.delete(cell)) {
        state.refresh();
    }
};

const bindItem = (state: CellsState, slot: string | null, cell: Gtk.ListItem): void => {
    const bound = cell.getItem();

    if (bound === null) {
        return;
    }

    let holder = bound;
    let row: Gtk.TreeListRow | null = null;

    if (bound instanceof Gtk.TreeListRow) {
        const inner = bound.getItem();

        if (inner === null) {
            return;
        }

        row = bound;
        holder = inner;
    }

    if (cell.getChild() === null) {
        cell.setChild(placeholder(state.size()));
    }

    addRecord(state, { kind: "item", cell, holder, row, slot, position: () => cell.getPosition() });
};

const itemHandlers = (state: CellsState, slot: string | null): FactoryHandlers => ({
    onSetup: (cell) => {
        if (cell instanceof Gtk.ListItem) {
            cell.setChild(placeholder(state.size()));
        }
    },
    onBind: (cell) => {
        if (cell instanceof Gtk.ListItem) {
            bindItem(state, slot, cell);
        }
    },
    onUnbind: (cell) => {
        removeRecord(state, cell);
    },
    onTeardown: (cell) => {
        removeRecord(state, cell);
    },
});

const bindHeader = (state: CellsState, header: Gtk.ListHeader): void => {
    const holder = header.getItem();

    if (holder === null) {
        return;
    }

    if (header.getChild() === null) {
        header.setChild(placeholder(state.size()));
    }

    addRecord(state, {
        kind: "header",
        cell: header,
        holder,
        row: null,
        slot: null,
        position: () => header.getStart(),
    });
};

const headerHandlers = (state: CellsState): FactoryHandlers => ({
    onSetup: (header) => {
        if (header instanceof Gtk.ListHeader) {
            header.setChild(placeholder(state.size()));
        }
    },
    onBind: (header) => {
        if (header instanceof Gtk.ListHeader) {
            bindHeader(state, header);
        }
    },
    onUnbind: (header) => {
        removeRecord(state, header);
    },
    onTeardown: (header) => {
        removeRecord(state, header);
    },
});

const createCells = (state: CellsState): Cells => {
    const slots: Map<string, FactoryHandlers> = new Map();

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
        portals: (renderers, collection) =>
            state.records
                .values()
                .map((record) =>
                    createPortal(
                        expanded(record, renderers[record.kind](record), collection),
                        record.cell,
                        `gtkx-cell-${String(record.key)}`,
                    ),
                )
                .toArray(),
    };
};

const useCells = (size: CellSize): Cells => {
    const [, setVersion] = useState(0);

    const [cells] = useState<Cells>(() => {
        const created: Cells = createCells({
            size: () => cellSizes.get(created) ?? size,
            records: new Map(),
            serial: 0,
            refresh: () => {
                setVersion((version) => version + 1);
            },
        });

        return created;
    });

    useLayoutEffect(() => {
        cellSizes.set(cells, size);
    });

    return cells;
};

const applyRowArgs = (
    args: RenderItemArgs<unknown>,
    row: Gtk.TreeListRow,
    id: string,
    expandedIds: string[] | null | undefined,
): void => {
    args.depth = row.getDepth();

    if (!row.isExpandable()) {
        return;
    }

    args.isExpanded = expandedIds == null ? row.getExpanded() : expandedIds.includes(id);
};

const renderItemArgs = (record: CellRecord, options: ItemArgsOptions): RenderItemArgs<unknown> | null => {
    const entry = options.collection.entryFor(record.holder);

    if (entry === undefined) {
        return null;
    }

    const args: RenderItemArgs<unknown> = { item: entry.item.value, index: record.position() };

    if (record.row !== null) {
        applyRowArgs(args, record.row, entry.id, options.expandedIds);
    }

    return args;
};

const headerRenderer = (
    collection: CollectionModel,
    renderHeader: HeaderRenderer<never> | null | undefined,
): ((record: CellRecord) => ReactNode) => {
    if (renderHeader == null) {
        return () => null;
    }

    const render = renderHeader as HeaderRenderer<unknown>;

    return (record) => render({ section: collection.entryFor(record.holder)?.sectionValue });
};

const collectionRenderers = (options: CollectionRenderersOptions): CellRenderers => {
    const render = options.renderItem as ItemRenderer<unknown>;

    return {
        item: (record) => {
            const args = renderItemArgs(record, options);

            return args === null ? null : render(args);
        },
        header: headerRenderer(options.collection, options.renderHeader),
    };
};

export {
    useCells,
    renderItemArgs,
    headerRenderer,
    collectionRenderers,
    type CellSize,
    type CellRecord,
    type FactoryHandlers,
    type CellRenderers,
    type Cells,
    type ItemArgsOptions,
};
