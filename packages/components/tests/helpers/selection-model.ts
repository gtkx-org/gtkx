import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";

const getSelectionModel = (listRef: RefObject<Gtk.ListView | null>): Gtk.SelectionModel => {
    const model = listRef.current?.getModel() ?? null;

    if (model === null) {
        throw new TypeError("Expected the list view to expose a selection model");
    }

    return model;
};

const getTreeRow = (model: Gtk.SelectionModel, position: number): Gtk.TreeListRow => {
    const row = model.getItem(position);

    if (!(row instanceof Gtk.TreeListRow)) {
        throw new TypeError("Expected a tree list row");
    }

    return row;
};

export { getSelectionModel, getTreeRow };
