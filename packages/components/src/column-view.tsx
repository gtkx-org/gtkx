import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkColumnViewColumn } from "@gtkx/jsx/gtk";
import type { ReactNode, Ref } from "react";
import { useLayoutEffect, useRef } from "react";
import {
    asHeaderRenderer,
    buildRenderItemArgs,
    type CellRenderers,
    renderCellPortals,
} from "./internal/cell-portals.js";
import { createItemFactory, type FactoryContext } from "./internal/collection-factories.js";
import type { CollectionViewApi } from "./internal/use-collection-view.js";
import { useCollectionWidget } from "./internal/use-collection-widget.js";
import { useFactorySlot } from "./internal/use-factories.js";
import { applyRef } from "./internal/use-widget-ref.js";
import type { ColumnDef, ColumnViewProps, ColumnViewSortProps, RenderItemProps } from "./types.js";

type ColumnRefEntry = {
    external: Ref<Gtk.ColumnViewColumn | null> | undefined;
    callback: (column: Gtk.ColumnViewColumn | null) => void;
};

type ColumnRegistry = {
    factories: Map<string, Gtk.SignalListItemFactory>;
    sorters: Map<string, Gtk.CustomSorter>;
    instances: Map<string, Gtk.ColumnViewColumn>;
    refs: Map<string, ColumnRefEntry>;
};

const createRegistry = (): ColumnRegistry => ({
    factories: new Map(),
    sorters: new Map(),
    instances: new Map(),
    refs: new Map(),
});

const columnFactory = (registry: ColumnRegistry, context: FactoryContext, id: string): Gtk.SignalListItemFactory => {
    let factory = registry.factories.get(id);
    if (factory === undefined) {
        factory = createItemFactory(context, id);
        registry.factories.set(id, factory);
    }
    return factory;
};

const columnSorter = (registry: ColumnRegistry, id: string): Gtk.CustomSorter => {
    let sorter = registry.sorters.get(id);
    if (sorter === undefined) {
        sorter = Gtk.CustomSorter.new(null);
        registry.sorters.set(id, sorter);
    }
    return sorter;
};

const columnRefCallback = (
    registry: ColumnRegistry,
    id: string,
    external: Ref<Gtk.ColumnViewColumn | null> | undefined,
): ((column: Gtk.ColumnViewColumn | null) => void) => {
    const cached = registry.refs.get(id);
    if (cached !== undefined && cached.external === external) return cached.callback;
    const callback = (column: Gtk.ColumnViewColumn | null): void => {
        applyRef(external, column);
        if (column !== null) registry.instances.set(id, column);
        else registry.instances.delete(id);
    };
    registry.refs.set(id, { external, callback });
    return callback;
};

const releaseColumn = (registry: ColumnRegistry, id: string): void => {
    const instance = registry.instances.get(id);
    instance?.setFactory(null);
    instance?.setSorter(null);
    registry.instances.delete(id);
    registry.factories.delete(id);
    registry.sorters.delete(id);
    registry.refs.delete(id);
};

const renderColumnElement = (def: ColumnDef<unknown>, registry: ColumnRegistry, context: FactoryContext): ReactNode => {
    const { id, renderCell, sortable, headerMenu, ref, ...columnRest } = def;
    void renderCell;
    return (
        <GtkColumnViewColumn
            key={id}
            id={id}
            factory={columnFactory(registry, context, id)}
            sorter={sortable === true ? columnSorter(registry, id) : null}
            headerMenu={headerMenu}
            ref={columnRefCallback(registry, id, ref)}
            {...columnRest}
        />
    );
};

const useColumnRelease = (registry: ColumnRegistry, columns: ColumnDef<unknown>[]): void => {
    useLayoutEffect(() => {
        const active = new Set(columns.map((def) => def.id));
        for (const id of [...registry.factories.keys()]) {
            if (!active.has(id)) releaseColumn(registry, id);
        }
    }, [registry, columns]);
    useLayoutEffect(
        () => () => {
            for (const id of [...registry.factories.keys()]) releaseColumn(registry, id);
        },
        [registry],
    );
};

