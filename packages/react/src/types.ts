import type * as Gtk from "@gtkx/ffi/gtk";

/** Union of GLib instance kinds the reconciler tracks as nodes. */
export type Container = Gtk.Widget | Gtk.Application | Gtk.EventController | Gtk.ListItem | Gtk.ListHeader;

export type Props = Record<string, unknown>;

export type ContainerClass =
    | typeof Gtk.Widget
    | typeof Gtk.Application
    | typeof Gtk.EventController
    | typeof Gtk.ListItem
    | typeof Gtk.ListHeader;
