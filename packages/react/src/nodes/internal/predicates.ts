/**
 * Runtime type predicates for GTK widget capability detection.
 *
 * These predicates check for specific APIs that widgets may or may not expose.
 * GTK widgets don't have a consistent interface - different widgets support
 * different child management APIs - so runtime checking is necessary.
 */
import * as Gtk from "@gtkx/gi/gtk";

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

type BufferedWidget = Gtk.Widget & {
    getBuffer: () => Gtk.TextBuffer;
    setBuffer: (buffer?: Gtk.TextBuffer | null) => void;
};

const hasMethod = (obj: unknown, name: string): obj is Gtk.Widget =>
    obj instanceof Gtk.Widget && name in obj && typeof Reflect.get(obj, name) === "function";

/**
 * A non-widget single-child container, such as `Gtk.ListItem`/`Gtk.ListHeader`,
 * that exposes `getChild`/`setChild` to hold one widget child.
 */
export type SingleChildContainer = {
    getChild: () => Gtk.Widget | null;
    setChild: (child: Gtk.Widget | null) => void;
};

const hasFunction = (obj: object, name: string): boolean => name in obj && typeof Reflect.get(obj, name) === "function";

/**
 * Whether `obj` is a single-child container exposing `getChild`/`setChild`,
 * including non-widget containers a list factory produces.
 *
 * @param obj - The candidate container.
 */
export const isSingleChildContainer = (obj: unknown): obj is SingleChildContainer =>
    typeof obj === "object" && obj !== null && hasFunction(obj, "getChild") && hasFunction(obj, "setChild");

export const isAppendable = (obj: unknown): obj is AppendableWidget => hasMethod(obj, "append");

export const isAddable = (obj: unknown): obj is AddableWidget => hasMethod(obj, "add");

export const isContentWidget = (obj: unknown): obj is ContentWidget => hasMethod(obj, "setContent");

export const isSingleChild = (obj: unknown): obj is SingleChildWidget => hasMethod(obj, "setChild");

export const isRemovable = (obj: unknown): obj is RemovableWidget => hasMethod(obj, "remove");

export const isReorderable = (obj: unknown): obj is ReorderableWidget =>
    hasMethod(obj, "reorderChildAfter") && hasMethod(obj, "insertChildAfter");

export const isInsertable = (obj: unknown): obj is InsertableWidget =>
    hasMethod(obj, "insert") && hasMethod(obj, "getFirstChild");

export const isEditable = (obj: unknown): obj is EditableWidget =>
    hasMethod(obj, "getPosition") && hasMethod(obj, "setPosition") && hasMethod(obj, "getText");

export const isBuffered = (obj: unknown): obj is BufferedWidget =>
    hasMethod(obj, "getBuffer") && hasMethod(obj, "setBuffer");