const useColumnSorting = (
    widget: Gtk.ColumnView | null,
    registry: ColumnRegistry,
    sort: ColumnViewSortProps,
    columns: ColumnDef<unknown>[],
): void => {
    const mutedRef = useRef(0);
    const latestRef = useRef(sort);
    latestRef.current = sort;
    useLayoutEffect(() => {
        if (widget === null) return;
        const sorter = widget.getSorter();
        if (!(sorter instanceof Gtk.ColumnViewSorter)) return;
        const handler = (): void => {
            if (mutedRef.current > 0) return;
            const column = sorter.getPrimarySortColumn();
            latestRef.current.onSortChanged?.(column?.getId() ?? null, sorter.getPrimarySortOrder());
        };
        sorter.on("changed", handler);
        return () => {
            sorter.off("changed", handler);
        };
    }, [widget]);
    const { sortColumn, sortOrder } = sort;
    useLayoutEffect(() => {
        if (widget === null || sortColumn === undefined) return;
        const column = sortColumn === null ? null : (registry.instances.get(sortColumn) ?? null);
        if (sortColumn !== null && column === null) return;
        mutedRef.current += 1;
        try {
            widget.sortByColumn(column, sortOrder ?? Gtk.SortType.ASCENDING);
        } finally {
            mutedRef.current -= 1;
        }
    }, [widget, registry, sortColumn, sortOrder, columns]);
};

type ColumnPortalOptions = {
    api: CollectionViewApi;
    columns: ColumnDef<unknown>[];
    expandedIds: string[] | null | undefined;
    renderHeader: unknown;
};

const columnPortalRenderers = (options: ColumnPortalOptions): CellRenderers => {
    const { api, expandedIds } = options;
    const columnsById = new Map(options.columns.map((def) => [def.id, def]));
    return {
        item: (record) => {
            const def = record.slot === null ? undefined : columnsById.get(record.slot);
            if (def === undefined) return null;
            const args = buildRenderItemArgs({ record, api, expandedIds });
            return args === null ? null : (def.renderCell as (input: RenderItemProps<unknown>) => ReactNode)(args);
        },
        header: asHeaderRenderer(options.renderHeader, api),
    };
};

/**
 * Renders a Gtk.ColumnView from declarative items or sections and a columns array,
 * with controlled selection, expansion, and sorting, per-column header menus, and
 * section header rendering.
 */
export function ColumnView<T = unknown, S = unknown>(props: ColumnViewProps<T, S>): ReactNode {
    const {
        items,
        sections,
        renderHeader,
        columns,
        selectedIds,
        onSelectionChanged,
        selectionMode,
        expandedIds,
        onExpandedChange,
        sortColumn,
        sortOrder,
        onSortChanged,
        estimatedItemHeight,
        children,
        ref,
        ...rest
    } = props;
    void children;
    void estimatedItemHeight;
    void items;
    void sections;
    void selectedIds;
    void onSelectionChanged;
    void selectionMode;
    void onExpandedChange;
    void ref;
    const { widget, refCallback, harness, view } = useCollectionWidget<Gtk.ColumnView>(props);
    const registryRef = useRef<ColumnRegistry | null>(null);
    registryRef.current ??= createRegistry();
    const registry = registryRef.current;
    const columnDefs = columns as ColumnDef<unknown>[];
    useFactorySlot(widget, harness.context, "header", typeof renderHeader === "function");
    useColumnRelease(registry, columnDefs);
    useColumnSorting(widget, registry, { sortColumn, sortOrder, onSortChanged }, columnDefs);
    const portals = renderCellPortals(
        harness.tracker,
        columnPortalRenderers({ api: view.api, columns: columnDefs, expandedIds, renderHeader }),
    );
    return (
        <>
            <GtkColumnView ref={refCallback} {...rest}>
                {columnDefs.map((def) => renderColumnElement(def, registry, harness.context))}
            </GtkColumnView>
            {portals}
        </>
    );
}
