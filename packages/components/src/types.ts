import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";

/**
 * A declarative item rendered by the {@link ListView}, {@link GridView},
 * {@link ColumnView}, and {@link DropDown} components.
 *
 * A non-section item carries an arbitrary value of type `T` and may declare
 * tree `children`. A section item carries a value of type `S` and groups a list
 * of child items underneath a header.
 */
export type ItemNode<T = unknown, S = unknown> =
    | {
          id: string;
          value: T;
          section?: false | undefined;
          children?: ItemNode<T, S>[] | undefined;
          hideExpander?: boolean | undefined;
          indentForDepth?: boolean | undefined;
          indentForIcon?: boolean | undefined;
      }
    | {
          id: string;
          value: S;
          section: true;
          children: ItemNode<T, S>[];
      };

type ListViewSharedProps = {
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

type ListViewControlledSelectionProps = {
    selected?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
};

type UncontrolledItemType<T> = [T] extends [GObject.Object] ? T : GObject.Object;

/**
 * Props for the {@link ListView} component, replacing the raw `GtkListView`
 * factory/model surface with a declarative `items`/`renderItem` API, optional
 * controlled selection, section headers, and tree autoexpansion. Supplying an
 * external `model` switches to the uncontrolled form.
 */
export type ListViewProps<T = unknown, S = unknown> = ListViewSharedProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ItemNode<T, S>[] | undefined;
              renderItem: (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
              autoexpand?: boolean | undefined;
              renderHeader?: ((item: S) => ReactNode) | null | undefined;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              renderItem: (item: UncontrolledItemType<T>) => ReactNode;
              items?: never;
              autoexpand?: never;
              renderHeader?: never;
              selected?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

/**
 * Props for the {@link GridView} component, replacing the raw `GtkGridView`
 * factory/model surface with a declarative `items`/`renderItem` API and
 * optional controlled selection. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export type GridViewProps<T = unknown> = ListViewSharedProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ItemNode<T>[] | undefined;
              renderItem: (item: T) => ReactNode;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              renderItem: (item: UncontrolledItemType<T>) => ReactNode;
              items?: never;
              selected?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

type ColumnViewSortProps = {
    sortColumn?: string | null | undefined;
    sortOrder?: Gtk.SortType | null | undefined;
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
    estimatedItemHeight?: number | null | undefined;
};

/**
 * Props for the {@link ColumnView} component, replacing the raw `GtkColumnView`
 * surface with a declarative `items` model, optional controlled selection,
 * controlled sorting, and section headers. Columns are declared as
 * {@link ColumnViewColumn} children. Supplying an external `model` switches to
 * the uncontrolled form.
 */
export type ColumnViewProps<T = unknown, S = unknown> = ColumnViewSortProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ItemNode<T, S>[] | undefined;
              renderHeader?: ((item: S) => ReactNode) | null | undefined;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              items?: never;
              renderHeader?: never;
              selected?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

/**
 * Props for a single {@link ColumnViewColumn} of a {@link ColumnView},
 * replacing the raw `GtkColumnViewColumn` factory/sorter surface with a
 * declarative `renderCell` callback and an optional header context menu.
 */
export type ColumnViewColumnProps<T = unknown> = {
    title: string;
    expand?: boolean | undefined;
    resizable?: boolean | undefined;
    fixedWidth?: number | undefined;
    id: string;
    sortable?: boolean | undefined;
    visible?: boolean | undefined;
    renderCell: (item: T) => ReactNode;
    headerMenu?: ReactNode;
};

/**
 * Props shared by the {@link DropDown} and {@link ComboRow} components,
 * replacing the raw factory/model surface with declarative `items`, controlled
 * `selectedId`, and per-cell renderers for the current selection, the list
 * popup, and section headers. Supplying an external `model` switches to the
 * uncontrolled form.
 */
export type DropDownProps<T = unknown, S = unknown> =
    | {
          items?: ItemNode<T, S>[] | undefined;
          selectedId?: string | null | undefined;
          onSelectionChanged?: ((id: string) => void) | null | undefined;
          renderItem?: ((item: T) => ReactNode) | null | undefined;
          renderListItem?: ((item: T) => ReactNode) | null | undefined;
          renderHeader?: ((item: S) => ReactNode) | null | undefined;
          model?: never;
      }
    | {
          model: Gio.ListModel;
          renderItem?: ((item: UncontrolledItemType<T>) => ReactNode) | null | undefined;
          renderListItem?: ((item: UncontrolledItemType<T>) => ReactNode) | null | undefined;
          items?: never;
          selectedId?: never;
          onSelectionChanged?: never;
          renderHeader?: never;
      };

/**
 * A single declarative entry in a {@link Menu} model. An entry is a plain item
 * (`label` plus `action`), a `submenu`, or a `section` of nested entries.
 */
export type MenuEntry = {
    label?: string | undefined;
    action?: string | undefined;
    submenu?: MenuEntry[] | undefined;
    section?: MenuEntry[] | undefined;
};

/**
 * The declarative menu-model surface added by the {@link Menu} component on top
 * of the raw `GMenu` element.
 */
export type MenuItemsProps = {
    items?: MenuEntry[] | null | undefined;
};

/**
 * Props for a `<ConstraintLayout.Constraint>` declaring a single relation
 * between a target attribute and a source attribute within a
 * {@link ConstraintLayout}.
 */
export type ConstraintProps = {
    target?: string;
    targetAttribute: Gtk.ConstraintAttribute;
    relation?: Gtk.ConstraintRelation;
    source?: string;
    sourceAttribute?: Gtk.ConstraintAttribute;
    multiplier?: number;
    constant?: number;
    strength?: number;
};

/**
 * Props for a `<ConstraintLayout.Guide>` declaring an invisible layout guide
 * that other constraints can reference by `id` within a {@link ConstraintLayout}.
 */
export type ConstraintGuideProps = {
    id: string;
    minWidth?: number;
    minHeight?: number;
    natWidth?: number;
    natHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    strength?: Gtk.ConstraintStrength;
};

/**
 * Props for a `<ConstraintLayout.Vfl>` declaring constraints through the GTK
 * Visual Format Language within a {@link ConstraintLayout}.
 */
export type ConstraintVflProps = {
    lines: string[];
    hspacing?: number;
    vspacing?: number;
};
