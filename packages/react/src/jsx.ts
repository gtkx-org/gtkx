import type * as Adw from "@gtkx/ffi/adw";
import type * as cairo from "@gtkx/ffi/cairo";
import type * as Gdk from "@gtkx/ffi/gdk";
import type * as Gsk from "@gtkx/ffi/gsk";
import type * as Gtk from "@gtkx/ffi/gtk";
import type * as GtkSource from "@gtkx/ffi/gtksource";
import type * as Pango from "@gtkx/ffi/pango";
import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import type { WidgetSlotNames } from "./generated/jsx.js";

/**
 * CSS properties that can be animated on a widget.
 *
 * All transforms are applied via GTK CSS and rendered through the widget's style context.
 */
export type AnimatableProperties = {
    /** Opacity from 0 (fully transparent) to 1 (fully opaque) */
    opacity?: number;
    /** Horizontal translation in pixels (positive moves right) */
    translateX?: number;
    /** Vertical translation in pixels (positive moves down) */
    translateY?: number;
    /** Uniform scale factor (1 = original size, 2 = double size) */
    scale?: number;
    /** Horizontal scale factor */
    scaleX?: number;
    /** Vertical scale factor */
    scaleY?: number;
    /** Rotation angle in degrees (positive rotates clockwise) */
    rotate?: number;
    /** Horizontal skew angle in degrees */
    skewX?: number;
    /** Vertical skew angle in degrees */
    skewY?: number;
};

/**
 * Transition configuration for timed (duration-based) animations.
 *
 * @see {@link https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.TimedAnimation.html Adw.TimedAnimation}
 */
export type TimedTransition = {
    /** Discriminant: duration-based animation with easing curves */
    mode: "timed";
    /** Animation duration in milliseconds (default: 300) */
    duration?: number;
    /** Easing function for the animation curve (default: EASE_OUT_CUBIC) */
    easing?: Adw.Easing;
    /** Delay before starting the animation in milliseconds */
    delay?: number;
    /** Number of times to repeat the animation (0 = no repeat, -1 = infinite) */
    repeat?: number;
    /** Whether to play the animation in reverse */
    reverse?: boolean;
    /** Whether to alternate direction on each repeat */
    alternate?: boolean;
};

/**
 * Transition configuration for spring (physics-based) animations.
 *
 * Spring animations simulate a mass attached to a spring, providing natural-feeling motion.
 * The animation settles when the spring reaches equilibrium.
 *
 * @see {@link https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.SpringAnimation.html Adw.SpringAnimation}
 */
export type SpringTransition = {
    /** Discriminant: physics-based spring animation */
    mode: "spring";
    /** Damping ratio controlling oscillation decay (default: 1, critically damped) */
    damping?: number;
    /** Spring stiffness in N/m affecting animation speed (default: 100) */
    stiffness?: number;
    /** Virtual mass in kg affecting momentum (default: 1) */
    mass?: number;
    /** Initial velocity to apply at animation start */
    initialVelocity?: number;
    /** Whether to clamp the animation value to prevent overshooting */
    clamp?: boolean;
    /** Delay before starting the animation in milliseconds */
    delay?: number;
};

/**
 * Discriminated union of all transition configurations.
 *
 * The `mode` field determines the animation type:
 * - `"timed"`: Duration-based animation with easing curves (uses {@link Adw.TimedAnimation})
 * - `"spring"`: Physics-based spring animation (uses {@link Adw.SpringAnimation})
 */
export type AnimationTransition = TimedTransition | SpringTransition;

/**
 * Props for the Animation component.
 *
 * Provides a declarative API for animating widget properties using either
 * timed (duration-based) or spring (physics-based) animations.
 *
 * @example
 * ```tsx
 * <x.Animation
 *   initial={{ opacity: 0, translateY: -20 }}
 *   animate={{ opacity: 1, translateY: 0 }}
 *   exit={{ opacity: 0, translateY: 20 }}
 *   transition={{ mode: "spring", damping: 0.8, stiffness: 200 }}
 *   animateOnMount
 * >
 *   <GtkLabel label="Animated content" />
 * </x.Animation>
 * ```
 */
