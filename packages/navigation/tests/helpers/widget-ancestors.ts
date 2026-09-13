import type * as Gtk from "@gtkx/gi/gtk";

type WidgetClass<T> = abstract new (...args: never[]) => T;

const getAncestor = <T>(widget: Gtk.Widget, type: WidgetClass<T>): T => {
    let current: Gtk.Widget | null = widget;

    while (current !== null) {
        if (current instanceof type) {
            return current;
        }

        current = current.getParent();
    }

    throw new Error("The widget has no ancestor of the requested type");
};

export { getAncestor };
