import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkColumnViewColumn, GtkCustomSorter, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { useProperty, useSignal } from "@gtkx/react";
import { omit } from "@gtkx/utils";
import { useLayoutEffect, useRef } from "react";
import type { CollectionModel } from "./internal/collection-model.js";
import type { CellRecord, CellRenderers, Cells } from "./internal/use-cells.js";
import type { Column, ColumnViewProps, HeaderRenderer } from "./types.js";
import { headerRenderer, renderItemArgs } from "./internal/use-cells.js";
import { useCollection } from "./internal/use-collection.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";

type SortProps = {
    sortColumn?: string | null | undefined;
    sortOrder?: Gtk.SortType | null | undefined;
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
};

type SortTarget = { view: Gtk.ColumnView; column: Gtk.ColumnViewColumn | null };

type ColumnRenderersOptions = {
    collection: CollectionModel;
    columns: Column[];
    expandedIds: string[] | null | undefined;
    renderHeader: HeaderRenderer<never> | null | undefined;
};

const COLUMN_VIEW_PROPS = [
    "items",
    "sections",
    "renderHeader",
    "columns",
    "selectedIds",
    "onSelectionChanged",
    "selectionMode",
    "expandedIds",
    "onExpandedChange",
    "sortColumn",
    "sortOrder",
    "onSortChanged",
    "estimatedItemHeight",
    "children",
    "ref",
] as const satisfies (keyof ColumnViewProps)[];

const columnById = (view: Gtk.ColumnView, id: string): Gtk.ColumnViewColumn | null => {
    const columns = view.getColumns();

    for (let index = 0; index < columns.getNItems(); index++) {
        const column = columns.getItem(index);

        if (column instanceof Gtk.ColumnViewColumn && column.getId() === id) {
            return column;
        }
    }

    return null;
};

const getSortTarget = (view: Gtk.ColumnView | null, sortColumn: string | null | undefined): SortTarget | null => {
    if (view === null || sortColumn === undefined) {
        return null;
    }

    if (sortColumn === null) {
        return { view, column: null };
    }

    const column = columnById(view, sortColumn);

    return column === null ? null : { view, column };
};

const applySort = (
    sorting: { current: boolean },
    view: Gtk.ColumnView,
    column: Gtk.ColumnViewColumn | null,
    order: Gtk.SortType | null | undefined,
): void => {
    sorting.current = true;

    try {
        view.sortByColumn(column, order ?? Gtk.SortType.ASCENDING);
    } finally {
        sorting.current = false;
    }
};

const emitSortChanged = (
    sorter: Gtk.ColumnViewSorter | null,
    sorting: { current: boolean },
    sort: SortProps,
): void => {
    if (sorter === null || sorting.current) {
        return;
    }

    sort.onSortChanged?.(sorter.getPrimarySortColumn()?.getId() ?? null, sorter.getPrimarySortOrder());
};

const syncSort = (
    sorting: { current: boolean },
    view: Gtk.ColumnView | null,
    sortColumn: string | null | undefined,
    sortOrder: Gtk.SortType | null | undefined,
): void => {
    const target = getSortTarget(view, sortColumn);

    if (target === null) {
        return;
    }

    applySort(sorting, target.view, target.column, sortOrder);
};

const useColumnSorting = (view: Gtk.ColumnView | null, sort: SortProps, columns: Column[]): void => {
    const sorting = useRef(false);
    const sorter = useProperty(view, "sorter");
    const columnSorter = sorter instanceof Gtk.ColumnViewSorter ? sorter : null;

    useSignal(columnSorter, "changed", (): void => {
        emitSortChanged(columnSorter, sorting, sort);
    });

    const { sortColumn, sortOrder } = sort;

    useLayoutEffect(() => {
        syncSort(sorting, view, sortColumn, sortOrder);
    }, [view, sortColumn, sortOrder, columns]);
};

const renderColumn = (column: Column, cells: Cells): ReactNode => {
    const { id, sortable } = column;
    const rest = omit(column, ["id", "renderCell", "sortable"]);

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

const columnItem = (
    record: CellRecord,
    byId: Map<string, Column>,
    options: ColumnRenderersOptions,
): ReactNode => {
    const column = record.slot === null ? undefined : byId.get(record.slot);

    if (column === undefined) {
        return null;
    }

    const args = renderItemArgs(record, options);

    return args === null ? null : (column.renderCell)(args);
};

const columnRenderers = (options: ColumnRenderersOptions): CellRenderers => {
    const byId = new Map(options.columns.map((column) => [column.id, column]));

    return {
        item: (record) => columnItem(record, byId, options),
        header: headerRenderer(options.collection, options.renderHeader),
    };
};

/**
 * Renders a Gtk.ColumnView from declarative items or sections and a columns array,
 * with controlled selection, expansion, and sorting, per-column header menus, and
 * section header rendering.
 */
function ColumnView<T = unknown, S = unknown>(props: ColumnViewProps<T, S>): ReactNode {
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
        ref,
    } = props;

    const rest = omit(props, COLUMN_VIEW_PROPS);
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

    const columnList = columns as Column[];
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
            {cells.portals(
                columnRenderers({ collection: model, columns: columnList, expandedIds, renderHeader }),
                model,
            )}
        </>
    );
}

export { ColumnView };
