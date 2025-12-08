import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "./node.js";

/**
 * Interface for containers that manage child widgets with attach/detach semantics.
 * Used by ActionBar, FlowBox, ListBox, Overlay.
 */
export interface ChildContainer {
    attachChild(child: Gtk.Widget): void;
    insertChildBefore(child: Gtk.Widget, before: Gtk.Widget): void;
    detachChild(child: Gtk.Widget): void;
}

/**
 * Interface for page-based containers like Notebook.
 */
export interface PageContainer {
    addPage(child: Gtk.Widget, label: string): void;
    insertPageBefore(child: Gtk.Widget, label: string, beforeChild: Gtk.Widget): void;
    removePage(child: Gtk.Widget): void;
    updatePageLabel(child: Gtk.Widget, label: string): void;
}

/**
 * Interface for grid-based containers.
 */
export interface GridContainer {
    attachToGrid(child: Gtk.Widget, column: number, row: number, colSpan: number, rowSpan: number): void;
    removeFromGrid(child: Gtk.Widget): void;
}

/**
 * Interface for item-based containers like ListView, ColumnView, DropDown.
 */
export interface ItemContainer<T> {
    addItem(item: T): void;
    insertItemBefore(item: T, beforeItem: T): void;
    removeItem(item: T): void;
}

/**
 * Interface for column-based containers like ColumnView.
 * Note: Column type is generic to support both raw Gtk.ColumnViewColumn and wrapper nodes.
 */
export interface ColumnContainer {
    addColumn(column: unknown): void;
    insertColumnBefore(column: unknown, beforeColumn: unknown): void;
    removeColumn(column: unknown): void;
    getItems(): unknown[];
    getSortFn(): ((a: unknown, b: unknown, columnId: string) => number) | null;
}

export const isChildContainer = (node: Node): node is Node & ChildContainer =>
    "attachChild" in node && "detachChild" in node && "insertChildBefore" in node;

export const isPageContainer = (node: Node): node is Node & PageContainer =>
    "addPage" in node && "removePage" in node && "insertPageBefore" in node && "updatePageLabel" in node;

export const isGridContainer = (node: Node): node is Node & GridContainer =>
    "attachToGrid" in node && "removeFromGrid" in node;

export const isItemContainer = <T>(node: Node): node is Node & ItemContainer<T> =>
    "addItem" in node && "insertItemBefore" in node && "removeItem" in node;

export const isColumnContainer = (node: Node): node is Node & ColumnContainer =>
    "addColumn" in node && "removeColumn" in node && "getSortFn" in node;
