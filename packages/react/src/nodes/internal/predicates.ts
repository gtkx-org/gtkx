import * as Gtk from "@gtkx/ffi/gtk";

type AppendableWidget = Gtk.Widget & { append: (child: Gtk.Widget) => void };
type AddableWidget = Gtk.Widget & { add: (child: Gtk.Widget) => void };
type ContentWidget = Gtk.Widget & { setContent: (content?: Gtk.Widget | null) => void };
type SingleChildWidget = Gtk.Widget & { setChild: (child: Gtk.Widget | null) => void };
type RemovableWidget = Gtk.Widget & { remove: (child: Gtk.Widget) => void };
export type ReorderableWidget = Gtk.Widget & {
    reorderChildAfter: (child: Gtk.Widget, sibling?: Gtk.Widget) => void;
    insertChildAfter: (child: Gtk.Widget, sibling?: Gtk.Widget) => void;
};
export type InsertableWidget = Gtk.Widget & {
    insert: (child: Gtk.Widget, position: number) => void;
    getFirstChild: () => Gtk.Widget | null;
};
type EditableWidget = Gtk.Widget & {
    getPosition: () => number;
    setPosition: (position: number) => void;
    getText: () => string;
};

export const isAppendable = (obj: unknown): obj is AppendableWidget => {
    return obj instanceof Gtk.Widget && "append" in obj && typeof obj.append === "function";
};

export const isAddable = (obj: unknown): obj is AddableWidget => {
    return obj instanceof Gtk.Widget && "add" in obj && typeof obj.add === "function";
};

export const hasSingleContent = (obj: unknown): obj is ContentWidget => {
    return obj instanceof Gtk.Widget && "setContent" in obj && typeof obj.setContent === "function";
};

export const isSingleChild = (obj: unknown): obj is SingleChildWidget => {
    return obj instanceof Gtk.Widget && "setChild" in obj && typeof obj.setChild === "function";
};

export const isRemovable = (obj: unknown): obj is RemovableWidget => {
    return obj instanceof Gtk.Widget && "remove" in obj && typeof obj.remove === "function";
};

export const isReorderable = (obj: unknown): obj is ReorderableWidget => {
    return (
        obj instanceof Gtk.Widget &&
        "reorderChildAfter" in obj &&
        typeof obj.reorderChildAfter === "function" &&
        "insertChildAfter" in obj &&
        typeof obj.insertChildAfter === "function"
    );
};

export const isInsertable = (obj: unknown): obj is InsertableWidget => {
    return (
        obj instanceof Gtk.Widget &&
        "insert" in obj &&
        typeof obj.insert === "function" &&
        "getFirstChild" in obj &&
        typeof obj.getFirstChild === "function"
    );
};

export const isEditable = (obj: unknown): obj is EditableWidget => {
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
