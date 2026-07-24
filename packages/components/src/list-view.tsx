import type * as Gtk from "@gtkx/gi/gtk";
import { GtkListView } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { collectionPortals } from "./internal/cell-portals.js";
import { useCollectionWidget } from "./internal/use-collection-widget.js";
import { useFactorySlot } from "./internal/use-factories.js";
import type { ListViewProps } from "./types.js";

/**
 * Renders a Gtk.ListView from declarative items or sections, with per-row rendering,
 * controlled selection, controlled tree expansion, and estimated item sizing.
 */
export function ListView<T = unknown, S = unknown>(props: ListViewProps<T, S>): ReactNode {
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
        ref,
        ...rest
    } = props;
    void items;
    void sections;
    void selectedIds;
    void onSelectionChanged;
    void selectionMode;
    void onExpandedChange;
    void estimatedItemHeight;
    void estimatedItemWidth;
    void ref;
    const { widget, refCallback, harness, view } = useCollectionWidget<Gtk.ListView>(props);
    useFactorySlot(widget, harness.context, "item");
    useFactorySlot(widget, harness.context, "header", typeof renderHeader === "function");
    const portals = collectionPortals({ harness, view, renderItem, renderHeader, expandedIds });
    return (
        <>
            <GtkListView ref={refCallback} {...rest} />
            {portals}
        </>
    );
}
