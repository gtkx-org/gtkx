import * as Gtk from "@gtkx/gi/gtk";
import { useCallback, useState } from "react";

type SortState<C> = {
    sortColumn: C | null;
    sortOrder: Gtk.SortType;
    handleSortChange: (column: string | null, order: Gtk.SortType) => void;
};

const useSortState = <C extends string | null>(): SortState<C> => {
    const [sortColumn, setSortColumn] = useState<C | null>(null);
    const [sortOrder, setSortOrder] = useState<Gtk.SortType>(Gtk.SortType.ASCENDING);

    const handleSortChange = useCallback((column: string | null, order: Gtk.SortType) => {
        setSortColumn(column as C | null);
        setSortOrder(order);
    }, []);

    return { sortColumn, sortOrder, handleSortChange };
};

export { useSortState };
