import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";

/**
 * A declarative item rendered by the {@link ListView}, {@link GridView},
 * {@link ColumnView}, and {@link DropDown} components.
 *
 * An item carries an arbitrary value of type `T` and may declare tree
 * `children`. The expander indentation flags tune how a tree row is laid out.
 */
export type ItemNode<T = unknown> = {
    id: string;
    value: T;
    children?: ItemNode<T>[] | undefined;
    hideExpander?: boolean | undefined;
    indentForDepth?: boolean | undefined;
    indentForIcon?: boolean | undefined;
};

/**
 * A declarative section grouping a list of {@link ItemNode} rows under a header.
 *
 * The header carries a value of type `S` and `data` names the rows that appear
 * underneath it, mirroring React Native's `SectionList` section shape.
 */
export type SectionNode<S = unknown, T = unknown> = {
    id: string;
    value: S;
    data: ItemNode<T>[];
};

/**
 * Information passed to a collection's `renderItem` callback for a single cell:
 * its resolved `item` value and bound list `index`.
 */
export type RenderItemInfo<T> = {
    item: T;
    index: number;
};

export type CollectionItemSizeProps = {
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

export type ControlledSelectionProps = {
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
