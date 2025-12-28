import type * as Gdk from "@gtkx/ffi/gdk";
import type * as Gtk from "@gtkx/ffi/gtk";
import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import type { RenderItemFn } from "./nodes/internal/list-item-renderer.js";
import type { TreeRenderItemFn } from "./nodes/internal/tree-list-item-renderer.js";

/**
 * Props for EventController-based event handlers.
 *
 * These props attach EventControllers to widgets for handling
 * pointer motion, clicks, and keyboard events.
 */
export interface EventControllerProps {
    /** Called when the pointer enters the widget */
    onEnter?: (x: number, y: number) => void;
    /** Called when the pointer leaves the widget */
    onLeave?: () => void;
    /** Called when the pointer moves over the widget */
    onMotion?: (x: number, y: number) => void;
    /** Called when a mouse button is pressed */
    onPressed?: (nPress: number, x: number, y: number) => void;
    /** Called when a mouse button is released */
    onReleased?: (nPress: number, x: number, y: number) => void;
    /** Called when a key is pressed (for focusable widgets) */
    onKeyPressed?: (keyval: number, keycode: number, state: Gdk.ModifierType) => boolean;
    /** Called when a key is released */
    onKeyReleased?: (keyval: number, keycode: number, state: Gdk.ModifierType) => void;
    /** Called when the widget is scrolled */
    onScroll?: (dx: number, dy: number) => boolean;
}

/**
 * Props for slot-based child positioning.
 *
 * @see {@link Slot} for type-safe slot usage
 */
export type SlotProps = {
    /** The slot identifier */
    id?: string;
    /** Content to place in the slot */
    children?: ReactNode;
};

/**
 * Props for items in a {@link ListView} or {@link GridView}.
 *
 * @typeParam T - The type of data associated with this list item
 */
export type ListItemProps<T = unknown> = {
    /** Unique identifier for this item */
    id: string;
    /** The data value for this item */
    value: T;
};

/**
 * Props for items in a {@link TreeListView}.
 *
 * @typeParam T - The type of data associated with this tree item
 */
export type TreeListItemProps<T = unknown> = {
    /** Unique identifier for this item */
    id: string;
    /** The data value for this item */
    value: T;
    /** Whether to indent based on tree depth (default: true) */
    indentForDepth?: boolean;
    /** Whether to indent for expander icon width */
    indentForIcon?: boolean;
    /** Whether to hide the expand/collapse arrow */
    hideExpander?: boolean;
    /** Nested tree items (children of this item) */
    children?: ReactNode;
};

/**
 * Props for string-based list items.
 *
 * Use with `SimpleListItem` for simple string lists.
 */
export type StringListItemProps = {
    /** Unique identifier for this item */
    id: string;
    /** The string value for this item */
    value: string;
};

/**
 * Props for positioning children within a GtkGrid.
 *
 * @see {@link GridChild} for usage
 */
export type GridChildProps = SlotProps & {
    /** Column index (0-based) */
    column?: number;
    /** Row index (0-based) */
    row?: number;
    /** Number of columns to span */
    columnSpan?: number;
    /** Number of rows to span */
    rowSpan?: number;
};

/**
 * Props for positioning children within a GtkFixed.
 *
 * @see {@link FixedChild} for usage
 */
export type FixedChildProps = SlotProps & {
    /** X coordinate in pixels */
    x?: number;
    /** Y coordinate in pixels */
    y?: number;
};

/**
 * Props for declarative toast notifications.
 *
 * @see {@link Toast} for usage
 */
export type ToastProps = {
    /** The toast message text */
    title: string;
    /** Timeout in seconds (0 for indefinite) */
    timeout?: number;
    /** Priority level for interrupting other toasts */
    priority?: import("@gtkx/ffi/adw").ToastPriority;
    /** Label for the action button */
    buttonLabel?: string;
    /** Action name to trigger when button is clicked */
    actionName?: string;
    /** Whether to use Pango markup in the title */
    useMarkup?: boolean;
    /** Callback when the toast button is clicked */
    onButtonClicked?: () => void;
    /** Callback when the toast is dismissed */
    onDismissed?: () => void;
};

/**
 * Props for custom list view rendering.
 *
 * @typeParam T - The type of items in the list
 */
export type ListViewRenderProps<T = unknown> = {
    /** Function to render each list item */
    renderItem: RenderItemFn<T>;
};

/**
 * Props for defining a column in a ColumnView (table).
 *
 * @typeParam T - The type of data for each row
 *
 * @see {@link ColumnViewColumn} for usage
 */