export type AnimationProps = {
    /** Initial property values before animation starts, or `false` to skip initial state */
    initial?: AnimatableProperties | false;
    /** Target property values to animate towards */
    animate?: AnimatableProperties;
    /** Property values to animate to when the component unmounts */
    exit?: AnimatableProperties;
    /** Transition configuration including animation mode and parameters */
    transition?: AnimationTransition;
    /** Whether to animate from `initial` to `animate` when first mounted (default: false) */
    animateOnMount?: boolean;
    /** Callback fired when an animation begins */
    onAnimationStart?: () => void;
    /** Callback fired when an animation completes */
    onAnimationComplete?: () => void;
    /** The child widget to animate (must be a single GTK widget) */
    children?: ReactNode;
};

/**
 * Props for the Shortcut virtual element.
 *
 * Defines a keyboard shortcut. Must be a child of `x.ShortcutController`.
 *
 * @example
 * ```tsx
 * <x.ShortcutController>
 *     <x.Shortcut trigger="<Control>s" onActivate={save} />
 *     <x.Shortcut trigger={["F5", "<Control>r"]} onActivate={refresh} />
 *     <x.Shortcut trigger="Escape" onActivate={cancel} disabled={!canCancel} />
 * </x.ShortcutController>
 * ```
 */
export type ShortcutProps = {
    /** The trigger string(s) using GTK accelerator format (e.g., "\<Control\>s", "F1") */
    trigger: string | string[];
    /**
     * Called when the shortcut is activated.
     * Return false to indicate the shortcut was not handled; otherwise it is considered handled.
     */
    // biome-ignore lint/suspicious/noConfusingVoidType: void is intentional to allow callbacks that don't return a value
    onActivate: () => boolean | void;
    /** Whether the shortcut is disabled */
    disabled?: boolean;
};

/**
 * Props for the TextAnchor virtual element.
 *
 * Used to declaratively embed widgets within text content in a TextBuffer.
 * The anchor is placed at the current position in the text flow.
 *
 * @example
 * ```tsx
 * <GtkTextView>
 *     <x.TextBuffer>
 *         Click here: <x.TextAnchor>
 *             <GtkButton label="Click me" />
 *         </x.TextAnchor> to continue.
 *     </x.TextBuffer>
 * </GtkTextView>
 * ```
 */
export type TextAnchorProps = {
    /** The widget to embed at this anchor position */
    children?: ReactNode;
};

/**
 * Props for the TextPaintable virtual element.
 *
 * Used to embed inline images or icons within text content in a GtkTextView.
 */
export type TextPaintableProps = {
    /** The paintable (image, icon, etc.) to embed inline with the text */
    paintable: Gdk.Paintable;
};

/**
 * Props for the TextTag virtual element.
 *
 * Used to declaratively define and apply text formatting to content within a TextBuffer.
 *
 * @example
 * ```tsx
 * <GtkTextView>
 *     <x.TextBuffer>
 *         Hello <x.TextTag id="bold" weight={Pango.Weight.BOLD}>bold</x.TextTag> world
 *     </x.TextBuffer>
 * </GtkTextView>
 * ```
 */
