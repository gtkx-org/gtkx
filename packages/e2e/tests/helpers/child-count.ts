import type * as Gtk from "@gtkx/ffi/gtk";

/** Counts the direct children of a widget by walking its sibling chain. */
export const countChildren = (widget: Gtk.Widget | null | undefined): number => {
    let count = 0;
    let child = widget?.getFirstChild();
    while (child) {
        count++;
        child = child.getNextSibling();
    }
    return count;
};
