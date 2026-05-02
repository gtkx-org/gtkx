import type * as Adw from "@gtkx/ffi/adw";
import type * as cairo from "@gtkx/ffi/cairo";
import type * as Gdk from "@gtkx/ffi/gdk";
import type * as Gsk from "@gtkx/ffi/gsk";
import type * as Gtk from "@gtkx/ffi/gtk";
import type * as GtkSource from "@gtkx/ffi/gtksource";
import type * as Pango from "@gtkx/ffi/pango";
import type { ReactNode } from "react";
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

/** @internal */
type AnimationBaseProps = {
    /** Initial property values before animation starts, or `false` to skip initial state */
    initial?: AnimatableProperties | false;
    /** Target property values to animate towards */
    animate?: AnimatableProperties;
    /** Property values to animate to when the component unmounts */
    exit?: AnimatableProperties;
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
 * Props for a timed (duration-based) animation using Adw.TimedAnimation.
 *
 * @example
 * ```tsx
 * <AdwTimedAnimation
 *   initial={{ opacity: 0 }}
 *   animate={{ opacity: 1 }}
 *   duration={300}
 *   easing={Adw.Easing.EASE_OUT_CUBIC}
 *   animateOnMount
 * >
 *   <GtkLabel label="Fade in" />
 * </AdwTimedAnimation>
 * ```
 */
export type AdwTimedAnimationProps = AnimationBaseProps & {
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
 * Props for a spring (physics-based) animation using Adw.SpringAnimation.
 *
 * @example
 * ```tsx
 * <AdwSpringAnimation
 *   initial={{ scale: 0.9, opacity: 0 }}
 *   animate={{ scale: 1, opacity: 1 }}
 *   damping={0.8}
 *   stiffness={200}
 *   animateOnMount
 * >
 *   <GtkButton label="Spring in" />
 * </AdwSpringAnimation>
 * ```
 */
export type AdwSpringAnimationProps = AnimationBaseProps & {
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
 * @internal Union type used by the AnimationNode internally.
 */
export type AnimationProps = AdwTimedAnimationProps | AdwSpringAnimationProps;

/**
 * Props for the Shortcut virtual element.
 *
 * Defines a keyboard shortcut. Must be a child of `<GtkShortcutController>`.
 *
 * @example
 * ```tsx
 * <GtkShortcutController>
 *     <x.Shortcut trigger="<Control>s" onActivate={save} />
 *     <x.Shortcut trigger={["F5", "<Control>r"]} onActivate={refresh} />
 *     <x.Shortcut trigger="Escape" onActivate={cancel} disabled={!canCancel} />
 * </GtkShortcutController>
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
    /** Replacement character displayed when the widget is not visible (e.g. in serialized text) */
    replacementChar?: string;
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
 * Used internally by compound components with slot props (e.g. `titleWidget` on `AdwHeaderBar`).
 */
export type SlotProps = {
    /** The slot identifier */
    id?: string;
    /** Content to place in the slot */
    children?: ReactNode;
};

/**
 * Props for method-based container slot child positioning.
 */
export type ContainerSlotProps = {
    /** The method name to call on the parent widget */
    id: string;
    /** Content to place in the container slot */
    children?: ReactNode;
};

/**
 * A data item for list/grid/column views and dropdowns.
 *
 * Uses a discriminated union on the `section` field:
 * - Regular items have `value: T` and optional tree-mode properties
 * - Section headers have `value: S`, `section: true`, and required `children`
 *
 * Mode is detected from data shape:
 * - Any item has `section: true` → section mode
 * - Any item has non-empty `children` (without `section`) → tree mode
 * - Otherwise → flat mode
 *
 * @typeParam T - The type of data for regular items
 * @typeParam S - The type of data for section headers
 */
export type ListItem<T = unknown, S = unknown> =
    | {
          id: string;
          value: T;
          section?: false;
          children?: ListItem<T, S>[];
          hideExpander?: boolean;
          indentForDepth?: boolean;
          indentForIcon?: boolean;
      }
    | {
          id: string;
          value: S;
          section: true;
          children: ListItem<T, S>[];
      };

/**
 * Props for positioning children within a GtkGrid.
 *
 * Used by `GtkGrid.Child` compound component.
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
 * Used by `GtkFixed.Child` compound component.
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
 * Used by `GtkColumnView.Column` compound component.
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
    /** Whether this column is visible */
    visible?: boolean;
    /** Function to render the cell content for each row */
    renderCell: (item: T) => ReactNode;
    /** Menu items for the column header context menu */
    children?: ReactNode;
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
 * Used by `GtkStack.Page` and `AdwViewStack.Page` compound components.
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
 * Used by menu compound components like `GtkMenuButton.MenuItem`.
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
 * Used by `AdwAlertDialog.Response` compound component.
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

/**
 * Base props shared by all navigation page declarations, regardless
 * of the parent container (NavigationView or NavigationSplitView).
 */
export type NavigationPageBaseProps = {
    /** Display title for the navigation page */
    title?: string;
    /** Whether the page can be popped from the navigation stack */
    canPop?: boolean;
    /** Page content */
    children?: ReactNode;
};

/**
 * Props for a navigation page inside an `AdwNavigationView`.
 *
 * The `id` serves as the page tag for navigation history.
 */
export type NavigationViewPageProps = NavigationPageBaseProps & { id: string };

/**
 * Props for a navigation page inside an `AdwNavigationSplitView`.
 *
 * The `id` is narrowed to the valid slot positions of the split view.
 */
export type NavigationSplitViewPageProps = NavigationPageBaseProps & {
    id: WidgetSlotNames["AdwNavigationSplitView"];
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

/** @internal */
type BaseListViewProps = {
    /** Estimated item height in pixels for virtualization */
    estimatedItemHeight?: number;
    /** Estimated item width in pixels for virtualization */
    estimatedItemWidth?: number;
    /** Array of selected item IDs */
    selected?: string[] | null;
    /** Callback fired when the selection changes */
    onSelectionChanged?: ((ids: string[]) => void) | null;
    /** Selection behavior (single, multiple, none, etc.) */
    selectionMode?: Gtk.SelectionMode | null;
};

/**
 * Props for the {@link GtkListView} compound component.
 *
 * Extends the shared list-view base props with item data, a render
 * callback, optional tree expansion, and section header rendering.
 */
export type ListViewProps<T = unknown, S = unknown> = BaseListViewProps & {
    /** Data items to display in the list */
    items?: ListItem<T, S>[];
    /** Function to render each list item. The `row` parameter provides tree state for hierarchical lists. */
    renderItem: (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
    /** Whether to automatically expand new tree rows (default: false) */
    autoexpand?: boolean;
    /** Function to render section headers when items contain section entries */
    renderHeader?: ((item: S) => ReactNode) | null;
};

/**
 * Props for the {@link GtkGridView} compound component.
 *
 * Extends the shared list-view base props with item data and a
 * render callback for each grid cell.
 */
export type GridViewProps<T = unknown> = BaseListViewProps & {
    /** Data items to display in the grid */
    items?: ListItem<T>[];
    /** Function to render each grid item */
    renderItem: (item: T) => ReactNode;
};

/**
 * Props shared by single-selection dropdown widgets (GtkDropDown, AdwComboRow).
 */
export type DropDownProps<T = unknown, S = unknown> = {
    /** Data items to display in the dropdown */
    items?: ListItem<T, S>[];
    /** ID of the currently selected item */
    selectedId?: string | null;
    /** Callback fired when the selected item changes */
    onSelectionChanged?: ((id: string) => void) | null;
    /** Function to render each item. Sets the primary factory, used for both button and popup list unless overridden by renderListItem. */
    renderItem?: ((item: T) => ReactNode) | null;
    /** Function to render items in the popup list only, overriding renderItem for the list. */
    renderListItem?: ((item: T) => ReactNode) | null;
    /** Function to render section headers when items contain section entries */
    renderHeader?: ((item: S) => ReactNode) | null;
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

interface StackProps {
    /** ID of the currently visible page */
    page?: string | null;
}

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                Slot: SlotProps;
                AdwTimedAnimation: AdwTimedAnimationProps;
                AdwSpringAnimation: AdwSpringAnimationProps;
                ContainerSlot: ContainerSlotProps;
                ColumnViewColumn: ColumnViewColumnProps;
                FixedChild: FixedChildProps;
                GridChild: GridChildProps;
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
                NavigationPage: NavigationPageProps;
                Shortcut: ShortcutProps;
            }
        }
    }
}

/**
 * Accessibility attribute props mixed into every widget.
 *
 * Maps to the GTK `GtkAccessible` interface properties, states,
 * and relations, allowing assistive technologies to query widget
 * semantics.
 */
export type AccessibleProps = {
    accessibleAutocomplete?: Gtk.AccessibleAutocomplete;
    accessibleDescription?: string;
    accessibleHasPopup?: boolean;
    accessibleKeyShortcuts?: string;
    accessibleLabel?: string;
    accessibleLevel?: number;
    accessibleModal?: boolean;
    accessibleMultiLine?: boolean;
    accessibleMultiSelectable?: boolean;
    accessibleOrientation?: Gtk.Orientation;
    accessiblePlaceholder?: string;
    accessibleReadOnly?: boolean;
    accessibleRequired?: boolean;
    accessibleRoleDescription?: string;
    accessibleSort?: Gtk.AccessibleSort;
    accessibleValueMax?: number;
    accessibleValueMin?: number;
    accessibleValueNow?: number;
    accessibleValueText?: string;
    accessibleHelpText?: string;

    accessibleBusy?: boolean;
    accessibleChecked?: Gtk.AccessibleTristate;
    accessibleDisabled?: boolean;
    accessibleExpanded?: boolean;
    accessibleHidden?: boolean;
    accessibleInvalid?: Gtk.AccessibleInvalidState;
    accessiblePressed?: Gtk.AccessibleTristate;
    accessibleSelected?: boolean;
    accessibleVisited?: boolean;

    accessibleActiveDescendant?: Gtk.Widget;
    accessibleColCount?: number;
    accessibleColIndex?: number;
    accessibleColIndexText?: string;
    accessibleColSpan?: number;
    accessibleControls?: Gtk.Widget[];
    accessibleDescribedBy?: Gtk.Widget[];
    accessibleDetails?: Gtk.Widget[];
    accessibleErrorMessage?: Gtk.Widget[];
    accessibleFlowTo?: Gtk.Widget[];
    accessibleLabelledBy?: Gtk.Widget[];
    accessibleOwns?: Gtk.Widget[];
    accessiblePosInSet?: number;
    accessibleRowCount?: number;
    accessibleRowIndex?: number;
    accessibleRowIndexText?: string;
    accessibleRowSpan?: number;
    accessibleSetSize?: number;
};

declare module "./generated/jsx.js" {
    interface WidgetProps extends AccessibleProps {}

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

    interface AdwSwitchRowProps {
        /** Callback fired when the switch row active state changes */
        onActiveChanged?: ((active: boolean, self: Adw.SwitchRow) => void) | null;
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
        /** Data items to display in the column view */
        items?: ListItem[];
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
        /** Function to render section headers when items contain section entries */
        renderHeader?: ((item: unknown) => ReactNode) | null;
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
        /** Render function called when the drawing area needs to be redrawn. Changing this reference automatically queues a redraw. */
        render?: ((cr: cairo.Context, width: number, height: number, self: Gtk.DrawingArea) => void) | null;
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
        /** Filter to restrict which fonts are shown in the dialog */
        filter?: Gtk.Filter | null;
        /** Custom font map to select fonts from */
        fontMap?: Pango.FontMap | null;
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
        /** Declarative toggle definitions for the group */
        toggles?: ToggleProps[];
    }

    interface AdwAlertDialogProps {
        /** Declarative response button definitions for the dialog */
        responses?: AlertDialogResponseProps[];
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

export { AdwComboRow, GtkColumnView, GtkDropDown, GtkGridView, GtkListView } from "./components/list.js";
export * from "./generated/compounds.js";

/** JSX intrinsic element name for timed (duration-based) Adwaita animations. */
export const AdwTimedAnimation = "AdwTimedAnimation" as const;
/** JSX intrinsic element name for spring-physics-based Adwaita animations. */
export const AdwSpringAnimation = "AdwSpringAnimation" as const;

export * from "./generated/jsx.js";
