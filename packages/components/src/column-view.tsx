import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkColumnViewColumn, GtkCustomSorter, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import { omit } from "@gtkx/utils";
import { useLayoutEffect, useRef } from "react";
import type { CellSize } from "./internal/cells.js";
import type { Collection } from "./internal/collection.js";
import type { Column, ColumnViewProps } from "./types.js";
import { HeaderPortals, ItemPortals, useHeaderCells, useItemCells } from "./internal/cells.js";
import { useCollection } from "./internal/use-collection.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";

type SortProps = {
    sortColumn?: string | null | undefined;
    sortOrder?: Gtk.SortType | null | undefined;
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
};

type SortTarget = { view: Gtk.ColumnView; column: Gtk.ColumnViewColumn | null };

type ColumnCellsProps = {
    column: Column<never>;
    collection: Collection;
    expandedIds: string[] | null | undefined;
    size: CellSize;
};

type ColumnListProps = Omit<ColumnCellsProps, "column"> & {
    columns: Column<never>[];
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

const useColumnSorting = (view: Gtk.ColumnView | null, sort: SortProps, columns: Column<never>[]): void => {
    const sorting = useRef(false);
    const sorter = view?.getSorter() ?? null;
    const columnSorter = sorter instanceof Gtk.ColumnViewSorter ? sorter : null;

    useSignal(columnSorter, "changed", (): void => {
        emitSortChanged(columnSorter, sorting, sort);
    });

    const { sortColumn, sortOrder } = sort;

    useLayoutEffect(() => {
        syncSort(sorting, view, sortColumn, sortOrder);
    }, [view, sortColumn, sortOrder, columns]);
};

const ColumnCells = ({ column, collection, expandedIds, size }: ColumnCellsProps): ReactNode => {
    const cells = useItemCells(size);
    const rest = omit(column, ["id", "renderCell", "sortable"]);

    return (
        <>
            <GtkColumnViewColumn
                id={column.id}
                factory={<GtkSignalListItemFactory {...cells.handlers} />}
                sorter={column.sortable === true ? <GtkCustomSorter /> : null}
                {...rest}
            />
            <ItemPortals
                store={cells}
                render={column.renderCell}
                collection={collection}
                expandedIds={expandedIds}
            />
        </>
    );
};

const ColumnList = ({ columns, collection, expandedIds, size }: ColumnListProps): ReactNode =>
    columns.map((column) => (
        <ColumnCells
            key={column.id}
            column={column}
            collection={collection}
            expandedIds={expandedIds}
            size={size}
        />
    ));

/**
 * Renders a Gtk.ColumnView from declarative items or sections and a columns array,
 * with controlled selection, expansion, and sorting, per-column header menus, and
 * section header rendering.
 */
function ColumnView<T = unknown, S = unknown>(props: ColumnViewProps<T, S>): ReactNode {
    const { renderHeader, columns, expandedIds, sortColumn, sortOrder, onSortChanged, estimatedItemHeight, ref } =
        props;

    const rest = omit(props, COLUMN_VIEW_PROPS);
    const [view, refCallback] = useWidgetRef<Gtk.ColumnView>(ref);
    const size = { width: -1, height: estimatedItemHeight ?? -1 };
    const { collection, selection } = useCollection(props);
    const headerCells = useHeaderCells(size);
    const columnList = columns as Column<never>[];
    useColumnSorting(view, { sortColumn, sortOrder, onSortChanged }, columnList);

    return (
        <>
            <GtkColumnView
                ref={refCallback}
                model={selection}
                {...(renderHeader != null && {
                    headerFactory: <GtkSignalListItemFactory {...headerCells.handlers} />,
                })}
                {...rest}
            >
                <ColumnList columns={columnList} collection={collection} expandedIds={expandedIds} size={size} />
            </GtkColumnView>
            {renderHeader != null && (
                <HeaderPortals store={headerCells} render={renderHeader} collection={collection} />
            )}
        </>
    );
}

export { ColumnView };
