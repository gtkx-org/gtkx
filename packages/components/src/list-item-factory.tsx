import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode } from "react";
import { GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import type { ListItemFactoryProps } from "./types.js";
import { NativeItemPortals, useItemCells } from "./internal/cells.js";

/**
 * Creates a Gtk.SignalListItemFactory that renders objects from an existing native model with React.
 * Estimated dimensions keep cells stable until their content mounts.
 */
function ListItemFactory<T extends GObject.Object>({
    renderItem,
    estimatedItemHeight = -1,
    estimatedItemWidth = -1,
}: ListItemFactoryProps<T>): ReactNode {
    const size = { width: estimatedItemWidth, height: estimatedItemHeight };
    const cells = useItemCells(size);

    return (
        <>
            <GtkSignalListItemFactory {...cells.handlers} />
            <NativeItemPortals registry={cells} render={renderItem} size={size} />
        </>
    );
}

export { ListItemFactory };