export type TextTagProps = {
    /** Unique identifier for this tag in the tag table */
    id: string;
    /** Priority of this tag (higher wins when multiple tags affect same property) */
    priority?: number;
    /** Background color as a string (e.g., "red", "#ff0000") */
    background?: string;
    /** Whether the background fills the entire line height */
    backgroundFullHeight?: boolean;
    /** Foreground (text) color as a string */
    foreground?: string;
    /** Font family name (e.g., "Sans", "Monospace") */
    family?: string;
    /** Font description string (e.g., "Sans Italic 12") */
    font?: string;
    /** Font size in points */
    sizePoints?: number;
    /** Font size in Pango units */
    size?: number;
    /** Font size scale factor relative to default */
    scale?: number;
    /** Font weight (use Pango.Weight constants) */
    weight?: Pango.Weight | number;
    /** Font style (use Pango.Style constants) */
    style?: Pango.Style;
    /** Font stretch (use Pango.Stretch constants) */
    stretch?: Pango.Stretch;
    /** Font variant (use Pango.Variant constants) */
    variant?: Pango.Variant;
    /** Whether to strike through the text */
    strikethrough?: boolean;
    /** Underline style (use Pango.Underline constants) */
    underline?: Pango.Underline;
    /** Overline style (use Pango.Overline constants) */
    overline?: Pango.Overline;
    /** Offset of text above baseline in Pango units (negative = below) */
    rise?: number;
    /** Extra spacing between characters in Pango units */
    letterSpacing?: number;
    /** Factor to scale line height by */
    lineHeight?: number;
    /** Left margin in pixels */
    leftMargin?: number;
    /** Right margin in pixels */
    rightMargin?: number;
    /** Paragraph indent in pixels (negative = hanging) */
    indent?: number;
    /** Pixels of blank space above paragraphs */
    pixelsAboveLines?: number;
    /** Pixels of blank space below paragraphs */
    pixelsBelowLines?: number;
    /** Pixels of blank space between wrapped lines */
    pixelsInsideWrap?: number;
    /** Text justification */
    justification?: Gtk.Justification;
    /** Text direction */
    direction?: Gtk.TextDirection;
    /** Wrap mode for line breaks */
    wrapMode?: Gtk.WrapMode;
    /** Whether the text can be modified */
    editable?: boolean;
    /** Whether the text is invisible/hidden */
    invisible?: boolean;
    /** Whether breaks are allowed */
    allowBreaks?: boolean;
    /** Whether to insert hyphens at breaks */
    insertHyphens?: boolean;
    /** Whether font fallback is enabled */
    fallback?: boolean;
    /** Whether margins accumulate */
    accumulativeMargin?: boolean;
    /** Paragraph background color as a string */
    paragraphBackground?: string;
    /** How to render invisible characters */
    showSpaces?: Pango.ShowFlags;
    /** How to transform text for display */
    textTransform?: Pango.TextTransform;
    /** OpenType font features as a string */
    fontFeatures?: string;
    /** Language code (e.g., "en-US") */
    language?: string;
    /** Text content and nested TextTag children */
    children?: ReactNode;
};

/** Props for the TextSegment virtual element.
 *
 * Represents a segment of text within a TextBuffer.
 */
export type TextSegmentProps = {
    /** The text content of this segment */
    text: string;
};

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
 * Props for items in a GtkListView, GtkGridView, or GtkColumnView.
 *
 * When used inside a GtkListView, items can be nested to create tree hierarchies.
 * Tree-specific props (`indentForDepth`, `indentForIcon`, `hideExpander`) only
 * apply when items are used inside a GtkListView with nested children.
 *
 * @typeParam T - The type of data associated with this list item
 */
export type ListItemProps<T = unknown> = {
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
    /** Nested list items (children of this item in a tree) */
    children?: ReactNode;
};

/**
 * Props for positioning children within a GtkGrid.
 *
 * @see {@link GridChild} for usage
 */
