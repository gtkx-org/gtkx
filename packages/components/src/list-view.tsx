import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";
import { GtkListView, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { omit } from "@gtkx/utils";
import type { ListViewProps } from "./types.js";
import { ItemPortals, useItemCells, useSectionHeader } from "./internal/cells.js";
import { showFirstHeader } from "./internal/first-header.js";
import { useCollection } from "./internal/use-collection.js";
import { useWidgetRef } from "./internal/use-widget-ref.js";

const LIST_VIEW_PROPS = [
    "items",
    "sections",
    "isFlat",
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
    "ref",
] as const satisfies (keyof ListViewProps)[];

/**
 * Renders a Gtk.ListView from declarative items or sections, with per-row rendering,
 * controlled selection, controlled tree expansion, and estimated item sizing.
 */
function ListView<T = unknown, S = unknown>(props: ListViewProps<T, S>): ReactNode {
    const { renderItem, renderHeader, expandedIds, expanderDescriptions, ref } = props;
    const { estimatedItemHeight, estimatedItemWidth } = props;
    const rest = omit(props, LIST_VIEW_PROPS);
    const size = { width: estimatedItemWidth ?? -1, height: estimatedItemHeight ?? -1 };
    const [view, refCallback] = useWidgetRef<Gtk.ListView>(ref);
    const { collection, selection } = useCollection({ ...props, onSectionsFilled: () => showFirstHeader(view) });
    const itemCells = useItemCells(size);
    const header = useSectionHeader(renderHeader, collection, size);

    return (
        <>
            <GtkListView
                ref={refCallback}
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
