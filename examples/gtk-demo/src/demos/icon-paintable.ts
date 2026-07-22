import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";

export const lookupIconPaintable = (iconName: string, size: number): Gtk.IconPaintable | null => {
    const display = Gdk.Display.getDefault();
    if (!display) return null;
    const iconTheme = Gtk.IconTheme.getForDisplay(display);
    return iconTheme.lookupIcon(iconName, null, size, 1, Gtk.TextDirection.NONE, 0);
};
