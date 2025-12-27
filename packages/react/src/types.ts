import type * as Gtk from "@gtkx/ffi/gtk";

export type Container = Gtk.Widget | Gtk.Application;

export type Props = Record<string, unknown>;

export type ContainerClass = typeof Gtk.Widget | typeof Gtk.Application;