export type GridChildProps = {
    /** Content to place in the grid cell */
    children?: ReactNode;
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
export type FixedChildProps = {
    /** Content to place in the fixed container */
    children?: ReactNode;
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
 * Props for notebook (tabbed) pages.
 */
export type NotebookPageProps = {
    /** Content to place in the notebook page */
    children?: ReactNode;
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
export type NotebookPageTabProps = {
    /** Content to place in the notebook page tab */
    children?: ReactNode;
};

/**
 * Props for pages within a Stack or ViewStack.
 *
 * @see {@link StackPage} for usage
 */
export type StackPageProps = {
    /** Content to place in the stack page */
    children?: ReactNode;
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
export type OverlayChildProps = {
    /** Content to place in the overlay child */
    children?: ReactNode;
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
    /** Display title for the navigation page */
    title?: string;
    /** Whether the page can be popped from the navigation stack */
    canPop?: boolean;
    /** Page content */
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
          id: WidgetSlotNames["AdwNavigationSplitView"];
      });

/**
 * Props shared by text buffer hosts (GtkTextView, GtkSourceView).
 *
 * Provides undo control and buffer mutation callbacks.
 */
export type TextBufferProps = {
    /** Whether undo/redo is enabled on the text buffer */
    enableUndo?: boolean;
    /** Callback fired when the buffer content changes */
    onBufferChanged?: ((buffer: Gtk.TextBuffer) => void) | null;
    /** Callback fired when text is inserted into the buffer */
    onTextInserted?: ((buffer: Gtk.TextBuffer, offset: number, text: string) => void) | null;
    /** Callback fired when text is deleted from the buffer */
    onTextDeleted?: ((buffer: Gtk.TextBuffer, startOffset: number, endOffset: number) => void) | null;
    /** Callback fired when the undo availability changes */
    onCanUndoChanged?: ((canUndo: boolean) => void) | null;
    /** Callback fired when the redo availability changes */
    onCanRedoChanged?: ((canRedo: boolean) => void) | null;
};

type BaseListViewProps = {
    /** Estimated item height in pixels for virtualization */
    estimatedItemHeight?: number;
    /** Array of selected item IDs */
    selected?: string[] | null;
    /** Callback fired when the selection changes */
    onSelectionChanged?: ((ids: string[]) => void) | null;
    /** Selection behavior (single, multiple, none, etc.) */
    selectionMode?: Gtk.SelectionMode | null;
};

export type ListViewProps = BaseListViewProps & {
    /** Function to render each list item. The `row` parameter provides tree state for hierarchical lists. */
    // biome-ignore lint/suspicious/noExplicitAny: contravariant parameter requires any for typed callbacks
    renderItem: (item: any, row?: Gtk.TreeListRow | null) => ReactNode;
    /** Whether to automatically expand new tree rows (default: false) */
    autoexpand?: boolean;
};

export type GridViewProps = BaseListViewProps & {
    /** Function to render each grid item */
    // biome-ignore lint/suspicious/noExplicitAny: contravariant parameter requires any for typed callbacks
    renderItem: (item: any) => ReactNode;
};

/**
 * Props shared by single-selection dropdown widgets (GtkDropDown, AdwComboRow).
 */
export type DropDownProps = {
    /** ID of the currently selected item */
    selectedId?: string | null;
    /** Callback fired when the selected item changes */
    onSelectionChanged?: ((id: string) => void) | null;
};

/**
 * Props shared by dialog button widgets (GtkColorDialogButton, GtkFontDialogButton).
 */
export type DialogButtonProps = {
    /** Title for the chooser dialog */
    title?: string;
    /** Whether the dialog is modal */
    modal?: boolean;
};

/**
 * Props for widgets backed by a GtkAdjustment.
 *
 * Used by GtkRange, GtkScaleButton, GtkSpinButton, and AdwSpinRow
 * to configure the adjustment bounds, increments, and value change callback.
 */
export type AdjustableProps = {
    /** The current value of the adjustable */
    value?: number;
    /** The minimum allowed value */
    lower?: number;
    /** The maximum allowed value */
    upper?: number;
    /** The step increment for small adjustments */
    stepIncrement?: number;
    /** The page increment for larger adjustments */
    pageIncrement?: number;
    /** The size of the visible portion (for scrollbars) */
    pageSize?: number;
    /** Callback fired when the adjustable value changes */
    onValueChanged?: ((value: number, self: Gtk.Range | Gtk.ScaleButton | Gtk.SpinButton | Adw.SpinRow) => void) | null;
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
 *   <x.ListItem id="opt1" value="Option 1" />
 *   <x.ListItem id="opt2" value="Option 2" />
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
     * Items can be nested to create tree hierarchies inside a GtkListView.
     *
     * @example
     * ```tsx
     * // Flat list
     * <GtkListView renderItem={(item) => <GtkLabel label={item.name} />}>
     *   <x.ListItem id="1" value={{ name: "Item 1" }} />
     * </GtkListView>
     *
     * // Tree list (nested items)
     * <GtkListView renderItem={(item, row) => <GtkLabel label={item.name} />} autoexpand>
     *   <x.ListItem id="parent" value={{ name: "Parent" }}>
     *     <x.ListItem id="child" value={{ name: "Child" }} />
     *   </x.ListItem>
     * </GtkListView>
     * ```
     */
    ListItem: "ListItem" as const,

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

interface StackProps {
    /** ID of the currently visible page */
    page?: string | null;
}

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                AlertDialogResponse: AlertDialogResponseProps;
                Animation: AnimationProps;
                ContainerSlot: ContainerSlotProps;
                ColumnViewColumn: ColumnViewColumnProps;
                FixedChild: FixedChildProps;
                GridChild: GridChildProps;
                ListItem: ListItemProps;
                MenuItem: MenuItemProps;
                MenuSection: MenuSectionProps;
                MenuSubmenu: MenuSubmenuProps;
                NotebookPage: NotebookPageProps;
                NotebookPageTab: NotebookPageTabProps;
                OverlayChild: OverlayChildProps;
                TextAnchor: TextAnchorProps;
                TextPaintable: TextPaintableProps;
                TextTag: TextTagProps;

                StackPage: StackPageProps;
                Toggle: ToggleProps;
                NavigationPage: NavigationPageProps;
                Shortcut: ShortcutProps;
            }
        }
    }
}

