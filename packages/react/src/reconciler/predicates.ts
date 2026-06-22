import type { AttachShape } from "@gtkx/config";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { collectAttachShapes } from "../utils/gtype.js";

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

export type SingleChildContainer = {
    getChild: () => Gtk.Widget | null;
    setChild: (child: Gtk.Widget | null) => void;
};

const widgetShapes = (obj: unknown): Set<AttachShape> | null =>
    obj instanceof Gtk.Widget ? collectAttachShapes(obj.__gtype__) : null;

export const isAppendable = (obj: unknown): obj is AppendableWidget => widgetShapes(obj)?.has("append") ?? false;

export const isAddable = (obj: unknown): obj is AddableWidget => widgetShapes(obj)?.has("add") ?? false;

export const isContentWidget = (obj: unknown): obj is ContentWidget => widgetShapes(obj)?.has("setContent") ?? false;

export const isSingleChild = (obj: unknown): obj is SingleChildWidget => widgetShapes(obj)?.has("setChild") ?? false;

export const isRemovable = (obj: unknown): obj is RemovableWidget => widgetShapes(obj)?.has("remove") ?? false;

export const isReorderable = (obj: unknown): obj is ReorderableWidget => {
    const shapes = widgetShapes(obj);
    if (shapes === null) return false;
    return shapes.has("reorderChildAfter") && shapes.has("insertChildAfter");
};

export const isInsertable = (obj: unknown): obj is InsertableWidget => {
    const shapes = widgetShapes(obj);
    if (shapes === null) return false;
    return shapes.has("insert") && shapes.has("getFirstChild");
};

export const isSingleChildContainer = (obj: unknown): obj is SingleChildContainer => {
    if (!(obj instanceof GObject.Object)) return false;
    const shapes = collectAttachShapes(obj.__gtype__);
    return shapes.has("getChild") && shapes.has("setChild");
};
