import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";

export type ItemNode<T = unknown> = {
    id: string;
    value: T;
    children?: ItemNode<T>[] | undefined;
    hideExpander?: boolean | undefined;
    indentForDepth?: boolean | undefined;
    indentForIcon?: boolean | undefined;
};

export type SectionNode<S = unknown, T = unknown> = {
    id: string;
    value: S;
    data: ItemNode<T>[];
};

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

export type MenuEntry = {
    label?: string | undefined;
    action?: string | undefined;
    submenu?: MenuEntry[] | undefined;
    section?: MenuEntry[] | undefined;
};
