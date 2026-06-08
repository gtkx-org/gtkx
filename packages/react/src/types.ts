import type * as Gtk from "@gtkx/gi/gtk";

/** Union of GLib instance kinds the reconciler tracks as nodes. */
export type BackingInstance =
    | Gtk.Widget
    | Gtk.Application
    | Gtk.EventController
    | Gtk.LayoutManager
    | Gtk.ListItem
    | Gtk.ListHeader
    | Gtk.ConstraintGuide
    | Gtk.ColumnViewColumn;

/**
 * Opaque per-root token used as the reconciler container for a top-level
 * {@link render} call. It carries no GLib type, so the host config routes it to
 * an inert root node whose mutations are no-ops.
 */
export type RootSentinel = object;

/**
 * What `react-reconciler` hands the host config as `containerInfo`: either the
 * per-root {@link RootSentinel} created by {@link render} or a live GObject when
 * a portal targets one (e.g. a window passed to `createPortal`).
 */
export type ContainerInfo = BackingInstance | RootSentinel;

export type Props = Record<string, unknown>;

export type BackingInstanceClass =
    | typeof Gtk.Widget
    | typeof Gtk.Application
    | typeof Gtk.EventController
    | typeof Gtk.LayoutManager
    | typeof Gtk.ListItem
    | typeof Gtk.ListHeader
    | typeof Gtk.ConstraintGuide
    | typeof Gtk.ColumnViewColumn;
