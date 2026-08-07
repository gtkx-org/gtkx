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
    /** Stable identifier used to track the item across updates and selection, naming every row that carries it. */
    id: string;
    /** Payload handed to the cell renderer as `ListItemRenderArgs.item`. */
    value: T;
    /** Child items nested under this one, which turn a plain item list into a tree. */
    children?: ListItem<T>[] | undefined;
    /** Hides the tree expander arrow even when the item has children, through `hide-expander`. */
    shouldHideExpander?: boolean | undefined;
    /** Adds indentation matching the item's depth in the tree, through `indent-for-depth`. */
    shouldIndentForDepth?: boolean | undefined;
    /** Reserves indentation space for an expander icon, through `indent-for-icon`. */
    shouldIndentForIcon?: boolean | undefined;
};

/** A group of items rendered under a shared section header. */
type ListSection<S = unknown, T = unknown> = {
    /** Stable identifier used to track the section across updates. */
    id: string;
    /** Payload handed to the section header renderer as `ListSectionRenderArgs.section`. */
    value: S;
    /** Items belonging to this section. */
    data: ListItem<T>[];
};

/** Arguments passed to a {@link ListItemRenderer} when rendering one cell. */
type ListItemRenderArgs<T> = {
    /** Value of the `ListItem` being rendered. */
    item: T;
    /** Position of the item in the flattened item list, which excludes section headers and collapsed tree rows. */
    index: number;
    /** Depth of the item within a tree, starting at zero for top-level items. */
    depth?: number | undefined;
    /** Whether the item is currently expanded in a tree view. */
    isExpanded?: boolean | undefined;
};

/**
 * Properties applied to the row that carries one item's cells. A Gtk.ColumnViewRow is not a widget, so
 * these are the only handles it offers; anything omitted falls back to the row's own default, which
 * leaves the accessibility strings unset rather than setting them to an empty string.
 */
type ListRowProps = {
    /** Name a screen reader announces for the row, through `accessible-label`. */
    accessibleLabel?: string | undefined;
    /** Longer description a screen reader announces for the row, through `accessible-description`. */
    accessibleDescription?: string | undefined;
    /** Whether activating the row emits the view's `activate` signal; rows are activatable by default. */
    isActivatable?: boolean | undefined;
    /** Whether the row takes keyboard focus; rows are focusable by default. */
    isFocusable?: boolean | undefined;
    /** Whether clicking or keying the row tries to select it; rows are selectable by default. */
    isSelectable?: boolean | undefined;
};

/** Arguments passed to a {@link ListSectionRenderer} when rendering one section header. */
type ListSectionRenderArgs<S> = {
    /** Value of the `ListSection` whose header is being rendered. */
    section: S;
};

/** Renders the contents of one cell of a collection view. */
type ListItemRenderer<T> = (args: ListItemRenderArgs<T>) => ReactNode;
/** Renders the contents of one section header of a collection view. */
type ListSectionRenderer<S> = (args: ListSectionRenderArgs<S>) => ReactNode;
/** Returns the {@link ListRowProps} to apply to the row displaying one item, re-run whenever the item renders. */
type ListRowPropsResolver<T> = (args: ListItemRenderArgs<T>) => ListRowProps;

/** Size a collection view requests for each cell before its contents render, keeping scroll estimates steady. */
type ItemSizeProps = {
    /** Height in pixels every cell asks for until its contents render; unset lets each cell size itself. */
    estimatedItemHeight?: number | undefined;
    /** Width in pixels every cell asks for until its contents render; unset lets each cell size itself. */
    estimatedItemWidth?: number | undefined;
};

/** Controlled selection shared by the multi-item collection views. */
type SelectionProps = {
    /**
     * Ids of the items to keep selected; omitting it keeps nothing selected, and `onSelectionChanged` is how a
     * user's selection is adopted into it. An id repeated in several branches of a tree names every matching row,
     * and a single-selection view takes the first of them.
     */
    selectedIds?: string[] | null | undefined;
    /** Called with one id per selected row whenever the selection changes, and once on mount. */
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    /** How much the user may select, one item at a time unless `MULTIPLE` or `NONE` is given. */
    selectionMode?: Gtk.SelectionMode | null | undefined;
};

/**
 * Wording a screen reader announces for the control that expands and collapses a row. GTK names that control
 * after the row's own content and reports whether it is expanded, but says nothing about what activating it
 * does, so these strings supply that and belong in the application's own language.
 */
type ExpanderDescriptions = {
    /** Announced while the row is collapsed, such as "Expand". */
    expand: string;
    /** Announced while the row is expanded, such as "Collapse". */
    collapse: string;
};

/** Controlled expansion for the views that turn nested `ListItem.children` into a tree. */
type ExpansionProps = {
    /**
     * Ids of the items to keep expanded; omitting it keeps every row collapsed, and `onExpandedChange` is how a
     * user's expansion is adopted into it. An id repeated in several branches names every matching row, so all of
     * them expand together.
     */
    expandedIds?: string[] | null | undefined;
    /** Called with one id per expanded row, in visible order, whenever expansion changes. */
    onExpandedChange?: ((ids: string[]) => void) | null | undefined;
    /**
     * Wording announced for the expander of every row that can expand, describing what activating it does.
     * Omitting it leaves those expanders described only by the row they carry, and rows that cannot expand or
     * that hide their expander are never described.
     */
    expanderDescriptions?: ExpanderDescriptions | null | undefined;
};

