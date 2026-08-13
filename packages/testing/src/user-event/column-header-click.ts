import * as Gtk from "@gtkx/gi/gtk";
import { ancestorFor, children } from "../traversal.js";
import { getWidgetTextContent } from "../widget-accessible-properties.js";

const columnsFor = (view: Gtk.ColumnView): Gtk.ColumnViewColumn[] => {
    const model = view.getColumns();
    const columns: Gtk.ColumnViewColumn[] = [];

    for (let index = 0; index < model.getNItems(); index++) {
        const column = model.getItem(index);

        if (column instanceof Gtk.ColumnViewColumn) {
            columns.push(column);
        }
    }

    return columns;
};

const headerIndexFor = (header: Gtk.Widget): number => {
    const parent = header.getParent();

    return parent === null ? -1 : [...children(parent)].indexOf(header);
};

const titledColumnFor = (columns: Gtk.ColumnViewColumn[], title: string | null): Gtk.ColumnViewColumn | null => {
    const matches = columns.filter((column) => column.getTitle() === title);

    return matches.length === 1 ? matches[0] ?? null : null;
};

const columnFor = (header: Gtk.Widget, view: Gtk.ColumnView): Gtk.ColumnViewColumn | null => {
    const columns = columnsFor(view);
    const picked = columns[headerIndexFor(header)] ?? null;
    const title = getWidgetTextContent(header);

    if (picked !== null && picked.getTitle() === title) {
        return picked;
    }

    return titledColumnFor(columns, title) ?? picked;
};

const sortableColumnFor = (header: Gtk.Widget, view: Gtk.ColumnView): Gtk.ColumnViewColumn | null => {
    const column = columnFor(header, view);

    return column !== null && column.getSorter() !== null ? column : null;
};

const invertedSortDirection = (order: Gtk.SortType): Gtk.SortType =>
    order === Gtk.SortType.ASCENDING ? Gtk.SortType.DESCENDING : Gtk.SortType.ASCENDING;

const nextSortDirection = (view: Gtk.ColumnView, column: Gtk.ColumnViewColumn): Gtk.SortType => {
    const sorter = view.getSorter();

    if (!(sorter instanceof Gtk.ColumnViewSorter) || sorter.getPrimarySortColumn() !== column) {
        return Gtk.SortType.ASCENDING;
    }

    return invertedSortDirection(sorter.getPrimarySortOrder());
};

const applyHeaderClick = (header: Gtk.Widget, nPress: number): void => {
    const view = ancestorFor(header, Gtk.ColumnView);
    const column = view === null ? null : sortableColumnFor(header, view);

    if (view === null || column === null) {
        return;
    }

    for (let press = 1; press <= nPress; press++) {
        view.sortByColumn(column, nextSortDirection(view, column));
    }
};

export { applyHeaderClick };
