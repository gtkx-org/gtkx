/**
 * Leaf-level registries bridging the reconciler's host-config layer to the
 * column controllers, without a React context (the element map and prop
 * descriptors run in the host config, outside React render).
 *
 * One registry maps a live `Gtk.ColumnView` to the `ListController` driving it,
 * written when the column view's widget settles and read by the column element
 * map entry to register each column's controller. The other maps a constructed
 * `Gtk.ColumnViewColumn` to the `ColumnController` built alongside it during
 * element construction, read by the element map entry and the prop descriptor.
 *
 * Both are keyed by GObjects, so entries are collected when the GObjects are.
 */
import type * as Gtk from "@gtkx/gi/gtk";
import type { ColumnController } from "./column-controller.js";
import type { ListController } from "./list-controller.js";

const COLUMN_VIEW_CONTROLLERS = new WeakMap<Gtk.ColumnView, ListController>();
const COLUMN_CONTROLLERS = new WeakMap<Gtk.ColumnViewColumn, ColumnController>();

/**
 * Records the list controller driving `columnView` so column elements can reach
 * it as they attach.
 *
 * @param columnView - The settled column view widget.
 * @param controller - The list controller driving it.
 */
export const setColumnViewController = (columnView: Gtk.ColumnView, controller: ListController): void => {
    COLUMN_VIEW_CONTROLLERS.set(columnView, controller);
};

/**
 * Drops the list-controller record for `columnView`, called when the column
 * view's controller disposes.
 *
 * @param columnView - The column view whose record to remove.
 */
export const deleteColumnViewController = (columnView: Gtk.ColumnView): void => {
    COLUMN_VIEW_CONTROLLERS.delete(columnView);
};

/**
 * The list controller driving `columnView`, or `undefined` before its widget
 * settles or after its controller disposes.
 *
 * @param columnView - The column view to look up.
 */
export const getColumnViewController = (columnView: Gtk.ColumnView): ListController | undefined =>
    COLUMN_VIEW_CONTROLLERS.get(columnView);

/**
 * Records the controller built alongside `column` during element construction,
 * so the element map entry and prop descriptor can reach it.
 *
 * @param column - The constructed backing column.
 * @param controller - The controller built for it.
 */
export const setColumnController = (column: Gtk.ColumnViewColumn, controller: ColumnController): void => {
    COLUMN_CONTROLLERS.set(column, controller);
};

/**
 * The controller built for `column`, or `undefined` if none was recorded.
 *
 * @param column - The backing column to look up.
 */
export const getColumnController = (column: Gtk.ColumnViewColumn): ColumnController | undefined =>
    COLUMN_CONTROLLERS.get(column);
