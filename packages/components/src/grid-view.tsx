import type * as Gtk from "@gtkx/gi/gtk";
import { GtkGridView } from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";
import { collectionPortals } from "./internal/cell-portals.js";
import { useCollectionWidget } from "./internal/use-collection-widget.js";
import { useFactorySlot } from "./internal/use-factories.js";
import type { GridViewProps } from "./types.js";

/**
 * Renders a Gtk.GridView of uniform cells from declarative items, with per-cell
 * rendering, controlled selection, and estimated item sizing.
 */
export function GridView<T = unknown>(props: GridViewProps<T>): ReactNode {
    const {
        items,
        renderItem,
        selectedIds,
        onSelectionChanged,
        selectionMode,
        estimatedItemHeight,
        estimatedItemWidth,
        ref,
        ...rest
    } = props;
    void items;
    void selectedIds;
    void onSelectionChanged;
    void selectionMode;
    void estimatedItemHeight;
    void estimatedItemWidth;
    void ref;
    const { widget, refCallback, harness, view } = useCollectionWidget<Gtk.GridView>(props, "flat");
    useFactorySlot(widget, harness.context, "item");
    const portals = collectionPortals({ harness, view, renderItem });
    return (
        <>
            <GtkGridView ref={refCallback} {...rest} />
            {portals}
        </>
    );
}