export type ColumnViewColumnProps<T = unknown> = {
    /** Column header text */
    title: string;
    /** Whether the column expands to fill available space */
    expand?: boolean;
    /** Whether the column can be resized by the user */
    resizable?: boolean;
    /** Fixed width in pixels */
    fixedWidth?: number;
    /** Unique identifier for this column */
    id: string;
    /** Whether clicking the header sorts by this column */
    sortable?: boolean;
    /** Function to render the cell content for each row */
    renderCell: (item: T | null) => ReactNode;
};

/**
 * Props for the root ColumnView component.
 *
 * @typeParam C - String literal type for column IDs
 */
export type ColumnViewRootProps<C extends string = string> = {
    /** Currently sorted column ID, or null for no sorting */
    sortColumn?: C | null;
    /** Sort direction (ascending or descending) */
    sortOrder?: Gtk.SortType;
    /** Callback when sort changes */
    onSortChange?: (column: C | null, order: Gtk.SortType) => void;
};

/**
 * Props for notebook (tabbed) pages.
 */
export type NotebookPageProps = SlotProps & {
    /** Tab label text (optional when using Notebook.PageTab) */
    label?: string;
};

/**
 * Props for custom notebook page tab widgets.
 */
export type NotebookPageTabProps = SlotProps;

/**
 * Props for the root Stack component.
 */
export type StackRootProps = SlotProps & {
    /** Name of the currently visible child page */
    visibleChildName?: string;
};

/**
 * Props for pages within a Stack or ViewStack.
 *
 * @see {@link StackPage} for usage
 */
export type StackPageProps = SlotProps & {
    /** Unique name for this page (used with visibleChildName) */
    name?: string;
    /** Display title shown in stack switchers */
    title?: string;
    /** Icon name from the icon theme */
    iconName?: string;
    /** Whether to show an attention indicator */
    needsAttention?: boolean;
    /** Whether this page is visible in switchers */
    visible?: boolean;
    /** Whether underscores in title indicate mnemonics */
    useUnderline?: boolean;
    /** Badge number shown on the page indicator */
    badgeNumber?: number;
};

/**
 * Props for menu items.
 *
 * @see {@link Menu} for building menus
 */
export type MenuItemProps = {
    /** Unique identifier for this menu item */
    id: string;
    /** Display label */
    label: string;
    /** Callback when the item is activated */
    onActivate: () => void;
    /** Keyboard accelerator(s) (e.g., "\<Control\>q") */
    accels?: string | string[];
};

/**
 * Props for menu sections.
 *
 * Sections group related menu items with optional labels.
 */
export type MenuSectionProps = {
    /** Optional section header label */
    label?: string;
    /** Menu items in this section */
    children?: ReactNode;
};

/**
 * Props for submenus.
 */
export type MenuSubmenuProps = {
    /** Submenu label */
    label: string;
    /** Menu items in this submenu */
    children?: ReactNode;
};

/**
 * Props for children within an Overlay container.
 */
export type OverlayChildProps = SlotProps & {
    /** Whether to include this child in size measurement */
    measure?: boolean;
    /** Whether to clip this overlay child to the main child bounds */
    clipOverlay?: boolean;
};

/**
 * Type mapping widget names to their available slot IDs.
 */
export type { WidgetSlotNames } from "./generated/jsx.js";

/**
 * Type-safe slot component for placing children in named widget slots.
 *
 * GTK widgets often have named slots for specific child positions (e.g., titleWidget,
 * startWidget). This component provides type-safe access to those slots.
 *
 * @typeParam W - The widget type containing the slot
 *
 * @param props.for - The widget component type (used for type inference)
 * @param props.id - The slot identifier (type-checked against available slots)
 * @param props.children - Content to place in the slot
 *
 * @example
 * ```tsx
 * <GtkHeaderBar>
 *   <Slot for={GtkHeaderBar} id="titleWidget">
 *     <GtkLabel label="App Title" />
 *   </Slot>
 * </GtkHeaderBar>
 * ```
 *
 * @internal
 */
export function Slot<W extends keyof import("./generated/jsx.js").WidgetSlotNames>(props: {
    for: W;

    id: import("./generated/jsx.js").WidgetSlotNames[W];
    children?: ReactNode;
}): ReactElement {
    return createElement("Slot", { id: props.id }, props.children);
}

