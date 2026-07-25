import type * as Gtk from "@gtkx/gi/gtk";
import { defineElementBehaviors } from "@gtkx/react/element-behaviors";

export default defineElementBehaviors({
    GtkWidget: [
        {
            update: (widget: Gtk.Widget, prev, next) => {
                const name = next.cursorName;
                if (!Object.is(prev.cursorName, name) && typeof name === "string") widget.setCursorFromName(name);
                return ["cursorName"];
            },
        },
    ],
    GtkFrame: [
        {
            attach: (frame: Gtk.Frame, child, info) => {
                if (info.slot !== "labelSlot") return undefined;
                frame.setLabelWidget(child as Gtk.Widget);
                return true;
            },
            detach: (frame: Gtk.Frame, _child, info) => {
                if (info.slot === "labelSlot") frame.setLabelWidget(null);
            },
        },
    ],
});
