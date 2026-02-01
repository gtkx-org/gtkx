import type * as Adw from "@gtkx/ffi/adw";
import type * as cairo from "@gtkx/ffi/cairo";
import type * as Gdk from "@gtkx/ffi/gdk";
import type * as Gsk from "@gtkx/ffi/gsk";
import type * as Gtk from "@gtkx/ffi/gtk";
import type * as GtkSource from "@gtkx/ffi/gtksource";
import type * as Pango from "@gtkx/ffi/pango";
import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import type { GtkListViewProps as GeneratedGtkListViewProps, WidgetSlotNames } from "./generated/jsx.js";
import type { AnimationProps } from "./nodes/internal/animation/types.js";
import type { TreeRenderItemFn } from "./nodes/internal/tree-list-item-renderer.js";
import type { ShortcutProps as ShortcutNodeProps } from "./nodes/shortcut.js";
import type { TextAnchorProps } from "./nodes/text-anchor.js";
import type { TextPaintableProps } from "./nodes/text-paintable.js";
import type { TextTagProps } from "./nodes/text-tag.js";

export type {
    AnimatableProperties,
    AnimationProps,
    AnimationTransition,
    SpringTransition,
    TimedTransition,
} from "./nodes/internal/animation/types.js";
export type { TextAnchorProps } from "./nodes/text-anchor.js";
export type { TextPaintableProps } from "./nodes/text-paintable.js";
export type { TextTagProps } from "./nodes/text-tag.js";

/**
 * Configuration for a mark on a GtkScale widget.
 *
 * Marks are visual indicators placed along the scale at specific values,
 * optionally with text labels.
 *
 * @see {@link https://docs.gtk.org/gtk4/method.Scale.add_mark.html GtkScale.add_mark}
 */
export type ScaleMark = {
    /** The value at which to place the mark */
    value: number;
    /** Position of the mark relative to the scale (default: BOTTOM) */
    position?: Gtk.PositionType;
    /** Optional text label to display at the mark */
    label?: string | null;
};

/**
 * Configuration for an offset threshold on a GtkLevelBar widget.
 *
 * Offsets define named value thresholds that change the bar's appearance
 * (e.g., "low", "high", "full"). Built-in offsets include GTK_LEVEL_BAR_OFFSET_LOW,
 * GTK_LEVEL_BAR_OFFSET_HIGH, and GTK_LEVEL_BAR_OFFSET_FULL.
 *
 * @see {@link https://docs.gtk.org/gtk4/method.LevelBar.add_offset_value.html GtkLevelBar.add_offset_value}
 */
export type LevelBarOffset = {
    /** Unique identifier for this offset (e.g., "low", "high", "full") */
    id: string;
    /** The threshold value at which this offset applies */
    value: number;
};

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
 * Type mapping widgets to their valid container slot method names.
 *
 * Each key is a JSX element name and each value is a union of method names
 * that can be used as the `id` prop on `x.ContainerSlot`.
 */
export type ContainerSlotNames = {
    AdwActionRow: "addPrefix" | "addSuffix";
    AdwEntryRow: "addPrefix" | "addSuffix";
    AdwExpanderRow: "addPrefix" | "addSuffix" | "addRow" | "addAction";
    AdwHeaderBar: "packStart" | "packEnd";
    AdwToolbarView: "addTopBar" | "addBottomBar";
    GtkActionBar: "packStart" | "packEnd";
    GtkHeaderBar: "packStart" | "packEnd";
};

/**
 * Props for method-based container slot child positioning.
 *
 * @see {@link x.ContainerSlot} for type-safe usage
 */
export type ContainerSlotProps = {
    /** The method name to call on the parent widget */
    id: string;
    /** Content to place in the container slot */
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
 * Props for items in a GtkListView, GtkGridView, or GtkColumnView.
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
    /** 3D transform to apply to the child (perspective, rotation, etc.) */
    transform?: Gsk.Transform;
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
    onSortChanged?: (column: C | null, order: Gtk.SortType) => void;
    /** Estimated row height in pixels for proper virtualization before content loads */
    estimatedRowHeight?: number;
};

/**
 * Props for notebook (tabbed) pages.
 */
