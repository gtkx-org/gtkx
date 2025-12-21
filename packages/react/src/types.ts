import type * as Gtk from "@gtkx/ffi/gtk";

/**
 * The type of a container node in the reconciler.
 */
export type Container = Gtk.Widget | Gtk.Application;

/** Props passed to nodes in the reconciler.
 */
export type Props = Record<string, unknown>;

/**
 * The type of a container class in the reconciler.
 */
export type ContainerClass = typeof Gtk.Widget | typeof Gtk.Application;
