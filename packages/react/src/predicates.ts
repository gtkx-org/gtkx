import type * as Gtk from "@gtkx/ffi/gtk";

interface Appendable extends Gtk.Widget {
    append(child: unknown): void;
}

interface SingleChild extends Gtk.Widget {
    setChild(child: unknown): void;
}

interface Removable extends Gtk.Widget {
    remove(child: unknown): void;
}

export const isAppendable = (widget: Gtk.Widget): widget is Appendable =>
    "append" in widget && typeof widget.append === "function";

export const isSingleChild = (widget: Gtk.Widget): widget is SingleChild =>
    "setChild" in widget && typeof widget.setChild === "function";

export const isRemovable = (widget: Gtk.Widget): widget is Removable =>
    "remove" in widget && typeof widget.remove === "function";
