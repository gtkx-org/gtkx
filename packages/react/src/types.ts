import type * as Gtk from "@gtkx/gi/gtk";

/** Union of GLib instance kinds the reconciler tracks as nodes. */
export type BackingInstance =
    | Gtk.Widget
    | Gtk.Application
    | Gtk.EventController
    | Gtk.LayoutManager
    | Gtk.ListItem
    | Gtk.ListHeader;

export type Props = Record<string, unknown>;

export type BackingInstanceClass =
    | typeof Gtk.Widget
    | typeof Gtk.Application
    | typeof Gtk.EventController
    | typeof Gtk.LayoutManager
    | typeof Gtk.ListItem
    | typeof Gtk.ListHeader;
