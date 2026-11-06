import type { ReactNode } from "react";
import { GtkGridView, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { omit } from "@gtkx/utils";
import type { GridViewProps } from "./types.js";
import { ItemPortals, useItemCells } from "./internal/cells.js";
import { useCollection } from "./internal/use-collection.js";

const GRID_VIEW_PROPS = [
    "items",
    "renderItem",
    "rowProps",
    "selectedIds",
    "onSelectionChanged",
    "selectionMode",
    "estimatedItemHeight",
    "estimatedItemWidth",
] as const satisfies (keyof GridViewProps)[];

/**
 * Renders a Gtk.GridView of uniform cells from declarative items, with per-cell
 * rendering, controlled selection, and estimated item sizing.
 */
function GridView<T = unknown>(props: GridViewProps<T>): ReactNode {
    const { renderItem, rowProps, estimatedItemHeight, estimatedItemWidth } = props;
    const rest = omit(props, GRID_VIEW_PROPS);
    const size = { width: estimatedItemWidth ?? -1, height: estimatedItemHeight ?? -1 };
    const { collection, selection } = useCollection({ ...props, isFlat: true });
    const itemCells = useItemCells(size);

    return (
        <>
            <GtkGridView model={selection} factory={<GtkSignalListItemFactory {...itemCells.handlers} />} {...rest} />
            <ItemPortals registry={itemCells} render={renderItem} rowProps={rowProps} collection={collection} />
        </>
    );
}

export { GridView };
