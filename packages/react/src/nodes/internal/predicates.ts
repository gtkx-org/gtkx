import * as Gtk from "@gtkx/ffi/gtk";

export const isAppendable = (obj: unknown): obj is Gtk.Widget & { append: (child: Gtk.Widget) => void } => {
    return obj instanceof Gtk.Widget && "append" in obj && typeof obj.append === "function";
};

export const isSingleChild = (obj: unknown): obj is Gtk.Widget & { setChild: (child: Gtk.Widget | null) => void } => {
    return obj instanceof Gtk.Widget && "setChild" in obj && typeof obj.setChild === "function";
};

export const isRemovable = (obj: unknown): obj is Gtk.Widget & { remove: (child: Gtk.Widget) => void } => {
    return obj instanceof Gtk.Widget && "remove" in obj && typeof obj.remove === "function";
};

export const isIndexable = (
    obj: unknown,
): obj is Gtk.Widget & { insertChildAtIndex: (child: Gtk.Widget, index: number) => void } => {
    return obj instanceof Gtk.Widget && "insertChildAtIndex" in obj && typeof obj.insertChildAtIndex === "function";
};

export const isReorderable = (
    obj: unknown,
): obj is Gtk.Widget & {
    reorderChildAfter: (child: Gtk.Widget, sibling?: Gtk.Widget) => void;
    insertChildAfter: (child: Gtk.Widget, sibling?: Gtk.Widget) => void;
} => {
    return (
        obj instanceof Gtk.Widget &&
        "reorderChildAfter" in obj &&
        typeof obj.reorderChildAfter === "function" &&
        "insertChildAfter" in obj &&
        typeof obj.insertChildAfter === "function"
    );
};