declare module "./generated/jsx.js" {
    interface GtkRangeProps extends Omit<AdjustableProps, "onValueChanged"> {
        /** Callback fired when the range value changes */
        onValueChanged?: ((value: number, self: Gtk.Range) => void) | null;
    }

    interface GtkScaleProps {
        /** Visual marks placed along the scale at specific values */
        marks?: Array<{ value: number; position?: Gtk.PositionType; label?: string | null }> | null;
    }

    interface GtkScaleButtonProps extends Omit<AdjustableProps, "value" | "onValueChanged"> {
        /** Callback fired when the scale button value changes */
        onValueChanged?: ((value: number, self: Gtk.ScaleButton) => void) | null;
    }

    interface GtkSpinButtonProps extends Omit<AdjustableProps, "value" | "onValueChanged"> {
        /** Callback fired when the spin button value changes */
        onValueChanged?: ((value: number, self: Gtk.SpinButton) => void) | null;
    }

    interface AdwSpinRowProps extends Omit<AdjustableProps, "value" | "onValueChanged"> {
        /** Callback fired when the spin row value changes */
        onValueChanged?: ((value: number, self: Adw.SpinRow) => void) | null;
    }

    interface GtkCalendarProps {
        /** Array of day numbers (1-31) to display as marked */
        markedDays?: number[] | null;
    }

    interface GtkLevelBarProps {
        /** Named offset thresholds that change the bar's appearance */
        offsets?: Array<{ id: string; value: number }> | null;
    }

    interface GtkTextViewProps extends TextBufferProps {}

