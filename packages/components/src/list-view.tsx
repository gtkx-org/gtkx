import type { ReactNode } from "react";
import { GtkListView, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { omit } from "@gtkx/utils";
import type { ListViewProps } from "./types.js";
import { ItemPortals, useItemCells, useSectionHeader } from "./internal/cells.js";
import { useCollection } from "./internal/use-collection.js";

const LIST_VIEW_PROPS = [
    "items",
    "sections",
    "renderItem",
    "renderHeader",
    "selectedIds",
    "onSelectionChanged",
    "selectionMode",
    "expandedIds",
    "onExpandedChange",
    "expanderDescriptions",
    "estimatedItemHeight",
    "estimatedItemWidth",
] as const satisfies (keyof ListViewProps)[];

/**
 * Renders a Gtk.ListView from declarative items or sections, with per-row rendering,
 * controlled selection, controlled tree expansion, and estimated item sizing.
 */
function ListView<T = unknown, S = unknown>(props: ListViewProps<T, S>): ReactNode {
    const { renderItem, renderHeader, expandedIds, expanderDescriptions } = props;
    const { estimatedItemHeight, estimatedItemWidth } = props;
    const rest = omit(props, LIST_VIEW_PROPS);
    const size = { width: estimatedItemWidth ?? -1, height: estimatedItemHeight ?? -1 };
    const { collection, selection } = useCollection(props);
    const itemCells = useItemCells(size);
    const header = useSectionHeader(renderHeader, collection, size);

    return (
        <>
            <GtkListView
                model={selection}
                factory={<GtkSignalListItemFactory {...itemCells.handlers} />}
                {...header.factoryProps}
                {...rest}
            />
            <ItemPortals
                registry={itemCells}
                render={renderItem}
                collection={collection}
                expandedIds={expandedIds}
                expanderDescriptions={expanderDescriptions}
            />
            {header.portals}
        </>
    );
}

export { ListView };
