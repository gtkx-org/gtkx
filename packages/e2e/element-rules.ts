import type * as Gtk from "@gtkx/gi/gtk";
import { defineElementProps, valueRule } from "@gtkx/react/element-rules";

export default defineElementProps({
    GtkWidget: [
        valueRule<Gtk.Widget, string>("cursorName", (widget, name) => {
            widget.setCursorFromName(name);
        }),
    ],
});
