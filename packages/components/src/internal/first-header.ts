import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";

type SectionedWidget = Gtk.ListView | Gtk.ColumnView | Gtk.DropDown | Adw.ComboRow;

/**
 * TODO: GTK 4.22 anchors a list whose model fills after the list holds it at the first row, scrolled past that
 * row's section header. Scrolling a view to its first row, or handing a drop-down its filled model again, starts
 * it at the header. Remove once a GTK release fixes the anchor and GTKX requires it.
 */
function showFirstHeader(widget: SectionedWidget | null): void {
    if (widget instanceof Gtk.ListView) {
        widget.scrollTo(0, Gtk.ListScrollFlags.NONE, null);
    } else if (widget instanceof Gtk.ColumnView) {
        widget.scrollTo(0, null, Gtk.ListScrollFlags.NONE, null);
    } else if (widget !== null) {
        const model = widget.getModel();
        widget.setModel(null);
        widget.setModel(model);
    }
}

export { showFirstHeader };
