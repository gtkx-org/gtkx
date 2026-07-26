import type { ReactNode } from "react";
import { GtkListView, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import type { ListViewProps } from "./types.js";
import { collectionRenderers } from "./internal/use-cells.js";
import { useCollection } from "./internal/use-collection.js";

/**
 * Renders a Gtk.ListView from declarative items or sections, with per-row rendering,
 * controlled selection, controlled tree expansion, and estimated item sizing.
 */
function ListView<T = unknown, S = unknown>(props: ListViewProps<T, S>): ReactNode {
    const {
        items,
        sections,
        renderItem,
        renderHeader,
        selectedIds,
        onSelectionChanged,
        selectionMode,
        expandedIds,
        onExpandedChange,
        estimatedItemHeight,
        estimatedItemWidth,
        ...rest
    } = props;

    const { model, cells, selection } = useCollection({
        items,
        sections,
        size: { width: estimatedItemWidth ?? -1, height: estimatedItemHeight ?? -1 },
        selectedIds,
        onSelectionChanged,
        selectionMode,
        expandedIds,
        onExpandedChange,
    });

    return (
        <>
            <GtkListView
                model={selection}
                factory={<GtkSignalListItemFactory {...cells.item} />}
                {...(renderHeader != null && { headerFactory: <GtkSignalListItemFactory {...cells.header} /> })}
                {...rest}
            />
            {cells.portals(collectionRenderers({ collection: model, expandedIds, renderItem, renderHeader }), model)}
        </>
    );
}

export { ListView };