/**
 * Element type for pages within a GtkStack or AdwViewStack.
 *
 * @example
 * ```tsx
 * <GtkStack>
 *   <StackPage name="page1" title="First Page">
 *     <GtkLabel label="Content 1" />
 *   </StackPage>
 *   <StackPage name="page2" title="Second Page">
 *     <GtkLabel label="Content 2" />
 *   </StackPage>
 * </GtkStack>
 * ```
 */
export const StackPage = "StackPage" as const;

/**
 * Element type for positioning children within a GtkGrid.
 *
 * @example
 * ```tsx
 * <GtkGrid>
 *   <GridChild column={0} row={0}>
 *     <GtkLabel label="Top Left" />
 *   </GridChild>
 *   <GridChild column={1} row={0} columnSpan={2}>
 *     <GtkLabel label="Spans 2 columns" />
 *   </GridChild>
 * </GtkGrid>
 * ```
 */
export const GridChild = "GridChild" as const;

/**
 * Element type for positioning children within a GtkFixed.
 *
 * @example
 * ```tsx
 * <GtkFixed>
 *   <FixedChild x={20} y={30}>
 *     <GtkLabel label="Positioned at (20, 30)" />
 *   </FixedChild>
 *   <FixedChild x={100} y={50}>
 *     <GtkButton label="At (100, 50)" />
 *   </FixedChild>
 * </GtkFixed>
 * ```
 */
export const FixedChild = "FixedChild" as const;

/**
 * Element type for declarative toast notifications within an AdwToastOverlay.
 *
 * When mounted, shows the toast. When unmounted, the toast auto-dismisses.
 * Toasts can have an optional action button and callbacks.
 *
 * @example
 * ```tsx
 * <AdwToastOverlay>
 *   <MyContent />
 *   {showToast && (
 *     <Toast
 *       title="File saved"
 *       timeout={3}
 *       buttonLabel="Undo"
 *       onButtonClicked={handleUndo}
 *       onDismissed={() => setShowToast(false)}
 *     />
 *   )}
 * </AdwToastOverlay>
 * ```
 */
export const Toast = "Toast" as const;

/**
 * Element types for pages within a GtkNotebook (tabbed interface).
 *
 * @example Simple text tabs
 * ```tsx
 * <GtkNotebook>
 *   <Notebook.Page label="Tab 1">
 *     <GtkLabel label="Content 1" />
 *   </Notebook.Page>
 *   <Notebook.Page label="Tab 2">
 *     <GtkLabel label="Content 2" />
 *   </Notebook.Page>
 * </GtkNotebook>
 * ```
 *
 * @example Custom tab widgets
 * ```tsx
 * <GtkNotebook>
 *   <Notebook.Page>
 *     <Notebook.PageTab>
 *       <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
 *         <GtkImage iconName="folder-symbolic" />
 *         <GtkLabel label="Files" />
 *       </GtkBox>
 *     </Notebook.PageTab>
 *     <GtkLabel label="Content" />
 *   </Notebook.Page>
 * </GtkNotebook>
 * ```
 */
export const Notebook = {
    /** A page within the notebook */
    Page: "Notebook.Page" as const,
    /** Custom widget for the page tab label */
    PageTab: "Notebook.PageTab" as const,
};

/**
 * Element type for items in a ListView or GridView.
 *
 * @example
 * ```tsx
 * <ListView renderItem={(item) => <GtkLabel label={item.name} />}>
 *   <ListItem id="1" value={{ name: "Item 1" }} />
 *   <ListItem id="2" value={{ name: "Item 2" }} />
 * </ListView>
 * ```
 */
export const ListItem = "ListItem" as const;

/**
 * Component for defining columns in a ColumnView (table widget).
 *
 * @typeParam T - The type of row data
 *
 * @example
 * ```tsx
 * <GtkColumnView>
 *   <ColumnViewColumn
 *     id="name"
 *     title="Name"
 *     expand
 *     renderCell={(item) => <GtkLabel label={item?.name ?? ""} />}
 *   />
 *   <ColumnViewColumn
 *     id="status"
 *     title="Status"
 *     renderCell={(item) => <GtkLabel label={item?.status ?? ""} />}
 *   />
 * </GtkColumnView>
 * ```
 *
 * @internal
 */
export function ColumnViewColumn<T = unknown>(props: ColumnViewColumnProps<T>): ReactElement {
    return createElement("ColumnViewColumn", props);
}

/**
 * Props for the ListView component.
 *
 * @typeParam T - The type of items in the list
 */
export type ListViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkListViewProps, "renderItem"> & {
    /** Function to render each list item */
    renderItem: (item: T | null) => ReactNode;
};

