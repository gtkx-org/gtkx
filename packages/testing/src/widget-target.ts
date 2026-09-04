import * as Gtk from "@gtkx/gi/gtk";

const requireWidget = (target: object): Gtk.Widget => {
    if (!(target instanceof Gtk.Widget)) {
        throw new TypeError("Expected a Gtk.Widget");
    }

    return target;
};

export { requireWidget };