export type NotebookPageProps = VirtualSlotProps & {
    /** Tab label text (optional when using Notebook.PageTab) */
    label?: string;
    /** Whether the tab should expand to fill available space */
    tabExpand?: boolean;
    /** Whether the tab should fill its allocated space */
    tabFill?: boolean;
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
export type OverlayChildProps = VirtualSlotProps & {
    /** Whether to include this child in size measurement */
    measure?: boolean;
    /** Whether to clip this overlay child to the main child bounds */
    clipOverlay?: boolean;
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
 * Props for response buttons in an AdwAlertDialog.
 *
 * Each response represents a button the user can click to dismiss the dialog.
 *
 * @see {@link x.AlertDialogResponse} for usage
 */
export type AlertDialogResponseProps = {
    /** Unique response ID (used in response signal and for default/close response) */
    id: string;
    /** Button label text */
    label: string;
    /** Visual appearance of the response button */
    appearance?: Adw.ResponseAppearance;
    /** Whether the response button is enabled */
    enabled?: boolean;
};

type NavigationPageBaseProps = {
    title?: string;
    canPop?: boolean;
    children?: ReactNode;
};

export type { GtkShortcutControllerProps as ShortcutControllerProps } from "./generated/jsx.js";

/**
 * Props for the Shortcut element in JSX.
 *
 * @see {@link x.Shortcut} for usage examples
 */
export type ShortcutProps = ShortcutNodeProps;

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
          id: WidgetSlotNames["AdwNavigationSplitView"];
      });

export type { WidgetSlotNames };

/**
 * Props for the TreeListView component.
 *
 * @typeParam T - The type of items in the tree
 */
