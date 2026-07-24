import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkColumnViewColumn, GtkCustomSorter, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import type { CollectionModel } from "./internal/collection-model.js";
import type { CellRenderers, Cells } from "./internal/use-cells.js";
import { headerRenderer, renderItemArgs } from "./internal/use-cells.js";
import { useCollection } from "./internal/use-collection.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";
import type { Column, ColumnViewProps, HeaderRenderer, ItemRenderer } from "./types.js";

type SortProps = {
    sortColumn?: string | null | undefined;
    sortOrder?: Gtk.SortType | null | undefined;
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
};

const columnById = (view: Gtk.ColumnView, id: string): Gtk.ColumnViewColumn | null => {
    const columns = view.getColumns();
    for (let index = 0; index < columns.getNItems(); index++) {
        const column = columns.getItem(index);
        if (column instanceof Gtk.ColumnViewColumn && column.getId() === id) return column;
    }
    return null;
};

const useColumnSorting = (view: Gtk.ColumnView | null, sort: SortProps, columns: Column<unknown>[]): void => {
    const sorting = useRef(false);
    const latest = useRef(sort);
    latest.current = sort;
    useLayoutEffect(() => {
        if (view === null) return;
        const sorter = view.getSorter();
        if (!(sorter instanceof Gtk.ColumnViewSorter)) return;
        const handler = (): void => {
            if (sorting.current) return;
            latest.current.onSortChanged?.(
                sorter.getPrimarySortColumn()?.getId() ?? null,
                sorter.getPrimarySortOrder(),
            );
        };
        sorter.on("changed", handler);
        return () => {
            sorter.off("changed", handler);
        };
    }, [view]);
    const { sortColumn, sortOrder } = sort;
    useLayoutEffect(() => {
        if (view === null || sortColumn === undefined) return;
        const column = sortColumn === null ? null : columnById(view, sortColumn);
        if (sortColumn !== null && column === null) return;
        sorting.current = true;
        try {
            view.sortByColumn(column, sortOrder ?? Gtk.SortType.ASCENDING);
        } finally {
            sorting.current = false;
        }
    }, [view, sortColumn, sortOrder, columns]);
};

const renderColumn = (column: Column<unknown>, cells: Cells): ReactNode => {
    const { id, renderCell, sortable, ...rest } = column;
    void renderCell;
    return (
        <GtkColumnViewColumn
            key={id}
            id={id}
            factory={<GtkSignalListItemFactory {...cells.slot(id)} />}
            sorter={sortable === true ? <GtkCustomSorter /> : null}
            {...rest}
        />
    );
};

type ColumnRenderersOptions = {
    collection: CollectionModel;
    columns: Column<unknown>[];
    expandedIds: string[] | null | undefined;
    renderHeader: HeaderRenderer<never> | null | undefined;
};

const columnRenderers = (options: ColumnRenderersOptions): CellRenderers => {
    const byId = new Map(options.columns.map((column) => [column.id, column]));
    return {
        item: (record) => {
            const column = record.slot === null ? undefined : byId.get(record.slot);
            if (column === undefined) return null;
            const args = renderItemArgs(record, options);
            return args === null ? null : (column.renderCell as ItemRenderer<unknown>)(args);
        },
        header: headerRenderer(options.collection, options.renderHeader),
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
    const [view, refCallback] = useWidgetRef<Gtk.ColumnView>(ref);
    const { model, cells, selection } = useCollection({
        items,
        sections,
        size: { width: -1, height: estimatedItemHeight ?? -1 },
        selectedIds,
        onSelectionChanged,
        selectionMode,
        expandedIds,
        onExpandedChange,
    });
    const columnList = columns as Column<unknown>[];
    useColumnSorting(view, { sortColumn, sortOrder, onSortChanged }, columnList);
    return (
        <>
            <GtkColumnView
                ref={refCallback}
                model={selection}
                {...(renderHeader != null && { headerFactory: <GtkSignalListItemFactory {...cells.header} /> })}
                {...rest}
            >
                {columnList.map((column) => renderColumn(column, cells))}
            </GtkColumnView>
            {cells.portals(columnRenderers({ collection: model, columns: columnList, expandedIds, renderHeader }))}
        </>
    );
}
