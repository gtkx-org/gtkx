import type * as Gtk from "@gtkx/gi/gtk";
import { defineElementProps } from "@gtkx/react/element-rules";

export default defineElementProps({
    GtkWidget: [
        {
            type: "value",
            name: "cursorName",
            behavior: (widget: Gtk.Widget, name: string) => {
                widget.setCursorFromName(name);
            },
        },
    ],
    GtkFrame: [
        {
            type: "container",
            name: "labelSlot",
            child: "GtkWidget",
            behavior: {
                attach: (frame: Gtk.Frame, child: Gtk.Widget) => frame.setLabelWidget(child),
                detach: (frame: Gtk.Frame) => frame.setLabelWidget(null),
            },
        },
    ],
});
