import * as Gtk from "@gtkx/ffi/gtk";

export const isAppendable = (obj: unknown): obj is Gtk.Widget & { append: (child: Gtk.Widget) => void } => {
    return obj instanceof Gtk.Widget && "append" in obj && typeof obj.append === "function";
};

export const isAddable = (obj: unknown): obj is Gtk.Widget & { add: (child: Gtk.Widget) => void } => {
    return obj instanceof Gtk.Widget && "add" in obj && typeof obj.add === "function";
};

export const isSingleChild = (obj: unknown): obj is Gtk.Widget & { setChild: (child: Gtk.Widget | null) => void } => {
    return obj instanceof Gtk.Widget && "setChild" in obj && typeof obj.setChild === "function";
};

export const isRemovable = (obj: unknown): obj is Gtk.Widget & { remove: (child: Gtk.Widget) => void } => {
    return obj instanceof Gtk.Widget && "remove" in obj && typeof obj.remove === "function";
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

export const isInsertable = (
    obj: unknown,
): obj is Gtk.Widget & {
    insert: (child: Gtk.Widget, position: number) => void;
    getFirstChild: () => Gtk.Widget | null;
} => {
    return (
        obj instanceof Gtk.Widget &&
        "insert" in obj &&
        typeof obj.insert === "function" &&
        "getFirstChild" in obj &&
        typeof obj.getFirstChild === "function"
    );
};

export const isEditable = (
    obj: unknown,
): obj is Gtk.Widget & {
    getPosition: () => number;
    setPosition: (position: number) => void;
    getText: () => string;
} => {
    return (
        obj instanceof Gtk.Widget &&
        "getPosition" in obj &&
        typeof obj.getPosition === "function" &&
        "setPosition" in obj &&
        typeof obj.setPosition === "function" &&
        "getText" in obj &&
        typeof obj.getText === "function"
    );
};
