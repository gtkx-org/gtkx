import type * as Gtk from "@gtkx/ffi/gtk";
import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import type { RenderItemFn } from "./nodes/internal/list-item-renderer.js";

/**
 * Props for slot components that accept children.
 * Used by container widgets that render child elements in designated slots.
 */
export type SlotProps = {
    /** Slot id for generic Slot components. */
    id?: string;
    children?: ReactNode;
};

/**
 * Props passed to list item components (ListView, GridView, ColumnView).
 * @typeParam T - The type of the data item
 */
export type ListItemProps<T = unknown> = {
    /** Unique identifier for this item. Used for selection. */
    id: string;
    /** The data item to render. */
    value: T;
};

/**
 * Props for string list items (DropDown, ComboRow).
 * Similar to HTML select option elements.
 */
export type StringListItemProps = {
    /** Unique identifier for this item. Used for selection. */
    id: string;
    /** Display text shown in the dropdown. */
    value: string;
};

export type GridChildProps = SlotProps & {
    column?: number;
    row?: number;
    columnSpan?: number;
    rowSpan?: number;
};

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
    title: string;
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
     */
    renderCell: (item: T | null) => ReactElement;
};

/**
 * Props for the ColumnView root component.
 * Sorting is handled by the parent component - sort your items before rendering
 * and pass them as ListItem children in the desired order.
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
    /** Badge number shown on the page tab (Adw.ViewStack only). */
    badgeNumber?: number;
};

/**
 * Props for Menu.Item components.
 * Represents a single menu item with an action.
 */
