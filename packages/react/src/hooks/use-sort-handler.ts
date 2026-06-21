import * as Gtk from "@gtkx/gi/gtk";
import { useLayoutEffect, useRef } from "react";
import type { ColumnRegistration } from "../contexts/column-view-context.js";
import { type GObjectTarget, resolveGobjectTarget } from "../utils/gobject-target.js";

/**
 * Configuration for {@link useSortHandler}.
 */
export interface SortHandlerOptions {
    columnView: GObjectTarget<Gtk.ColumnView>;
    sortColumn: string | null | undefined;
    sortOrder: Gtk.SortType | null | undefined;
    onSortChanged: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
    columns: ColumnRegistration[];
}

const neutralSorter = (): Gtk.CustomSorter => Gtk.CustomSorter.new(() => 0);

const ensureColumnSorters = (columns: ColumnRegistration[], activeId: string | null): void => {
    for (const registration of columns) {
        const wantsSorter = registration.sortable || registration.id === activeId;
        const hasSorter = registration.column.getSorter() !== null;
        if (wantsSorter && !hasSorter) {
            registration.column.setSorter(neutralSorter());
        } else if (!wantsSorter && hasSorter) {
            registration.column.setSorter(null);
        }
    }
};

const columnForId = (columns: ColumnRegistration[], id: string | null): Gtk.ColumnViewColumn | null => {
    if (id === null) return null;
    for (const registration of columns) {
        if (registration.id === id) return registration.column;
    }
    return null;
};

const idForColumn = (columns: ColumnRegistration[], column: Gtk.ColumnViewColumn | null): string | null => {
    if (column === null) return null;
    for (const registration of columns) {
        if (registration.column === column) return registration.id;
    }
    return column.getId();
};

const primarySort = (sorter: Gtk.Sorter): { column: Gtk.ColumnViewColumn | null; order: Gtk.SortType } =>
    sorter instanceof Gtk.ColumnViewSorter
        ? { column: sorter.getPrimarySortColumn(), order: sorter.getPrimarySortOrder() }
        : { column: null, order: Gtk.SortType.ASCENDING };

interface SorterSubscription {
    sorter: Gtk.Sorter | null;
    handler: ((change: Gtk.SorterChange) => void) | null;
}

const disconnectSorter = (subscription: SorterSubscription): void => {
    if (subscription.sorter !== null && subscription.handler !== null) {
        subscription.sorter.off("changed", subscription.handler);
    }
    subscription.sorter = null;
    subscription.handler = null;
};

/**
 * Drives the controlled sort indicator of a `GtkColumnView` and reports user-initiated changes.
 *
 * Sorting is controlled and React-side: GTK never reorders the position-only model. Each sortable
 * column (and the column named by `sortColumn`) is given a neutral `Gtk.CustomSorter` so the column
 * participates in the view's `Gtk.ColumnViewSorter` and `getSorter()` is non-null. The indicator is
 * synced to `sortColumn`/`sortOrder` through `sortByColumn` without rebuilding the model, so
 * `getModel()`/`getSorter()` never transiently null across repeated sorts. The view sorter's
 * `changed` signal is mirrored to `onSortChanged(columnId, order)` for changes the user makes (for
 * example clicking a header or `sortByColumn`), while programmatic indicator syncs are suppressed.
 *
 * @param options - The column view, controlled sort props, change callback, and registrations.
 */
export const useSortHandler = (options: SortHandlerOptions): void => {
    const { columnView, sortColumn, sortOrder, onSortChanged, columns } = options;
    const activeId = sortColumn ?? null;
    const order = sortOrder ?? Gtk.SortType.ASCENDING;

    const onChangedRef = useRef(onSortChanged);
    onChangedRef.current = onSortChanged;
    const columnsRef = useRef(columns);
    columnsRef.current = columns;
    const suppressRef = useRef(false);
    const subscriptionRef = useRef<SorterSubscription>({ sorter: null, handler: null });

    const resubscribe = (sorter: Gtk.Sorter | null): void => {
        const subscription = subscriptionRef.current;
        if (sorter === subscription.sorter) return;
        disconnectSorter(subscription);
        if (sorter === null) return;
        const handler = (): void => {
            if (suppressRef.current) return;
            const callback = onChangedRef.current;
            if (!callback) return;
            const { column, order: primaryOrder } = primarySort(sorter);
            callback(idForColumn(columnsRef.current, column), primaryOrder);
        };
        subscription.sorter = sorter;
        subscription.handler = handler;
        sorter.on("changed", handler);
    };

    useLayoutEffect(() => {
        const view = resolveGobjectTarget(columnView);
        if (view === null) return;
        ensureColumnSorters(columns, activeId);
        suppressRef.current = true;
        view.sortByColumn(columnForId(columns, activeId), order);
        suppressRef.current = false;
        resubscribe(view.getSorter());
    });

    useLayoutEffect(() => () => disconnectSorter(subscriptionRef.current), []);
};
