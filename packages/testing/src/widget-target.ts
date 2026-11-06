import * as Gtk from "@gtkx/gi/gtk";
import { usageError } from "./usage-error.js";

const requireWidget = (target: object): Gtk.Widget => {
    if (!(target instanceof Gtk.Widget)) {
        throw usageError(new TypeError("Expected a Gtk.Widget"));
    }

    return target;
};

export { requireWidget };