    interface GtkSourceViewProps extends TextBufferProps {
        /** Language for syntax highlighting (ID string or Language object) */
        language?: string | GtkSource.Language;
        /** Color scheme for syntax highlighting (ID string or StyleScheme object) */
        styleScheme?: string | GtkSource.StyleScheme;
        /** Whether syntax highlighting is enabled */
        highlightSyntax?: boolean;
        /** Whether matching brackets are highlighted */
        highlightMatchingBrackets?: boolean;
        /** Whether the buffer has an implicit trailing newline */
        implicitTrailingNewline?: boolean;
        /** Callback fired when the cursor position changes */
        onCursorMoved?: (() => void) | null;
        /** Callback fired when the highlighted region is updated */
        onHighlightUpdated?: ((start: Gtk.TextIter, end: Gtk.TextIter) => void) | null;
    }

    interface GtkListViewProps extends ListViewProps {}

    interface GtkGridViewProps extends GridViewProps {}

    interface GtkColumnViewProps {
        /** Array of selected row IDs */
        selected?: string[] | null;
        /** Callback fired when the selection changes */
        onSelectionChanged?: ((ids: string[]) => void) | null;
        /** Selection behavior (single, multiple, none, etc.) */
        selectionMode?: Gtk.SelectionMode | null;
        /** ID of the currently sorted column, or null for no sorting */
        sortColumn?: string | null;
        /** Sort direction (ascending or descending) */
        sortOrder?: Gtk.SortType | null;
        /** Callback fired when the sort column or order changes */
        onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null;
        /** Estimated row height in pixels for virtualization */
        estimatedRowHeight?: number | null;
    }

    interface GtkDropDownProps extends DropDownProps {}

    interface AdwComboRowProps extends DropDownProps {}

    interface GtkStackProps extends StackProps {
        /** Callback fired when the visible page changes */
        onPageChanged?: ((page: string | null, self: Gtk.Stack) => void) | null;
    }

    interface AdwViewStackProps extends StackProps {
        /** Callback fired when the visible page changes */
        onPageChanged?: ((page: string | null, self: Adw.ViewStack) => void) | null;
    }

    interface AdwNavigationViewProps {
        /** Ordered list of page tags representing the navigation stack */
        history?: string[] | null;
        /** Callback fired when the navigation history changes */
        onHistoryChanged?: ((history: string[]) => void) | null;
    }

    interface GtkWindowProps {
        /** Callback fired when the window close button is clicked */
        onClose?: (() => void) | null;
    }

    interface GtkDrawingAreaProps {
        /** Callback fired when the drawing area needs to be redrawn */
        onDraw?: ((self: Gtk.DrawingArea, cr: cairo.Context, width: number, height: number) => void) | null;
    }

    interface GtkColorDialogButtonProps extends DialogButtonProps {
        /** Callback fired when the selected color changes */
        onRgbaChanged?: ((rgba: Gdk.RGBA) => void) | null;
        /** Whether to show an alpha (opacity) channel */
        withAlpha?: boolean;
    }

    interface GtkFontDialogButtonProps extends DialogButtonProps {
        /** Callback fired when the selected font changes */
        onFontDescChanged?: ((fontDesc: Pango.FontDescription) => void) | null;
    }

    interface GtkAboutDialogProps {
        /** Additional credit sections with names and lists of people */
        creditSections?: Array<{ name: string; people: string[] }>;
    }

    interface GtkSearchBarProps {
        /** Callback fired when search mode is toggled */
        onSearchModeChanged?: ((searchMode: boolean) => void) | null;
    }

    interface AdwToggleGroupProps {
        /** Callback fired when the active toggle changes */
        onActiveChanged?: ((active: number, activeName: string | null) => void) | null;
    }

    interface GtkDragSourceProps {
        /** Paintable to use as the drag icon */
        icon?: Gdk.Paintable | null;
        /** X offset of the hotspot within the drag icon */
        iconHotX?: number;
        /** Y offset of the hotspot within the drag icon */
        iconHotY?: number;
    }

    interface GtkDropTargetProps {
        /** GType values for accepted drop content types */
        types?: number[];
    }
}

export * from "./generated/jsx.js";