/**
 * Virtualized list component with custom item rendering.
 *
 * Efficiently renders large lists by only creating widgets for visible items.
 *
 * @typeParam T - The type of items in the list
 *
 * @example
 * ```tsx
 * const items = [{ id: "1", name: "Apple" }, { id: "2", name: "Banana" }];
 *
 * <ListView renderItem={(item) => <GtkLabel label={item?.name ?? ""} />}>
 *   {items.map((item) => (
 *     <ListItem key={item.id} id={item.id} value={item} />
 *   ))}
 * </ListView>
 * ```
 *
 * @internal
 */
export function ListView<T = unknown>(props: ListViewProps<T>): ReactElement {
    return createElement("GtkListView", props);
}

/**
 * Props for the GridView component.
 *
 * @typeParam T - The type of items in the grid
 */
export type GridViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkGridViewProps, "renderItem"> & {
    /** Function to render each grid item */
    renderItem: (item: T | null) => ReactNode;
};

/**
 * Virtualized grid component with custom item rendering.
 *
 * Efficiently renders large grids by only creating widgets for visible items.
 *
 * @typeParam T - The type of items in the grid
 *
 * @example
 * ```tsx
 * <GridView renderItem={(item) => <GtkImage iconName={item?.icon ?? ""} />}>
 *   {icons.map((icon) => (
 *     <ListItem key={icon.id} id={icon.id} value={icon} />
 *   ))}
 * </GridView>
 * ```
 *
 * @internal
 */
export function GridView<T = unknown>(props: GridViewProps<T>): ReactElement {
    return createElement("GtkGridView", props);
}

/**
 * Props for the TreeListView component.
 *
 * @typeParam T - The type of items in the tree
 */
export type TreeListViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkListViewProps, "renderItem"> & {
    /** Function to render each tree item */
    renderItem: TreeRenderItemFn<T>;
    /** Whether to automatically expand new rows (default: false) */
    autoexpand?: boolean;
    /** Selection mode for the tree */
    selectionMode?: Gtk.SelectionMode;
    /** Currently selected item IDs */
    selected?: string[];
    /** Callback when selection changes */
    onSelectionChanged?: (ids: string[]) => void;
};

/**
 * Tree list component with hierarchical data and expand/collapse support.
 *
 * Renders a tree structure with expandable/collapsible rows using GTK's TreeListModel.
 * Items are defined declaratively by nesting TreeListItem components.
 *
 * @typeParam T - The type of items in the tree
 *
 * @example
 * ```tsx
 * interface Category { name: string; }
 * interface Setting { key: string; value: string; }
 *
 * <TreeListView<Category | Setting>
 *   renderItem={(item, row) => (
 *     <GtkLabel label={'name' in item ? item.name : item.key} />
 *   )}
 * >
 *   {categories.map(cat => (
 *     <TreeListItem key={cat.name} id={cat.name} value={cat}>
 *       {cat.settings?.map(setting => (
 *         <TreeListItem key={setting.key} id={setting.key} value={setting} />
 *       ))}
 *     </TreeListItem>
 *   ))}
 * </TreeListView>
 * ```
 *
 * @internal
 */
export function TreeListView<T = unknown>(props: TreeListViewProps<T>): ReactElement {
    return createElement("TreeListView", props);
}

/**
 * Element type for items in a TreeListView.
 *
 * Nesting TreeListItem components defines the tree hierarchy.
 *
 * @example
 * ```tsx
 * <TreeListView renderItem={(item) => <GtkLabel label={item.name} />}>
 *   <TreeListItem id="parent" value={{ name: "Parent" }}>
 *     <TreeListItem id="child1" value={{ name: "Child 1" }} />
 *     <TreeListItem id="child2" value={{ name: "Child 2" }} />
 *   </TreeListItem>
 * </TreeListView>
 * ```
 */
export const TreeListItem = "TreeListItem" as const;

/**
 * Element type for simple string-based list items.
 *
 * Use when list items only need string values without complex data.
 *
 * @example
 * ```tsx
 * <GtkDropDown>
 *   <SimpleListItem id="opt1" value="Option 1" />
 *   <SimpleListItem id="opt2" value="Option 2" />
 * </GtkDropDown>
 * ```
 */
export const SimpleListItem = "SimpleListItem" as const;

/**
 * Slot positions for AdwActionRow, AdwEntryRow, and AdwExpanderRow widgets.
 *
 * @example
 * ```tsx
 * <AdwActionRow title="Setting">
 *   <ActionRow.Prefix>
 *     <GtkCheckButton />
 *   </ActionRow.Prefix>
 *   <ActionRow.Suffix>
 *     <GtkButton iconName="go-next-symbolic" />
 *   </ActionRow.Suffix>
 * </AdwActionRow>
 * ```
 */