export type TreeListViewProps<T = unknown> = Omit<GeneratedGtkListViewProps, "renderItem"> & {
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
    Slot<W extends keyof WidgetSlotNames>(props: {
        for: W;
        id: WidgetSlotNames[W];
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
     * Element type for items in a GtkListView, GtkGridView, or GtkColumnView.
     *
     * @example
     * ```tsx
     * <GtkListView renderItem={(item) => <GtkLabel label={item.name} />}>
     *   <x.ListItem id="1" value={{ name: "Item 1" }} />
     * </GtkListView>
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
     * Type-safe container slot for placing children via parent widget methods.
     *
     * Unlike `x.Slot` (which uses property setters for single-child slots),
     * `x.ContainerSlot` calls attachment methods that support multiple children
     * (e.g., `addPrefix()`, `packStart()`, `addTopBar()`).
     *
     * The `for` prop provides TypeScript type narrowing for the `id` prop
     * and is not used at runtime.
     *
     * @example
     * ```tsx
     * <AdwToolbarView>
     *   <x.ContainerSlot for={AdwToolbarView} id="addTopBar">
     *     <AdwHeaderBar />
     *   </x.ContainerSlot>
     * </AdwToolbarView>
     *
     * <GtkHeaderBar>
     *   <x.ContainerSlot for={GtkHeaderBar} id="packStart">
     *     <GtkButton label="Back" />
     *   </x.ContainerSlot>
     * </GtkHeaderBar>
     *
     * <AdwActionRow title="Setting">
     *   <x.ContainerSlot for={AdwActionRow} id="addPrefix">
     *     <GtkCheckButton />
     *   </x.ContainerSlot>
     * </AdwActionRow>
     * ```
     */
    ContainerSlot<W extends keyof ContainerSlotNames>(props: {
        for: W;
        id: ContainerSlotNames[W];
        children?: ReactNode;
    }): ReactElement {
        return createElement("ContainerSlot", { id: props.id }, props.children);
    },

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
     * Declarative text tag for styling text content.
     *
     * Wrap text content with a TextTag to apply styling. Tags can be nested.
     *
     * @example
     * ```tsx
     * <GtkTextView>
     *     Normal <x.TextTag id="bold" weight={Pango.Weight.BOLD}>
     *       bold <x.TextTag id="red" foreground="red">and red</x.TextTag>
     *     </x.TextTag> text.
     * </GtkTextView>
     * ```
     */
    TextTag: "TextTag" as const,

    /**
     * Declarative anchor for embedding widgets in text flow.
     *
     * The anchor is placed at the current position in the text.
     *
     * @example
     * ```tsx
     * <GtkTextView>
     *     Click here: <x.TextAnchor>
     *       <GtkButton label="Click me" />
     *     </x.TextAnchor> to continue.
     * </GtkTextView>
     * ```
     */
    TextAnchor: "TextAnchor" as const,

    /**
     * Declarative inline paintable for embedding images/icons in text flow.
     *
     * The paintable is placed at the current position in the text.
     *
     * @example
     * ```tsx
     * <GtkTextView>
     *     Click the icon <x.TextPaintable paintable={iconPaintable} /> to continue.
     * </GtkTextView>
     * ```
     */
    TextPaintable: "TextPaintable" as const,

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
     * A response button for an AdwAlertDialog.
     *
     * @example
     * ```tsx
     * <AdwAlertDialog
     *   heading="Delete File?"
     *   body="This cannot be undone."
     *   defaultResponse="cancel"
     *   closeResponse="cancel"
     * >
     *   <x.AlertDialogResponse id="cancel" label="Cancel" />
     *   <x.AlertDialogResponse id="delete" label="Delete" appearance={Adw.ResponseAppearance.DESTRUCTIVE} />
     * </AdwAlertDialog>
     * ```
     */
    AlertDialogResponse: "AlertDialogResponse" as const,

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

    /**
     * Declarative keyboard shortcut controller.
     *
     * Attach keyboard shortcuts to a widget. Must contain `x.Shortcut` children.
     *
     * @example
     * ```tsx
     * <GtkBox>
     *   <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
     *     <x.Shortcut trigger="<Control>f" onActivate={() => setSearchMode(s => !s)} />
     *     <x.Shortcut trigger="<Control>q" onActivate={quit} />
     *   </GtkShortcutController>
     * </GtkBox>
     * ```
     */
    ShortcutController: "GtkShortcutController" as const,

    /**
     * A keyboard shortcut definition.
     *
     * Must be a child of `x.ShortcutController`.
     *
     * @example
     * ```tsx
     * <x.Shortcut trigger="<Control>s" onActivate={save} />
     * <x.Shortcut trigger={["F5", "<Control>r"]} onActivate={refresh} />
     * <x.Shortcut trigger="Escape" onActivate={cancel} disabled={!canCancel} />
     * ```
     */
    Shortcut: "Shortcut" as const,

    /**
     * Declarative animation wrapper using Adw.TimedAnimation or Adw.SpringAnimation.
     *
     * Provides framer-motion-inspired API for animating child widgets.
     *
     * @example
     * ```tsx
     * <x.Animation
     *   initial={{ opacity: 0, scale: 0.9 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ mode: "spring", damping: 0.8, stiffness: 200 }}
     *   animateOnMount
     * >
     *   <GtkButton label="Animated Button" />
     * </x.Animation>
     * ```
     */
    Animation: "Animation" as const,
};

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                AlertDialogResponse: AlertDialogResponseProps;
                Animation: AnimationProps;
                ContainerSlot: ContainerSlotProps;
                // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
                ColumnViewColumn: ColumnViewColumnProps<any>;
                FixedChild: FixedChildProps;
                GridChild: GridChildProps;
                ListItem: ListItemProps;
                MenuItem: MenuItemProps;
                MenuSection: MenuSectionProps;
                MenuSubmenu: MenuSubmenuProps;
                NotebookPage: NotebookPageProps;
                NotebookPageTab: VirtualSlotProps;
                OverlayChild: OverlayChildProps;
                TextAnchor: TextAnchorProps;
                TextPaintable: TextPaintableProps;
                TextTag: TextTagProps;
                SimpleListItem: StringListItemProps;
                StackPage: StackPageProps;
                Toggle: ToggleProps;
                // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant behavior
                TreeListItem: TreeListItemProps<any>;
                NavigationPage: NavigationPageProps;
                Shortcut: ShortcutProps;
            }
        }
    }
}

declare module "./generated/jsx.js" {
    interface GtkRangeProps {
        value?: number;
        lower?: number;
        upper?: number;
        stepIncrement?: number;
        pageIncrement?: number;
        pageSize?: number;
        onValueChanged?: ((value: number, self: Gtk.Range) => void) | null;
    }

    interface GtkScaleProps {
        marks?: Array<{ value: number; position?: Gtk.PositionType; label?: string | null }> | null;
    }

    interface GtkScaleButtonProps {
        value?: number;
        lower?: number;
        upper?: number;
        stepIncrement?: number;
        pageIncrement?: number;
        pageSize?: number;
        onValueChanged?: ((value: number, self: Gtk.ScaleButton) => void) | null;
    }

    interface GtkSpinButtonProps {
        value?: number;
        lower?: number;
        upper?: number;
        stepIncrement?: number;
        pageIncrement?: number;
        pageSize?: number;
        onValueChanged?: ((value: number, self: Gtk.SpinButton) => void) | null;
    }

    interface AdwSpinRowProps {
        value?: number;
        lower?: number;
        upper?: number;
        stepIncrement?: number;
        pageIncrement?: number;
        pageSize?: number;
        onValueChanged?: ((value: number, self: Adw.SpinRow) => void) | null;
    }

    interface GtkCalendarProps {
        markedDays?: number[] | null;
    }

    interface GtkLevelBarProps {
        offsets?: Array<{ id: string; value: number }> | null;
    }

    interface GtkTextViewProps {
        enableUndo?: boolean;
        onBufferChanged?: ((buffer: Gtk.TextBuffer) => void) | null;
        onTextInserted?: ((buffer: Gtk.TextBuffer, offset: number, text: string) => void) | null;
        onTextDeleted?: ((buffer: Gtk.TextBuffer, startOffset: number, endOffset: number) => void) | null;
        onCanUndoChanged?: ((canUndo: boolean) => void) | null;
        onCanRedoChanged?: ((canRedo: boolean) => void) | null;
    }

    interface GtkSourceViewProps {
        enableUndo?: boolean;
        onBufferChanged?: ((buffer: Gtk.TextBuffer) => void) | null;
        onTextInserted?: ((buffer: Gtk.TextBuffer, offset: number, text: string) => void) | null;
        onTextDeleted?: ((buffer: Gtk.TextBuffer, startOffset: number, endOffset: number) => void) | null;
        onCanUndoChanged?: ((canUndo: boolean) => void) | null;
        onCanRedoChanged?: ((canRedo: boolean) => void) | null;
        language?: string | GtkSource.Language;
        styleScheme?: string | GtkSource.StyleScheme;
        highlightSyntax?: boolean;
        highlightMatchingBrackets?: boolean;
        implicitTrailingNewline?: boolean;
        onCursorMoved?: (() => void) | null;
        onHighlightUpdated?: ((start: Gtk.TextIter, end: Gtk.TextIter) => void) | null;
    }

    interface GtkListViewProps {
        // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant item type
        renderItem: (item: any) => ReactNode;
        estimatedItemHeight?: number;
        selected?: string[] | null;
        onSelectionChanged?: ((ids: string[]) => void) | null;
        selectionMode?: Gtk.SelectionMode | null;
    }

    interface GtkGridViewProps {
        // biome-ignore lint/suspicious/noExplicitAny: Required for contravariant item type
        renderItem: (item: any) => ReactNode;
        estimatedItemHeight?: number;
        selected?: string[] | null;
        onSelectionChanged?: ((ids: string[]) => void) | null;
        selectionMode?: Gtk.SelectionMode | null;
    }

    interface GtkColumnViewProps {
        selected?: string[] | null;
        onSelectionChanged?: ((ids: string[]) => void) | null;
        selectionMode?: Gtk.SelectionMode | null;
        sortColumn?: string | null;
        sortOrder?: Gtk.SortType | null;
        onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null;
        estimatedRowHeight?: number | null;
    }

    interface GtkDropDownProps {
        selectedId?: string | null;
        onSelectionChanged?: ((id: string) => void) | null;
    }

    interface AdwComboRowProps {
        selectedId?: string | null;
        onSelectionChanged?: ((id: string) => void) | null;
    }

    interface GtkStackProps {
        page?: string | null;
        onPageChanged?: ((page: string | null, self: Gtk.Stack) => void) | null;
    }

    interface AdwViewStackProps {
        page?: string | null;
        onPageChanged?: ((page: string | null, self: Adw.ViewStack) => void) | null;
    }

    interface AdwNavigationViewProps {
        history?: string[] | null;
        onHistoryChanged?: ((history: string[]) => void) | null;
    }

    interface GtkWindowProps {
        onClose?: (() => void) | null;
    }

    interface GtkDrawingAreaProps {
        onDraw?: ((self: Gtk.DrawingArea, cr: cairo.Context, width: number, height: number) => void) | null;
    }

    interface GtkColorDialogButtonProps {
        onRgbaChanged?: ((rgba: Gdk.RGBA) => void) | null;
        title?: string;
        modal?: boolean;
        withAlpha?: boolean;
    }

    interface GtkFontDialogButtonProps {
        onFontDescChanged?: ((fontDesc: Pango.FontDescription) => void) | null;
        title?: string;
        modal?: boolean;
        language?: Pango.Language | null;
        useFont?: boolean;
        useSize?: boolean;
        level?: Gtk.FontLevel;
    }

    interface GtkAboutDialogProps {
        creditSections?: Array<{ name: string; people: string[] }>;
    }

    interface GtkSearchBarProps {
        onSearchModeChanged?: ((searchMode: boolean) => void) | null;
    }

    interface AdwToggleGroupProps {
        onActiveChanged?: ((active: number, activeName: string | null) => void) | null;
    }

    interface GtkDragSourceProps {
        icon?: Gdk.Paintable | null;
        iconHotX?: number;
        iconHotY?: number;
    }

    interface GtkDropTargetProps {
        types?: number[];
    }
}

export * from "./generated/jsx.js";
