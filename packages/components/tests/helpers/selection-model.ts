import type { RefObject } from "react";
import * as Gtk from "@gtkx/gi/gtk";

type SelectionOwner = { getModel: () => Gtk.SelectionModel | null };

const getSelectionModel = (viewRef: RefObject<SelectionOwner | null>): Gtk.SelectionModel => {
    const model = viewRef.current?.getModel() ?? null;

    if (model === null) {
        throw new TypeError("Expected the view to expose a selection model");
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
