import type * as Gtk from "@gtkx/ffi/gtk";
import type { ReactElement, ReactNode } from "react";

/**
 * Props for slot components that accept children.
 * Used by container widgets that render child elements in designated slots.
 */
export type SlotProps = {
    children?: ReactNode;
};

/**
 * Props passed to list item components (ListView, GridView, ColumnView).
 * @typeParam I - The type of the data item
 */
export type ListItemProps<I = unknown> = {
    /** Unique identifier for this item. Used for selection. */
    id: string;
    /** The data item to render. */
    item: I;
};

/**
 * Props for string list items (DropDown, ComboRow).
 * Similar to HTML select option elements.
 */
export type StringListItemProps = {
    /** Unique identifier for this item. Used for selection. */
    id: string;
    /** Display text shown in the dropdown. */
    label: string;
};

export type GridChildProps = SlotProps & {
    column?: number;
    row?: number;
    columnSpan?: number;
    rowSpan?: number;
};

/**
 * Render function for ListView/GridView items.
 * Called with null during setup (for loading state) and with the actual item during bind.
 */
export type RenderItemFn<T> = (item: T | null) => ReactElement;

/**
 * Props for ListView and GridView components.
 * @typeParam T - The type of the data items in the list
 */
export type ListViewRenderProps<T = unknown> = {
    /** Render function called for each item in the list. */
    renderItem: RenderItemFn<T>;
};

/**
 * Props for individual columns in a ColumnView.
 * @typeParam T - The type of the data items displayed in the column
 */
export type ColumnViewColumnProps<T = unknown> = {
    /** The column header title. */
    title?: string;
    /** Whether the column should expand to fill available space. */
    expand?: boolean;
    /** Whether the column can be resized by the user. */
    resizable?: boolean;
    /** Fixed width in pixels. Overrides automatic sizing. */
    fixedWidth?: number;
    /** Unique identifier for the column. Used for sorting. */
    id?: string;
    /** Whether this column header can be clicked to trigger sorting. */
    sortable?: boolean;
    /**
     * Render function for column cells.
     * Called with null during setup (for loading state) and with the actual item during bind.
     * Always annotate your callback parameter type to include null, e.g.: `(item: MyItem | null) => ...`
     */
    renderCell: (item: T | null) => ReactElement;
};

/**
 * Props for the ColumnView root component.
 * Sorting is handled by the parent component - sort your items before rendering
 * and pass them as ColumnView.Item children in the desired order.
 * @typeParam C - The union type of column IDs
 */
export type ColumnViewRootProps<C extends string = string> = {
    /** The ID of the currently sorted column, or null if unsorted. Controls the sort indicator UI. */
    sortColumn?: C | null;
    /** The current sort direction. Controls the sort indicator UI. */
    sortOrder?: Gtk.SortType;
    /** Callback fired when the user clicks a column header to change sort. */
    onSortChange?: (column: C | null, order: Gtk.SortType) => void;
};

export type NotebookPageProps = SlotProps & {
    label: string;
};

export type StackRootProps = SlotProps & {
    visibleChildName?: string;
};

export type StackPageProps = SlotProps & {
    name?: string;
    title?: string;
    iconName?: string;
    needsAttention?: boolean;
    visible?: boolean;
    useUnderline?: boolean;
};

/**
 * Props for the Menu.Root component.
 * Root container for declarative menu structures.
 */
export type MenuRootProps = {
    children?: ReactNode;
};

/**
 * Props for Menu.Item components.
 * Represents a single menu item with an action.
 */
export type MenuItemProps = {
    /** The visible label for the menu item. */
    label: string;
    /** Callback invoked when the menu item is activated. */
    onActivate?: () => void;
    /** Keyboard accelerators for this menu item (e.g., `"<Control>q"` or `["<Control>q", "<Control>w"]`). */
    accels?: string | string[];
};

/**
 * Props for Menu.Section components.
 * Groups related menu items with optional label.
 */
export type MenuSectionProps = {
    /** Optional section label displayed as a header. */
    label?: string;
    children?: ReactNode;
};

/**
 * Props for Menu.Submenu components.
 * Creates a nested submenu with its own items.
 */
export type MenuSubmenuProps = {
    /** The submenu label shown in parent menu. */
    label: string;
    children?: ReactNode;
};