/** Controlled sorting for the views whose headers can sort the collection. */
type SortProps = {
    /** Id of the column the view is sorted by, making sorting controlled. */
    sortColumn?: string | null | undefined;
    /** Direction `sortColumn` is sorted in, defaulting to ascending. */
    sortOrder?: Gtk.SortType | null | undefined;
    /** Called when the user sorts from a header, with the primary column's id, or null, and its order. */
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
};

/** The data a collection view renders, either as a plain item list or grouped into sections. */
type SourceProps<T, S> = {
    /** Items to render, nesting through `ListItem.children` for a tree; ignored once `sections` is given. */
    items?: ListItem<T>[] | undefined;
    /** Items grouped under section headers, rendered in place of `items`. */
    sections?: ListSection<S, T>[] | undefined;
};

/** One column of a {@link ColumnView}, pairing Gtk.ColumnViewColumn props with a cell renderer. */
type ColumnViewColumn<T = unknown> = Omit<GtkColumnViewColumnProps, "factory" | "sorter" | "id" | "title"> & {
    /** Stable identifier, also used to address the column through sorting props. */
    id: string;
    /** Text shown in the column header. */
    title: string;
    /** Renders the contents of this column's cell for one item. */
    renderCell: ListItemRenderer<T>;
    /** Makes the column header clickable, reporting the choice through `onSortChanged`. */
    isSortable?: boolean | undefined;
    /** Menu element popped up as the column header's context menu, on a right-click. */
    headerMenu?: ReactNode;
};

/** The declarative collection props {@link ColumnView} adds on top of Gtk.ColumnView's own. */
type ColumnViewOwnProps<T, S> = SelectionProps &
    ExpansionProps &
    SortProps &
    SourceProps<T, S> &
    Omit<ItemSizeProps, "estimatedItemWidth"> & {
        /** Columns to render, in order; each carries its own cell renderer. */
        columns: ColumnViewColumn<T>[];
        /** Renders the header shown above each section. */
        renderHeader?: ListSectionRenderer<S> | null | undefined;
        /** Resolves the props of the row carrying one item's cells, such as its screen-reader label. */
        rowProps?: ListRowPropsResolver<T> | null | undefined;
    };

/**
 * Props for {@link ColumnView}. Combines the underlying Gtk.ColumnView props with
 * declarative collection props: flat items or grouped sections, controlled selection
 * and expansion, sorting (sortColumn, sortOrder, onSortChanged), an optional section
 * header renderer, per-row props, and the columns to render.
 */
type ColumnViewProps<T = unknown, S = unknown> = Omit<
    GtkColumnViewProps,
    "columns" | "model" | "headerFactory" | "rowFactory" | keyof ColumnViewOwnProps<T, S>
> &
ColumnViewOwnProps<T, S>;

/** The declarative collection props {@link DropDown} and `ComboRow` add on top of their widget's own. */
type DropDownOwnProps<T, S> = SourceProps<T, S> & {
    /** Id of the currently selected item, making the selection controlled. */
    selectedId?: string | null | undefined;
    /** Called with the id of the item that became selected. */
    onSelectionChanged?: ((id: string) => void) | null | undefined;
    /** Renders the collapsed display, and the popup rows too unless `renderListItem` is given. */
    renderItem?: ListItemRenderer<T> | null | undefined;
    /** Renderer for items in the open popup list, falling back to renderItem when omitted. */
    renderListItem?: ListItemRenderer<T> | null | undefined;
    /** Renderer for section headers in the popup list. */
    renderHeader?: ListSectionRenderer<S> | null | undefined;
};

/** A drop-down-shaped widget's props with its model and factories swapped for the declarative collection props. */
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

/** The declarative collection props {@link GridView} adds on top of Gtk.GridView's own. */
type GridViewOwnProps<T> = ItemSizeProps &
    SelectionProps & {
        /** Items to render as cells; a grid is always flat, so `ListItem.children` is ignored. */
        items?: ListItem<T>[] | undefined;
        /** Renders the contents of one cell. */
        renderItem: ListItemRenderer<T>;
    };

/**
 * Props for {@link GridView}. Combines the underlying Gtk.GridView props with
 * declarative collection props: items, a per-cell renderItem, controlled selection,
 * and estimated item sizing.
 */
type GridViewProps<T = unknown> = Omit<GtkGridViewProps, "model" | "factory" | keyof GridViewOwnProps<T>> &
    GridViewOwnProps<T>;

/** The declarative collection props {@link ListView} adds on top of Gtk.ListView's own. */
type ListViewOwnProps<T, S> = ItemSizeProps &
    SelectionProps &
    ExpansionProps &
    SourceProps<T, S> & {
        /** Renders the contents of one row. */
        renderItem: ListItemRenderer<T>;
        /** Renders the header shown above each section. */
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
    type ExpanderDescriptions,
    type ExpansionProps,
    type SortProps,
    type DropDownOwnProps,
    type DropDownWidgetProps,
    type ListItem,
    type ListSection,
    type ListItemRenderArgs,
    type ListRowProps,
    type ListSectionRenderArgs,
    type ListItemRenderer,
    type ListRowPropsResolver,
    type ListSectionRenderer,
    type ColumnViewColumn,
    type ColumnViewProps,
    type DropDownProps,
    type GridViewProps,
    type ListViewProps,
};
