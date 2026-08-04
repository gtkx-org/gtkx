import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";

const nextTick = (widget: Gtk.Widget): Promise<void> =>
    new Promise((resolve) => {
        widget.addTickCallback(() => {
            resolve();

            return GLib.SOURCE_REMOVE;
        });
    });

const pumpFrames = async (widget: Gtk.Widget, times: number): Promise<void> => {
    for (let index = 0; index < times; index++) {
        await nextTick(widget);
    }
};

const scrollPages = async (widget: Gtk.Widget, pages: number): Promise<void> => {
    const scroller = widget.getAncestor(Gtk.ScrolledWindow.prototype.__type__) as Gtk.ScrolledWindow | null;

    if (scroller === null) {
        throw new Error("Expected the widget to sit inside a scrolled window");
    }

    const adjustment = scroller.getVadjustment();

    for (let page = 0; page < pages; page++) {
        adjustment.setValue(
            Math.min(
                adjustment.getUpper() - adjustment.getPageSize(),
                adjustment.getValue() + adjustment.getPageSize(),
            ),
        );

        await pumpFrames(widget, 2);
    }
};

export { pumpFrames, scrollPages };