export const ActionRow = {
    /** Place child as a prefix (left side) of the row */
    Prefix: "ActionRow.Prefix" as const,
    /** Place child as a suffix (right side) of the row */
    Suffix: "ActionRow.Suffix" as const,
};

/**
 * Slot positions for HeaderBar and ActionBar widgets.
 *
 * @example
 * ```tsx
 * <GtkHeaderBar>
 *   <Pack.Start>
 *     <GtkButton label="Back" />
 *   </Pack.Start>
 *   <Pack.End>
 *     <GtkMenuButton />
 *   </Pack.End>
 * </GtkHeaderBar>
 * ```
 */
export const Pack = {
    /** Place child at the start (left in LTR) of the bar */
    Start: "Pack.Start" as const,
    /** Place child at the end (right in LTR) of the bar */
    End: "Pack.End" as const,
};

/**
 * Slot positions for AdwToolbarView.
 *
 * @example
 * ```tsx
 * <AdwToolbarView>
 *   <Toolbar.Top>
 *     <AdwHeaderBar />
 *   </Toolbar.Top>
 *   <GtkLabel label="Content" />
 *   <Toolbar.Bottom>
 *     <GtkActionBar />
 *   </Toolbar.Bottom>
 * </AdwToolbarView>
 * ```
 */
export const Toolbar = {
    /** Place toolbar at the top */
    Top: "Toolbar.Top" as const,
    /** Place toolbar at the bottom */
    Bottom: "Toolbar.Bottom" as const,
};

/**
 * Element type for GtkOverlay main child container.
 */
export const Overlay = "Overlay" as const;

/**
 * Element type for overlay children positioned above the main content.
 *
 * @example
 * ```tsx
 * <GtkOverlay>
 *   <Overlay>
 *     <GtkImage file="background.png" />
 *   </Overlay>
 *   <OverlayChild>
 *     <GtkLabel label="Overlaid text" cssClasses={["title-1"]} />
 *   </OverlayChild>
 * </GtkOverlay>
 * ```
 */
export const OverlayChild = "OverlayChild" as const;

/**
 * Element types for declarative menu construction.
 *
 * Build menus with items, sections, and submenus declaratively.
 *
 * @example
 * ```tsx
 * <GtkMenuButton>
 *   <Menu.Section>
 *     <Menu.Item id="open" label="Open" onActivate={handleOpen} accels="<Control>o" />
 *     <Menu.Item id="save" label="Save" onActivate={handleSave} accels="<Control>s" />
 *   </Menu.Section>
 *   <Menu.Submenu label="Export">
 *     <Menu.Item id="pdf" label="As PDF" onActivate={exportPdf} />
 *     <Menu.Item id="png" label="As PNG" onActivate={exportPng} />
 *   </Menu.Submenu>
 * </GtkMenuButton>
 * ```
 */
export const Menu = {
    /** A clickable menu item with action */
    Item: "Menu.Item" as const,
    /** A section grouping related menu items */
    Section: "Menu.Section" as const,
    /** A submenu containing nested items */
    Submenu: "Menu.Submenu" as const,
};

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                StackPage: StackPageProps;

                GridChild: GridChildProps;

                FixedChild: FixedChildProps;

                Toast: ToastProps;

                "Notebook.Page": NotebookPageProps;
                "Notebook.PageTab": NotebookPageTabProps;

                ListItem: ListItemProps;
                // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
                TreeListItem: TreeListItemProps<any>;

                // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
                ColumnViewColumn: ColumnViewColumnProps<any>;
                SimpleListItem: StringListItemProps;

                "ActionRow.Prefix": SlotProps;
                "ActionRow.Suffix": SlotProps;

                "Pack.Start": SlotProps;
                "Pack.End": SlotProps;

                "Toolbar.Top": SlotProps;
                "Toolbar.Bottom": SlotProps;

                OverlayChild: OverlayChildProps;

                "Menu.Item": MenuItemProps;
                "Menu.Section": MenuSectionProps;
                "Menu.Submenu": MenuSubmenuProps;
            }
        }
    }
}

export * from "./generated/jsx.js";

declare module "./generated/jsx.js" {
    interface WidgetProps extends EventControllerProps {
        /**
         * Called when any property on this widget changes.
         * @param propName - The name of the property that changed
         */
        onNotify?: (propName: string) => void;
    }
}
