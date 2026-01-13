import type * as Gtk from "@gtkx/ffi/gtk";
import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import type { RenderItemFn } from "./nodes/internal/list-item-renderer.js";
import type { TreeRenderItemFn } from "./nodes/internal/tree-list-item-renderer.js";

export type { DragSourceProps, DropTargetProps, EventControllerProps } from "./types.js";

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
 * Props for virtual child containers that don't expose slot id.
 */
export type VirtualSlotProps = {
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
export type GridChildProps = VirtualSlotProps & {
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
export type FixedChildProps = VirtualSlotProps & {
    /** X coordinate in pixels */
    x?: number;
    /** Y coordinate in pixels */
    y?: number;
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
    /** Estimated row height in pixels for proper virtualization before content loads */
    estimatedRowHeight?: number;
};

/**
 * Props for notebook (tabbed) pages.
 */
export type NotebookPageProps = VirtualSlotProps & {
    /** Tab label text (optional when using Notebook.PageTab) */
    label?: string;
};

/**
 * Props for custom notebook page tab widgets.
 */
export type NotebookPageTabProps = VirtualSlotProps;

/**
 * Props for the root Stack component.
 */
export type StackRootProps = VirtualSlotProps & {
    /** ID of the currently visible page */
    page?: string;
};

/**
 * Props for pages within a Stack or ViewStack.
 *
 * @see {@link StackPage} for usage
 */
export type StackPageProps = VirtualSlotProps & {
    /** Unique identifier for this page (used with page prop) */
    id?: string;
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
    /** Keyboard accelerator(s) (e.g., `<Control>q`) */
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
export type OverlayChildProps = VirtualSlotProps & {
    /** Whether to include this child in size measurement */
    measure?: boolean;
    /** Whether to clip this overlay child to the main child bounds */
    clipOverlay?: boolean;
};

/**
 * Props for the ScaleMark virtual element.
 *
 * Used to declaratively add marks to a GtkScale slider.
 *
 * @example
 * ```tsx
 * <GtkScale>
 *     <x.ScaleMark value={0} label="Min" />
 *     <x.ScaleMark value={50} label="Mid" />
 *     <x.ScaleMark value={100} label="Max" />
 * </GtkScale>
 * ```
 */
export type ScaleMarkProps = {
    /** The value at which to place the mark */
    value: number;
    /** Position of the mark (TOP or BOTTOM for horizontal, LEFT or RIGHT for vertical) */
    position?: Gtk.PositionType;
    /** Optional label text (supports Pango markup) */
    label?: string | null;
};

/**
 * Props for the CalendarMark virtual element.
 *
 * Used to declaratively mark days on a GtkCalendar.
 *
 * @example
 * ```tsx
 * <GtkCalendar>
 *     <x.CalendarMark day={15} />
 *     <x.CalendarMark day={20} />
 *     <x.CalendarMark day={25} />
 * </GtkCalendar>
 * ```
 */
export type CalendarMarkProps = {
    /** The day of the month to mark (1-31) */
    day: number;
};

/**
 * Props for the LevelBarOffset virtual element.
 *
 * Used to declaratively add offset thresholds to a GtkLevelBar.
 * Each offset defines a named threshold that triggers visual style changes.
 *
 * @example
 * ```tsx
 * <GtkLevelBar>
 *     <x.LevelBarOffset id="low" value={0.25} />
 *     <x.LevelBarOffset id="high" value={0.75} />
 *     <x.LevelBarOffset id="full" value={1.0} />
 * </GtkLevelBar>
 * ```
 */
export type LevelBarOffsetProps = {
    /** Unique identifier for this offset (used for CSS styling) */
    id: string;
    /** The threshold value (0.0 to 1.0 for continuous mode, or integer for discrete) */
    value: number;
};

/**
 * Props for the Toggle virtual element.
 *
 * Used to declaratively add toggles to an AdwToggleGroup.
 *
 * @example
 * ```tsx
 * <AdwToggleGroup>
 *     <x.Toggle id="view-list" iconName="view-list-symbolic" />
 *     <x.Toggle id="view-grid" iconName="view-grid-symbolic" />
 *     <x.Toggle id="view-flow" label="Flow" />
 * </AdwToggleGroup>
 * ```
 */
export type ToggleProps = {
    /** Optional identifier for accessing toggle by id instead of index */
    id?: string | null;
    /** Label text to display */
    label?: string | null;
    /** Icon name to display */
    iconName?: string | null;
    /** Tooltip text (supports Pango markup) */
    tooltip?: string;
    /** Whether the toggle is enabled */
    enabled?: boolean;
    /** Whether underline in label indicates mnemonic */
    useUnderline?: boolean;
};

/**
 * Props for ExpanderRow child slots (Row and Action).
 */
export type ExpanderRowChildProps = {
    /** Children to add to this slot */
    children?: ReactNode;
};

type NavigationPageBaseProps = {
    title?: string;
    canPop?: boolean;
    children?: ReactNode;
};

/**
 * Props for the NavigationPage virtual element with type-safe targeting.
 *
 * The `for` prop is required and determines valid `id` values:
 * - `AdwNavigationView`: `id` can be any string (page tags for navigation history)
 * - `AdwNavigationSplitView`: `id` is narrowed to `"content" | "sidebar"` (slot positions)
 *
 * @example
 * ```tsx
 * // In NavigationView - id can be any string
 * <AdwNavigationView history={["home", "details"]}>
 *   <x.NavigationPage for={AdwNavigationView} id="home" title="Home">
 *     <HomeContent />
 *   </x.NavigationPage>
 * </AdwNavigationView>
 *
 * // In NavigationSplitView - id is narrowed to "content" | "sidebar"
 * <AdwNavigationSplitView>
 *   <x.NavigationPage for={AdwNavigationSplitView} id="sidebar" title="Sidebar">
 *     <SidebarContent />
 *   </x.NavigationPage>
 *   <x.NavigationPage for={AdwNavigationSplitView} id="content" title="Content">
 *     <MainContent />
 *   </x.NavigationPage>
 * </AdwNavigationSplitView>
 * ```
 */
export type NavigationPageProps =
    | (NavigationPageBaseProps & { for: "AdwNavigationView"; id: string })
    | (NavigationPageBaseProps & {
          for: "AdwNavigationSplitView";
          id: import("./generated/jsx.js").WidgetSlotNames["AdwNavigationSplitView"];
      });

/**
 * Type mapping widget names to their available slot IDs.
 */
export type { WidgetSlotNames } from "./generated/jsx.js";

/**
 * Props for the ListView component.
 *
 * @typeParam T - The type of items in the list
 */
export type ListViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkListViewProps, "renderItem"> & {
    /** Function to render each list item */
    renderItem: (item: T | null) => ReactNode;
    /** Estimated item height in pixels for proper virtualization before content loads */
    estimatedItemHeight?: number;
};

/**
 * Props for the GridView component.
 *
 * @typeParam T - The type of items in the grid
 */
export type GridViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkGridViewProps, "renderItem"> & {
    /** Function to render each grid item */
    renderItem: (item: T | null) => ReactNode;
    /** Estimated item height in pixels for proper virtualization before content loads */
    estimatedItemHeight?: number;
};

/**
 * Props for the TreeListView component.
 *
 * @typeParam T - The type of items in the tree
 */
export type TreeListViewProps<T = unknown> = Omit<import("./generated/jsx.js").GtkListViewProps, "renderItem"> & {
    /** Function to render each tree item */
    renderItem: TreeRenderItemFn<T>;
    /** Estimated item height in pixels for proper virtualization before content loads */
    estimatedItemHeight?: number;
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
 * GTKX-specific intrinsic elements and components.
 *
 * This namespace provides React components for GTK layout, lists, menus, and slots
 * that are specific to GTKX (not direct GTK widget bindings).
 *
 * @example
 * ```tsx
 * import { x, GtkHeaderBar, GtkDropDown } from "@gtkx/react";
 *
 * <GtkHeaderBar>
 *   <x.Slot for={GtkHeaderBar} id="titleWidget">
 *     <GtkLabel label="App Title" />
 *   </x.Slot>
 * </GtkHeaderBar>
 *
 * <GtkDropDown>
 *   <x.SimpleListItem id="opt1" value="Option 1" />
 *   <x.SimpleListItem id="opt2" value="Option 2" />
 * </GtkDropDown>
 * ```
 */
export const x = {
    /**
     * Type-safe slot component for placing children in named widget slots.
     *
     * GTK widgets often have named slots for specific child positions (e.g., titleWidget,
     * startWidget). This component provides type-safe access to those slots.
     *
     * @example
     * ```tsx
     * <GtkHeaderBar>
     *   <x.Slot for={GtkHeaderBar} id="titleWidget">
     *     <GtkLabel label="App Title" />
     *   </x.Slot>
     * </GtkHeaderBar>
     * ```
     */
    Slot<W extends keyof import("./generated/jsx.js").WidgetSlotNames>(props: {
        for: W;
        id: import("./generated/jsx.js").WidgetSlotNames[W];
        children?: ReactNode;
    }): ReactElement {
        return createElement("Slot", { id: props.id }, props.children);
    },

    /**
     * Element type for pages within a GtkStack or AdwViewStack.
     *
     * @example
     * ```tsx
     * <GtkStack page="page1">
     *   <x.StackPage id="page1" title="First Page">
     *     <GtkLabel label="Content 1" />
     *   </x.StackPage>
     * </GtkStack>
     * ```
     */
    StackPage: "StackPage" as const,

    /**
     * Element type for positioning children within a GtkGrid.
     *
     * @example
     * ```tsx
     * <GtkGrid>
     *   <x.GridChild column={0} row={0}>
     *     <GtkLabel label="Top Left" />
     *   </x.GridChild>
     * </GtkGrid>
     * ```
     */
    GridChild: "GridChild" as const,

    /**
     * Element type for positioning children within a GtkFixed.
     *
     * @example
     * ```tsx
     * <GtkFixed>
     *   <x.FixedChild x={20} y={30}>
     *     <GtkLabel label="Positioned at (20, 30)" />
     *   </x.FixedChild>
     * </GtkFixed>
     * ```
     */
    FixedChild: "FixedChild" as const,

    /**
     * Element type for a page within a GtkNotebook (tabbed interface).
     *
     * @example
     * ```tsx
     * <GtkNotebook>
     *   <x.NotebookPage label="Tab 1">
     *     <GtkLabel label="Content 1" />
     *   </x.NotebookPage>
     * </GtkNotebook>
     * ```
     */
    NotebookPage: "NotebookPage" as const,

    /**
     * Element type for a custom widget as the page tab label.
     */
    NotebookPageTab: "NotebookPageTab" as const,

    /**
     * Element type for items in a ListView or GridView.
     *
     * @example
     * ```tsx
     * <x.ListView renderItem={(item) => <GtkLabel label={item.name} />}>
     *   <x.ListItem id="1" value={{ name: "Item 1" }} />
     * </x.ListView>
     * ```
     */
    ListItem: "ListItem" as const,

    /**
     * Element type for items in a TreeListView.
     *
     * @example
     * ```tsx
     * <x.TreeListView renderItem={(item) => <GtkLabel label={item.name} />}>
     *   <x.TreeListItem id="parent" value={{ name: "Parent" }}>
     *     <x.TreeListItem id="child" value={{ name: "Child" }} />
     *   </x.TreeListItem>
     * </x.TreeListView>
     * ```
     */
    TreeListItem: "TreeListItem" as const,

    /**
     * Element type for simple string-based list items.
     *
     * @example
     * ```tsx
     * <GtkDropDown>
     *   <x.SimpleListItem id="opt1" value="Option 1" />
     * </GtkDropDown>
     * ```
     */
    SimpleListItem: "SimpleListItem" as const,

    /**
     * Component for defining columns in a ColumnView (table widget).
     *
     * @example
     * ```tsx
     * <GtkColumnView>
     *   <x.ColumnViewColumn
     *     id="name"
     *     title="Name"
     *     expand
     *     renderCell={(item) => <GtkLabel label={item?.name ?? ""} />}
     *   />
     * </GtkColumnView>
     * ```
     */
    ColumnViewColumn<T = unknown>(props: ColumnViewColumnProps<T>): ReactElement {
        return createElement("ColumnViewColumn", props);
    },

    /**
     * Virtualized list component with custom item rendering.
     *
     * @example
     * ```tsx
     * <x.ListView renderItem={(item) => <GtkLabel label={item?.name ?? ""} />}>
     *   <x.ListItem id="1" value={{ name: "Apple" }} />
     * </x.ListView>
     * ```
     */
    ListView<T = unknown>(props: ListViewProps<T>): ReactElement {
        return createElement("GtkListView", props);
    },

    /**
     * Virtualized grid component with custom item rendering.
     *
     * @example
     * ```tsx
     * <x.GridView renderItem={(item) => <GtkImage iconName={item?.icon ?? ""} />}>
     *   <x.ListItem id="1" value={{ icon: "folder" }} />
     * </x.GridView>
     * ```
     */
    GridView<T = unknown>(props: GridViewProps<T>): ReactElement {
        return createElement("GtkGridView", props);
    },

    /**
     * Tree list component with hierarchical data and expand/collapse support.
     *
     * @example
     * ```tsx
     * <x.TreeListView renderItem={(item, row) => <GtkLabel label={item.name} />}>
     *   <x.TreeListItem id="root" value={{ name: "Root" }}>
     *     <x.TreeListItem id="child" value={{ name: "Child" }} />
     *   </x.TreeListItem>
     * </x.TreeListView>
     * ```
     */
    TreeListView<T = unknown>(props: TreeListViewProps<T>): ReactElement {
        return createElement("TreeListView", props);
    },

    /**
     * Place child as a prefix (left side) of AdwActionRow, AdwEntryRow, or AdwExpanderRow.
     *
     * @example
     * ```tsx
     * <AdwActionRow title="Setting">
     *   <x.ActionRowPrefix>
     *     <GtkCheckButton />
     *   </x.ActionRowPrefix>
     * </AdwActionRow>
     * ```
     */
    ActionRowPrefix: "ActionRowPrefix" as const,

    /**
     * Place child as a suffix (right side) of AdwActionRow, AdwEntryRow, or AdwExpanderRow.
     *
     * @example
     * ```tsx
     * <AdwActionRow title="Setting">
     *   <x.ActionRowSuffix>
     *     <GtkButton iconName="go-next-symbolic" />
     *   </x.ActionRowSuffix>
     * </AdwActionRow>
     * ```
     */
    ActionRowSuffix: "ActionRowSuffix" as const,

    /**
     * Place child at the start (left in LTR) of HeaderBar or ActionBar.
     *
     * @example
     * ```tsx
     * <GtkHeaderBar>
     *   <x.PackStart>
     *     <GtkButton label="Back" />
     *   </x.PackStart>
     * </GtkHeaderBar>
     * ```
     */
    PackStart: "PackStart" as const,

    /**
     * Place child at the end (right in LTR) of HeaderBar or ActionBar.
     *
     * @example
     * ```tsx
     * <GtkHeaderBar>
     *   <x.PackEnd>
     *     <GtkMenuButton />
     *   </x.PackEnd>
     * </GtkHeaderBar>
     * ```
     */
    PackEnd: "PackEnd" as const,

    /**
     * Place toolbar at the top of AdwToolbarView.
     *
     * @example
     * ```tsx
     * <AdwToolbarView>
     *   <x.ToolbarTop>
     *     <AdwHeaderBar />
     *   </x.ToolbarTop>
     * </AdwToolbarView>
     * ```
     */
    ToolbarTop: "ToolbarTop" as const,

    /**
     * Place toolbar at the bottom of AdwToolbarView.
     *
     * @example
     * ```tsx
     * <AdwToolbarView>
     *   <x.ToolbarBottom>
     *     <GtkActionBar />
     *   </x.ToolbarBottom>
     * </AdwToolbarView>
     * ```
     */
    ToolbarBottom: "ToolbarBottom" as const,

    /**
     * Element type for overlay children positioned above the main content.
     *
     * @example
     * ```tsx
     * <GtkOverlay>
     *   <GtkImage file="background.png" />
     *   <x.OverlayChild>
     *     <GtkLabel label="Overlaid text" />
     *   </x.OverlayChild>
     * </GtkOverlay>
     * ```
     */
    OverlayChild: "OverlayChild" as const,

    /**
     * A clickable menu item with action.
     *
     * @example
     * ```tsx
     * <GtkMenuButton>
     *   <x.MenuItem id="open" label="Open" onActivate={handleOpen} />
     * </GtkMenuButton>
     * ```
     */
    MenuItem: "MenuItem" as const,

    /**
     * A section grouping related menu items.
     *
     * @example
     * ```tsx
     * <GtkMenuButton>
     *   <x.MenuSection label="File">
     *     <x.MenuItem id="open" label="Open" onActivate={handleOpen} />
     *   </x.MenuSection>
     * </GtkMenuButton>
     * ```
     */
    MenuSection: "MenuSection" as const,

    /**
     * A submenu containing nested items.
     *
     * @example
     * ```tsx
     * <GtkMenuButton>
     *   <x.MenuSubmenu label="Export">
     *     <x.MenuItem id="pdf" label="As PDF" onActivate={exportPdf} />
     *   </x.MenuSubmenu>
     * </GtkMenuButton>
     * ```
     */
    MenuSubmenu: "MenuSubmenu" as const,

    /**
     * A mark to display on a GtkScale slider.
     *
     * @example
     * ```tsx
     * <GtkScale>
     *   <x.ScaleMark value={0} label="Min" />
     *   <x.ScaleMark value={50} />
     *   <x.ScaleMark value={100} label="Max" />
     * </GtkScale>
     * ```
     */
    ScaleMark: "ScaleMark" as const,

    /**
     * A day mark on a GtkCalendar.
     *
     * @example
     * ```tsx
     * <GtkCalendar>
     *   <x.CalendarMark day={15} />
     *   <x.CalendarMark day={20} />
     *   <x.CalendarMark day={25} />
     * </GtkCalendar>
     * ```
     */
    CalendarMark: "CalendarMark" as const,

    /**
     * An offset threshold for a GtkLevelBar.
     *
     * @example
     * ```tsx
     * <GtkLevelBar>
     *   <x.LevelBarOffset id="low" value={0.25} />
     *   <x.LevelBarOffset id="high" value={0.75} />
     *   <x.LevelBarOffset id="full" value={1.0} />
     * </GtkLevelBar>
     * ```
     */
    LevelBarOffset: "LevelBarOffset" as const,

    /**
     * A toggle button for an AdwToggleGroup.
     *
     * @example
     * ```tsx
     * <AdwToggleGroup>
     *   <x.Toggle id="list" iconName="view-list-symbolic" />
     *   <x.Toggle id="grid" iconName="view-grid-symbolic" />
     * </AdwToggleGroup>
     * ```
     */
    Toggle: "Toggle" as const,

    /**
     * Nested rows container for AdwExpanderRow.
     *
     * @example
     * ```tsx
     * <AdwExpanderRow title="Settings">
     *   <ExpanderRow.Row>
     *     <AdwActionRow title="Option 1" />
     *     <AdwActionRow title="Option 2" />
     *   </ExpanderRow.Row>
     * </AdwExpanderRow>
     * ```
     */
    ExpanderRowRow: "ExpanderRowRow" as const,

    /**
     * Action widget container for AdwExpanderRow header.
     *
     * @example
     * ```tsx
     * <AdwExpanderRow title="Group">
     *   <ExpanderRow.Action>
     *     <GtkButton iconName="emblem-system-symbolic" />
     *   </ExpanderRow.Action>
     * </AdwExpanderRow>
     * ```
     */
    ExpanderRowAction: "ExpanderRowAction" as const,

    /**
     * Type-safe page component for AdwNavigationView or AdwNavigationSplitView.
     *
     * The `for` prop is required and determines valid `id` values:
     * - `AdwNavigationView`: any string (page tags for navigation history)
     * - `AdwNavigationSplitView`: `"content"` or `"sidebar"` (slot positions)
     *
     * @example
     * ```tsx
     * // In NavigationView - id can be any string
     * <AdwNavigationView history={["home"]}>
     *   <x.NavigationPage for={AdwNavigationView} id="home" title="Home">
     *     <GtkLabel label="Welcome!" />
     *   </x.NavigationPage>
     * </AdwNavigationView>
     *
     * // In NavigationSplitView - id is narrowed to "content" | "sidebar"
     * <AdwNavigationSplitView>
     *   <x.NavigationPage for={AdwNavigationSplitView} id="sidebar" title="Sidebar">
     *     <GtkLabel label="Sidebar" />
     *   </x.NavigationPage>
     *   <x.NavigationPage for={AdwNavigationSplitView} id="content" title="Content">
     *     <GtkLabel label="Content" />
     *   </x.NavigationPage>
     * </AdwNavigationSplitView>
     * ```
     */
    NavigationPage: "NavigationPage" as const,
};

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                ActionRowPrefix: VirtualSlotProps;
                ActionRowSuffix: VirtualSlotProps;
                CalendarMark: CalendarMarkProps;
                // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
                ColumnViewColumn: ColumnViewColumnProps<any>;
                ExpanderRowAction: ExpanderRowChildProps;
                ExpanderRowRow: ExpanderRowChildProps;
                FixedChild: FixedChildProps;
                GridChild: GridChildProps;
                LevelBarOffset: LevelBarOffsetProps;
                ListItem: ListItemProps;
                MenuItem: MenuItemProps;
                MenuSection: MenuSectionProps;
                MenuSubmenu: MenuSubmenuProps;
                NotebookPage: NotebookPageProps;
                NotebookPageTab: VirtualSlotProps;
                OverlayChild: OverlayChildProps;
                PackEnd: VirtualSlotProps;
                PackStart: VirtualSlotProps;
                ScaleMark: ScaleMarkProps;
                SimpleListItem: StringListItemProps;
                StackPage: StackPageProps;
                Toggle: ToggleProps;
                ToolbarBottom: VirtualSlotProps;
                ToolbarTop: VirtualSlotProps;
                // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
                TreeListItem: TreeListItemProps<any>;
                NavigationPage: NavigationPageProps;
            }
        }
    }
}

export * from "./generated/jsx.js";
