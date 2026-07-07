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

export type RenderItemProps<T> = {
    item: T;
    index: number;
    depth?: number | undefined;
    isExpanded?: boolean | undefined;
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

export type ControlledExpansionProps = {
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

export type MenuEntry = {
    label?: string | undefined;
    action?: string | undefined;
    submenu?: MenuEntry[] | undefined;
    section?: MenuEntry[] | undefined;
};
