import type { ReactNode, RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkColumnView, GtkColumnViewColumn, GtkCustomSorter, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import { omit } from "@gtkx/utils";
import { useLayoutEffect, useRef } from "react";
import type { CellSize } from "./internal/cells.js";
import type { Collection } from "./internal/collection.js";
import type { ColumnViewColumn, ColumnViewProps, ExpanderDescriptions, SortProps } from "./types.js";
import { ItemPortals, useItemCells, useRowProps, useSectionHeader } from "./internal/cells.js";
import { useCollection } from "./internal/use-collection.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";

type SortTarget = { view: Gtk.ColumnView; column: Gtk.ColumnViewColumn | null };

type ColumnCellsProps = {
    column: ColumnViewColumn<never>;
    hasExpander: boolean;
    collection: Collection;
    expandedIds: string[] | null | undefined;
    expanderDescriptions: ExpanderDescriptions | null | undefined;
    size: CellSize;
};

type ColumnListProps = Omit<ColumnCellsProps, "column" | "hasExpander"> & {
    columns: ColumnViewColumn<never>[];
};

const COLUMN_VIEW_PROPS = [
    "items",
    "sections",
    "renderHeader",
    "rowProps",
    "columns",
    "selectedIds",
    "onSelectionChanged",
    "selectionMode",
    "expandedIds",
    "onExpandedChange",
    "expanderDescriptions",
    "sortColumn",
    "sortOrder",
    "onSortChanged",
    "estimatedItemHeight",
    "children",
    "ref",
] as const satisfies (keyof ColumnViewProps)[];

const expanderIndexFor = (columns: ColumnViewColumn<never>[]): number =>
    columns.findIndex((column) => column.visible !== false);

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
    sorting: RefObject<boolean>,
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
    sorting: RefObject<boolean>,
    sort: SortProps,
): void => {
    if (sorter === null || sorting.current) {
        return;
    }

    sort.onSortChanged?.(sorter.getPrimarySortColumn()?.getId() ?? null, sorter.getPrimarySortOrder());
};

const syncSort = (
    sorting: RefObject<boolean>,
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

const useColumnSorting = (view: Gtk.ColumnView | null, sort: SortProps, columns: ColumnViewColumn<never>[]): void => {
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

const ColumnCells = ({
    column,
    hasExpander,
    collection,
    expandedIds,
    expanderDescriptions,
    size,
}: ColumnCellsProps): ReactNode => {
    const cells = useItemCells(size);
    const rest = omit(column, ["id", "renderCell", "isSortable"]);

    return (
        <>
            <GtkColumnViewColumn
                id={column.id}
                factory={<GtkSignalListItemFactory {...cells.handlers} />}
                sorter={column.isSortable === true ? <GtkCustomSorter /> : null}
                {...rest}
            />
            <ItemPortals
                registry={cells}
                render={column.renderCell}
                collection={collection}
                hasExpander={hasExpander}
                expandedIds={expandedIds}
                expanderDescriptions={expanderDescriptions}
            />
        </>
    );
};

const ColumnList = ({ columns, collection, expandedIds, expanderDescriptions, size }: ColumnListProps): ReactNode => {
    const expanderIndex = expanderIndexFor(columns);

    return columns.map((column, index) => (
        <ColumnCells
            key={column.id}
            column={column}
            hasExpander={index === expanderIndex}
            collection={collection}
            expandedIds={expandedIds}
            expanderDescriptions={expanderDescriptions}
            size={size}
        />
    ));
};

/**
 * Renders a Gtk.ColumnView from declarative items or sections and a columns array,
 * with controlled selection, expansion, and sorting, per-column header menus,
 * section header rendering, and per-row props such as a screen-reader label.
 */
function ColumnView<T = unknown, S = unknown>(props: ColumnViewProps<T, S>): ReactNode {
    const { renderHeader, rowProps, columns, expandedIds, expanderDescriptions } = props;
    const { sortColumn, sortOrder, onSortChanged, ref } = props;
    const rest = omit(props, COLUMN_VIEW_PROPS);
    const size = { width: -1, height: props.estimatedItemHeight ?? -1 };
    const [view, refCallback] = useWidgetRef<Gtk.ColumnView>(ref);
    const { collection, selection } = useCollection(props);
    const header = useSectionHeader(renderHeader, collection, size);
    const rows = useRowProps(rowProps, collection, expandedIds);
    const columnList = columns as ColumnViewColumn<never>[];
    useColumnSorting(view, { sortColumn, sortOrder, onSortChanged }, columnList);

    return (
        <>
            <GtkColumnView
                ref={refCallback}
                model={selection}
                {...header.factoryProps}
                {...rows.factoryProps}
                {...rest}
            >
                <ColumnList
                    columns={columnList}
                    collection={collection}
                    expandedIds={expandedIds}
                    expanderDescriptions={expanderDescriptions}
                    size={size}
                />
            </GtkColumnView>
            {header.portals}
            {rows.portals}
        </>
    );
}

export { ColumnView };