export type MenuItemProps = {
    /** Unique identifier for the menu item. */
    id: string;
    /** The visible label for the menu item. */
    label: string;
    /** Callback invoked when the menu item is activated. */
    onActivate: () => void;
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

/**
 * Props for Overlay.Overlay components.
 * Controls how an overlay widget is measured and clipped.
 */
export type OverlayChildProps = SlotProps & {
    /** Whether this overlay should be included in measuring the overlay widget's size. */
    measure?: boolean;
    /** Whether this overlay should be clipped to fit within the parent. */
    clipOverlay?: boolean;
};

// ============================================================================
// Child node exports (standalone, not scoped to parent widgets)
// ============================================================================

// Re-export WidgetSlotNames from generated file for external use
export type { WidgetSlotNames } from "./generated/jsx.js";

/**
 * Type-safe slot component for widget-accepting properties.
 *
 * @example
 * ```tsx
 * <GtkWindow>
 *     <Slot for={GtkWindow} id="titlebar">
 *         <GtkHeaderBar />
 *     </Slot>
 * </GtkWindow>
 * ```
 *
 * The `for` prop provides autocomplete for valid slot ids.
 * @typeParam W - The widget type (inferred from `for` prop)
 */
export function Slot<W extends keyof import("./generated/jsx.js").WidgetSlotNames>(props: {
    /** The parent widget type - used for type inference of valid slot ids */
    for: W;
    /** The slot id - autocompleted based on the widget type */
    id: import("./generated/jsx.js").WidgetSlotNames[W];
    children?: ReactNode;
}): ReactElement {
    return createElement("Slot", { id: props.id }, props.children);
}

/** Stack page wrapper. Usage: <StackPage name="page1" title="Page 1">...</StackPage> */
export const StackPage = "StackPage" as const;

/** Grid child wrapper with positioning. Usage: <GridChild row={0} column={1}>...</GridChild> */
export const GridChild = "GridChild" as const;

/** Notebook page wrapper. Usage: <NotebookPage label="Tab 1">...</NotebookPage> */
export const NotebookPage = "NotebookPage" as const;

/** List item for ListView/GridView. Usage: <ListItem id="1" value={data} /> */
export const ListItem = "ListItem" as const;

/**
 * Type-safe column component for ColumnView.
 *
 * @example
 * ```tsx
 * <GtkColumnView>
 *     <ColumnViewColumn<Employee>
 *         title="Name"
 *         renderCell={(emp) => <GtkLabel label={emp?.name ?? ""} />}
 *     />
 * </GtkColumnView>
 * ```
 * @typeParam T - The type of the data items (inferred from renderCell parameter)
 */
export function ColumnViewColumn<T = unknown>(props: ColumnViewColumnProps<T>): ReactElement {
    return createElement("ColumnViewColumn", props);
}

/**
 * Props for the typed ListView wrapper.
 * @typeParam T - The type of the data items in the list
 */
export type ListViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkListViewProps, "renderItem"> & {
    /** Render function for list items. */
    renderItem: (item: T | null) => ReactElement;
};

/**
 * Type-safe ListView component with typed renderItem.
 *
 * @example
 * ```tsx
 * <ListView<Contact>
 *     renderItem={(contact) => <GtkLabel label={contact?.name ?? ""} />}
 * >
 *     {contacts.map(c => <ListItem key={c.id} id={c.id} value={c} />)}
 * </ListView>
 * ```
 * @typeParam T - The type of the data items (inferred from renderItem parameter)
 */
export function ListView<T = unknown>(props: ListViewProps<T>): ReactElement {
    return createElement("GtkListView", props);
}

/**
 * Props for the typed GridView wrapper.
 * @typeParam T - The type of the data items in the grid
 */
export type GridViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkGridViewProps, "renderItem"> & {
    /** Render function for grid items. */
    renderItem: (item: T | null) => ReactElement;
};

/**
 * Type-safe GridView component with typed renderItem.
 *
 * @example
 * ```tsx
 * <GridView<Photo>
 *     minColumns={2}
 *     maxColumns={4}
 *     renderItem={(photo) => <GtkImage file={photo?.path ?? ""} />}
 * >
 *     {photos.map(p => <ListItem key={p.id} id={p.id} value={p} />)}
 * </GridView>
 * ```
 * @typeParam T - The type of the data items (inferred from renderItem parameter)
 */
export function GridView<T = unknown>(props: GridViewProps<T>): ReactElement {
    return createElement("GtkGridView", props);
}

/** Simple list item for DropDown. Usage: <SimpleListItem id="opt1" value="Option 1" /> */
export const SimpleListItem = "SimpleListItem" as const;

/** Pack children for HeaderBar sides. */
export const Pack = {
    Start: "Pack.Start" as const,
    End: "Pack.End" as const,
};

/** Toolbar slots for AdwToolbarView (top/bottom bars). Content is just a regular child. */
export const Toolbar = {
    Top: "Toolbar.Top" as const,
    Bottom: "Toolbar.Bottom" as const,
};

/** Overlay widget for GtkOverlay. The main child is just a regular child. */
export const Overlay = "Overlay" as const;

/** Menu components for PopoverMenu and application menus. */
export const Menu = {
    Item: "Menu.Item" as const,
    Section: "Menu.Section" as const,
    Submenu: "Menu.Submenu" as const,
};

// ============================================================================
// JSX IntrinsicElements for child nodes
// ============================================================================

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                // Stack
                StackPage: StackPageProps;

                // Grid
                GridChild: GridChildProps;

                // Notebook
                NotebookPage: NotebookPageProps;

                // List widgets
                ListItem: ListItemProps;
                // biome-ignore lint/suspicious/noExplicitAny: internal element, use ColumnViewColumn function for type safety
                ColumnViewColumn: ColumnViewColumnProps<any>;
                SimpleListItem: StringListItemProps;

                // Pack (HeaderBar)
                "Pack.Start": SlotProps;
                "Pack.End": SlotProps;

                // Toolbar (AdwToolbarView) - content is just a regular child
                "Toolbar.Top": SlotProps;
                "Toolbar.Bottom": SlotProps;

                // Overlay (GtkOverlay) - main child is just a regular child
                Overlay: OverlayChildProps;

                // Menu
                "Menu.Item": MenuItemProps;
                "Menu.Section": MenuSectionProps;
                "Menu.Submenu": MenuSubmenuProps;
            }
        }
    }
}

export * from "./generated/jsx.js";
