import type * as Gtk from "@gtkx/gi/gtk";

export const countChildren = (widget: Gtk.Widget | null | undefined): number => {
    let count = 0;
    let child = widget?.getFirstChild();
    while (child) {
        count++;
        child = child.getNextSibling();
    }
    return count;
};
