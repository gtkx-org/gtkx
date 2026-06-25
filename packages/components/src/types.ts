import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";

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

export type ListViewSharedProps = {
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

export type ListViewControlledSelectionProps = {
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
};

export type UncontrolledItemType<T> = [T] extends [GObject.Object] ? T : GObject.Object;

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
