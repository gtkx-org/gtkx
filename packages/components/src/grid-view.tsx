import type { ReactNode } from "react";
import { GtkGridView, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import type { GridViewProps } from "./types.js";
import { collectionRenderers } from "./internal/use-cells.js";
import { useCollection } from "./internal/use-collection.js";

/**
 * Renders a Gtk.GridView of uniform cells from declarative items, with per-cell
 * rendering, controlled selection, and estimated item sizing.
 */
function GridView<T = unknown>(props: GridViewProps<T>): ReactNode {
    const {
        items,
        renderItem,
        selectedIds,
        onSelectionChanged,
        selectionMode,
        estimatedItemHeight,
        estimatedItemWidth,
        ...rest
    } = props;

    const { model, cells, selection } = useCollection({
        items,
        mode: "flat",
        size: { width: estimatedItemWidth ?? -1, height: estimatedItemHeight ?? -1 },
        selectedIds,
        onSelectionChanged,
        selectionMode,
    });

    return (
        <>
            <GtkGridView model={selection} factory={<GtkSignalListItemFactory {...cells.item} />} {...rest} />
            {cells.portals(collectionRenderers({ collection: model, renderItem }), model)}
        </>
    );
}

export { GridView };
