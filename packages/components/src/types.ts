import type * as Gtk from "@gtkx/gi/gtk";
import type {
    GtkColumnViewColumnProps,
    GtkColumnViewProps,
    GtkDropDownProps,
    GtkGridViewProps,
    GtkListViewProps,
} from "@gtkx/jsx/gtk";
import type { ReactNode } from "react";

/**
 * A single item in a collection model, identified by a stable id and holding an
 * arbitrary value. Nested items form a tree.
 */
type ListItem<T = unknown> = {
    /** Stable identifier used to track the item across updates and selection. */
    id: string;
    value: T;
    children?: ListItem<T>[] | undefined;
    /** Hides the tree expander arrow even when the item has children. */
    hideExpander?: boolean | undefined;
    /** Adds indentation matching the item's depth in the tree. */
    indentForDepth?: boolean | undefined;
    /** Reserves indentation space for an expander icon. */
    indentForIcon?: boolean | undefined;
};

/** A group of items rendered under a shared section header. */
type ListSection<S = unknown, T = unknown> = {
    /** Stable identifier used to track the section across updates. */
    id: string;
    value: S;
    /** Items belonging to this section. */
    data: ListItem<T>[];
};

/** Arguments passed to a {@link ListItemRenderer} when rendering one cell. */
type ListItemRenderArgs<T> = {
    item: T;
    index: number;
    /** Depth of the item within a tree, starting at zero for top-level items. */
    depth?: number | undefined;
    /** Whether the item is currently expanded in a tree view. */
    isExpanded?: boolean | undefined;
};

/** Arguments passed to a {@link ListSectionRenderer} when rendering one section header. */
type ListSectionRenderArgs<S> = {
    section: S;
};

/** Renders the contents of one cell of a collection view. */
type ListItemRenderer<T> = (args: ListItemRenderArgs<T>) => ReactNode;
/** Renders the contents of one section header of a collection view. */
type ListSectionRenderer<S> = (args: ListSectionRenderArgs<S>) => ReactNode;

type ItemSizeProps = {
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

type SelectionProps = {
    selectedIds?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
};

type ExpansionProps = {
    expandedIds?: string[] | null | undefined;
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
};

type SourceProps<T, S> = {
    items?: ListItem<T>[] | undefined;
    sections?: ListSection<S, T>[] | undefined;
};

/** One column of a {@link ColumnView}, pairing Gtk.ColumnViewColumn props with a cell renderer. */
type ColumnViewColumn<T = unknown> = Omit<GtkColumnViewColumnProps, "factory" | "sorter" | "id" | "title"> & {
    /** Stable identifier, also used to address the column through sorting props. */
    id: string;
    title: string;
    renderCell: ListItemRenderer<T>;
    /** Whether clicking the column header sorts by it. */
    sortable?: boolean | undefined;
    headerMenu?: ReactNode;
};

type ColumnViewOwnProps<T, S> = SelectionProps &
    ExpansionProps &
    SourceProps<T, S> &
    Omit<ItemSizeProps, "estimatedItemWidth"> & {
        columns: ColumnViewColumn<T>[];
        renderHeader?: ListSectionRenderer<S> | null | undefined;
        /** Id of the column the view is sorted by, making sorting controlled. */
        sortColumn?: string | null | undefined;
        sortOrder?: Gtk.SortType | null | undefined;
        onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
    };

/**
 * Props for {@link ColumnView}. Combines the underlying Gtk.ColumnView props with
 * declarative collection props: flat items or grouped sections, controlled selection
 * and expansion, sorting (sortColumn, sortOrder, onSortChanged), an optional section
 * header renderer, and the columns to render.
 */
type ColumnViewProps<T = unknown, S = unknown> = Omit<
    GtkColumnViewProps,
    "columns" | "model" | "headerFactory" | keyof ColumnViewOwnProps<T, S>
> &
ColumnViewOwnProps<T, S>;

type DropDownOwnProps<T, S> = SourceProps<T, S> & {
    /** Id of the currently selected item, making the selection controlled. */
    selectedId?: string | null | undefined;
    onSelectionChanged?: ((id: string) => void) | null | undefined;
    renderItem?: ListItemRenderer<T> | null | undefined;
    /** Renderer for items in the open popup list, falling back to renderItem when omitted. */
    renderListItem?: ListItemRenderer<T> | null | undefined;
    /** Renderer for section headers in the popup list. */
    renderHeader?: ListSectionRenderer<S> | null | undefined;
};

type DropDownWidgetProps<Widget, T, S> = Omit<
    Widget,
    "model" | "factory" | "listFactory" | "headerFactory" | keyof DropDownOwnProps<T, S>
> &
DropDownOwnProps<T, S>;

/**
 * Props for {@link DropDown}. Combines the underlying Gtk.DropDown props with the declarative
 * collection props: flat items or grouped sections, controlled single selection, and renderers
 * for the collapsed display, popup rows, and popup section headers.
 */
type DropDownProps<T = unknown, S = unknown> = DropDownWidgetProps<GtkDropDownProps, T, S>;

type GridViewOwnProps<T> = ItemSizeProps &
    SelectionProps & {
        items?: ListItem<T>[] | undefined;
        renderItem: ListItemRenderer<T>;
    };

/**
 * Props for {@link GridView}. Combines the underlying Gtk.GridView props with
 * declarative collection props: items, a per-cell renderItem, controlled selection,
 * and estimated item sizing.
 */
type GridViewProps<T = unknown> = Omit<GtkGridViewProps, "model" | "factory" | keyof GridViewOwnProps<T>> &
    GridViewOwnProps<T>;

type ListViewOwnProps<T, S> = ItemSizeProps &
    SelectionProps &
    ExpansionProps &
    SourceProps<T, S> & {
        renderItem: ListItemRenderer<T>;
        renderHeader?: ListSectionRenderer<S> | null | undefined;
    };

/**
 * Props for {@link ListView}. Combines the underlying Gtk.ListView props with
 * declarative collection props: flat items or grouped sections, a per-row renderItem,
 * an optional section header renderer, controlled selection and expansion, and
 * estimated item sizing.
 */
type ListViewProps<T = unknown, S = unknown> = Omit<
    GtkListViewProps,
    "model" | "factory" | "headerFactory" | keyof ListViewOwnProps<T, S>
> &
ListViewOwnProps<T, S>;

export {
    type SelectionProps,
    type ExpansionProps,
    type DropDownOwnProps,
    type DropDownWidgetProps,
    type ListItem,
    type ListSection,
    type ListItemRenderArgs,
    type ListSectionRenderArgs,
    type ListItemRenderer,
    type ListSectionRenderer,
    type ColumnViewColumn,
    type ColumnViewProps,
    type DropDownProps,
    type GridViewProps,
    type ListViewProps,
};
