import type * as Gdk from "@gtkx/gi/gdk";
import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type { GType } from "@gtkx/gi/gobject";
import type * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import type * as Pango from "@gtkx/gi/pango";
import type { ReactNode } from "react";

/**
 * Props for the TextAnchor virtual element.
 *
 * Used to declaratively embed widgets within text content in a TextBuffer.
 * The anchor is placed at the current position in the text flow.
 *
 * @example
 * ```tsx
 * <GtkTextView>
 *     <GtkTextBuffer>
 *         Click here: <GtkTextAnchor>
 *             <GtkButton label="Click me" />
 *         </GtkTextAnchor> to continue.
 *     </GtkTextBuffer>
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
 *     <GtkTextBuffer>
 *         Hello <GtkTextTag name="bold" weight={Pango.Weight.BOLD}>bold</GtkTextTag> world
 *     </GtkTextBuffer>
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
    weight?: Pango.Weight | (number & {});
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
 * A day number (1–31) to mark on a GtkCalendar.
 *
 * @see {@link https://docs.gtk.org/gtk4/method.Calendar.mark_day.html GtkCalendar.mark_day}
 */
export type CalendarMark = number;

/**
 * A `GType` value accepted as drop content on a GtkDropTarget.
 *
 * @see {@link https://docs.gtk.org/gtk4/method.DropTarget.set_gtypes.html GtkDropTarget.set_gtypes}
 */
export type DropTargetType = GType;

/**
 * A named credit section for a GtkAboutDialog, pairing a section heading with
 * the list of people credited under it.
 *
 * @see {@link https://docs.gtk.org/gtk4/method.AboutDialog.add_credit_section.html GtkAboutDialog.add_credit_section}
 */
export type CreditSection = {
    /** The section heading shown in the dialog's Credits tab */
    name: string;
    /** The people credited under this section */
    people: string[];
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
 * Used by the `<GtkGridChild>` component.
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
 * Used by the `<GtkFixedChild>` component.
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
 * Used by the `<GtkColumnViewColumn>` component.
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
    /**
     * Function to render the cell content for each row. The argument is the row value:
     * `item.value` in controlled mode, or the `GObject.Object` from `model.getItem(position)`
     * in uncontrolled mode. Specialize `T` to the appropriate type at the call site.
     */
    renderCell: (item: T) => ReactNode;
    /** A `<GMenu>` shown as the column header's context menu. */
    headerMenu?: ReactNode;
};

/**
 * Props for notebook (tabbed) pages.
 */
export type NotebookPageProps = {
    /** Content to place in the notebook page */
    children?: ReactNode;
    /** Tab label text; ignored when `tabLabel` is provided */
    label?: string;
    /** Custom widget rendered as the tab label; when provided it takes precedence over `label` */
    tabLabel?: ReactNode;
    /** Whether the tab should expand to fill available space */
    tabExpand?: boolean;
    /** Whether the tab should fill its allocated space */
    tabFill?: boolean;
};

/**
 * Props for pages within a Stack or ViewStack.
 *
 * Used by the `<GtkStackPage>` and `<AdwViewStackPage>` components.
 */
export type StackPageProps = {
    /** Content to place in the stack page */
    children?: ReactNode;
    /** Unique identifier for this page (matches the stack's `visibleChildName`) */
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
    /** Visual appearance of the response button (`Adw.ResponseAppearance`: 0 default, 1 suggested, 2 destructive) */
    appearance?: 0 | 1 | 2;
    /** Whether the response button is enabled */
    enabled?: boolean;
};

/** @internal Shared layout/virtualization props applied to every list-view variant. */
type ListViewSharedProps = {
    /** Estimated item height in pixels for virtualization */
    estimatedItemHeight?: number;
    /** Estimated item width in pixels for virtualization */
    estimatedItemWidth?: number;
};

/** @internal Controlled-mode selection props (only valid when `items` is used). */
type ListViewControlledSelectionProps = {
    /** Array of selected item IDs */
    selected?: string[] | null;
    /** Callback fired when the selection changes */
    onSelectionChanged?: ((ids: string[]) => void) | null;
    /** Selection behavior (single, multiple, none, etc.) */
    selectionMode?: Gtk.SelectionMode | null;
};

/**
 * @internal
 * Resolves the item type seen by `renderItem` in uncontrolled mode. If the consumer
 * specializes the generic to a `GObject.Object` subclass, `renderItem` receives that
 * subclass; otherwise it defaults to `GObject.Object`.
 */
type UncontrolledItemType<T> = [T] extends [GObject.Object] ? T : GObject.Object;

/**
 * Props for the {@link GtkListView} compound component.
 *
 * Extends the shared list-view base props with item data, a render
 * callback, optional tree expansion, and section header rendering.
 */
export type ListViewProps<T = unknown, S = unknown> = ListViewSharedProps &
    (
        | (ListViewControlledSelectionProps & {
              /** Data items to display in the list */
              items?: ListItem<T, S>[];
              /** Function to render each list item; `row` provides tree state for hierarchical lists. */
              renderItem: (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
              /** Whether to automatically expand new tree rows (default: false) */
              autoexpand?: boolean;
              /** Function to render section headers when items contain section entries */
              renderHeader?: ((item: S) => ReactNode) | null;
              model?: never;
          })
        | {
              /**
               * Uncontrolled mode: hands the given `Gio.ListModel` straight to the widget. The
               * caller owns the model lifecycle and must wrap data in a `Gtk.SingleSelection` or
               * `Gtk.MultiSelection` so the widget receives a `Gtk.SelectionModel`.
               */
              model: Gio.ListModel;
              /** Function to render each list item; receives the `GObject.Object` from the model. */
              renderItem: (item: UncontrolledItemType<T>) => ReactNode;
              items?: never;
              autoexpand?: never;
              renderHeader?: never;
              selected?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

/**
 * Props for the {@link GtkGridView} compound component.
 *
 * Extends the shared list-view base props with item data and a
 * render callback for each grid cell.
 */
export type GridViewProps<T = unknown> = ListViewSharedProps &
    (
        | (ListViewControlledSelectionProps & {
              /** Data items to display in the grid */
              items?: ListItem<T>[];
              /** Function to render each grid item */
              renderItem: (item: T) => ReactNode;
              model?: never;
          })
        | {
              /**
               * Uncontrolled mode: hands the given `Gio.ListModel` straight to the widget. The
               * caller owns the model lifecycle and must wrap data in a `Gtk.SingleSelection` or
               * `Gtk.MultiSelection` so the widget receives a `Gtk.SelectionModel`.
               */
              model: Gio.ListModel;
              /** Function to render each grid item; receives the `GObject.Object` from the model. */
              renderItem: (item: UncontrolledItemType<T>) => ReactNode;
              items?: never;
              selected?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

/** @internal Sorting and virtualization props shared by both column-view modes. */
type ColumnViewSortProps = {
    /** ID of the currently sorted column, or null for no sorting */
    sortColumn?: string | null;
    /** Sort direction (ascending or descending) */
    sortOrder?: Gtk.SortType | null;
    /** Callback fired when the sort column or order changes */
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null;
    /** Estimated row height in pixels for virtualization */
    estimatedRowHeight?: number | null;
};

/**
 * Props for the `GtkColumnView` compound component.
 *
 * In controlled mode (default), provide `items` (and optionally `selected`, `selectionMode`,
 * `renderHeader`). In uncontrolled mode, provide a `model` instead — the caller wraps their
 * data in a `Gtk.SingleSelection`/`Gtk.MultiSelection` and the column view delegates
 * selection to it.
 */
export type ColumnViewProps<T = unknown, S = unknown> = ColumnViewSortProps &
    (
        | (ListViewControlledSelectionProps & {
              /** Data items to display in the column view */
              items?: ListItem<T, S>[];
              /** Function to render section headers when items contain section entries */
              renderHeader?: ((item: S) => ReactNode) | null;
              model?: never;
          })
        | {
              /**
               * Uncontrolled mode: hands the given `Gio.ListModel` straight to the widget. The
               * caller owns the model lifecycle and must wrap data in a `Gtk.SingleSelection` or
               * `Gtk.MultiSelection` so the widget receives a `Gtk.SelectionModel`.
               */
              model: Gio.ListModel;
              items?: never;
              renderHeader?: never;
              selected?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

/**
 * Props shared by single-selection dropdown widgets (GtkDropDown, AdwComboRow).
 */
export type DropDownProps<T = unknown, S = unknown> =
    | {
          /** Data items to display in the dropdown */
          items?: ListItem<T, S>[];
          /** ID of the currently selected item */
          selectedId?: string | null;
          /** Callback fired when the selected item changes */
          onSelectionChanged?: ((id: string) => void) | null;
          /** Function to render each item; used for both the button and the popup list unless overridden by `renderListItem`. */
          renderItem?: ((item: T) => ReactNode) | null;
          /** Function to render items in the popup list only, overriding `renderItem` for the list. */
          renderListItem?: ((item: T) => ReactNode) | null;
          /** Function to render section headers when items contain section entries */
          renderHeader?: ((item: S) => ReactNode) | null;
          model?: never;
      }
    | {
          /**
           * Uncontrolled mode: hands the given `Gio.ListModel` straight to the widget. The
           * caller owns the model lifecycle and reads the active selection from the widget
           * directly (`dropDown.getSelected()`).
           */
          model: Gio.ListModel;
          /** Function to render each item; receives the `GObject.Object` from the model. */
          renderItem?: ((item: UncontrolledItemType<T>) => ReactNode) | null;
          /** Function to render items in the popup list only, overriding `renderItem` for the list. */
          renderListItem?: ((item: UncontrolledItemType<T>) => ReactNode) | null;
          items?: never;
          selectedId?: never;
          onSelectionChanged?: never;
          renderHeader?: never;
      };

/**
 * The drag icon installed on a `GtkDragSource` through its `icon` object
 * prop, applied via `setIcon(paintable, hotX, hotY)`.
 */
export type DragSourceIcon = {
    /** Paintable to use as the drag icon */
    paintable: Gdk.Paintable;
    /** X offset of the hotspot within the drag icon (default: 0) */
    hotX?: number;
    /** Y offset of the hotspot within the drag icon (default: 0) */
    hotY?: number;
};

/**
 * One entry of a `<GMenu>`'s `items` data: a leaf item with a label and a
 * detailed action, a submenu carrying nested entries, or a section grouping
 * entries inline. `Gio.Menu` is a value-snapshot model, so the menu's content
 * is declared as plain data and rebuilt from it whenever `items` changes.
 */
export type MenuEntry = {
    /** The entry's display label, with an underscore marking its mnemonic. Optional for sections. */
    label?: string;
    /** The detailed action name a leaf entry triggers (e.g. `"win.about"`, `"app.open::doc1"`). */
    action?: string;
    /** Nested entries rendered as this entry's submenu. */
    submenu?: readonly MenuEntry[];
    /** Entries grouped as an inline section (with this entry's `label` as the section heading). */
    section?: readonly MenuEntry[];
};

/**
 * The `items` data prop of a `<GMenu>` element, mixed into its generated
 * `Props`. The menu's content is rebuilt from the entries whenever the array
 * changes.
 */
export type MenuItemsProps = {
    /** The menu's entries, in order. */
    items?: readonly MenuEntry[] | null;
};

/**
 * The `accels` prop of a `<GSimpleAction>` element, mixed into its generated
 * `Props`. Accelerators bind on the enclosing application under the action's
 * scope (`app.`, `win.`, or an action group's prefix).
 */
export type ActionAccelsProps = {
    /** Keyboard accelerator(s) bound on the enclosing application (e.g. `"<Control>q"`). */
    accels?: string | string[];
};

/**
 * The `prefix` prop of a `<GSimpleActionGroup>` element, mixed into its
 * generated `Props`. The `insertActionGroup` attach rule reads it when
 * installing the group on its host widget.
 */
export type ActionGroupPrefixProps = {
    /** The action-name prefix the group installs under on its host widget. */
    prefix?: string;
};

/**
 * Props for the `<GtkSizeGroup>` declarative wrapper.
 *
 * Groups widgets so they request the same amount of space. The wrapper is
 * transparent in the GTK tree: its children render as if they were direct
 * children of its parent. Widgets opt into the group by being wrapped in
 * `<GtkSizeGroup.Widget>` anywhere within the subtree.
 */
export type SizeGroupProps = {
    /** Dimensions along which grouped widgets request the same size */
    mode?: Gtk.SizeGroupMode;
    /** Subtree containing widgets to group (must include `<GtkSizeGroup.Widget>` markers) */
    children?: ReactNode;
};

/**
 * Props for the `<GtkSizeGroup.Widget>` per-widget marker.
 *
 * Wraps exactly one widget and registers it with the nearest ancestor
 * `<GtkSizeGroup>`. The marker itself is invisible in the GTK tree; the
 * wrapped widget attaches to the marker's grandparent.
 */
export type SizeGroupWidgetProps = {
    /** Single widget to add to the enclosing size group */
    children: ReactNode;
};

/**
 * Props for `<GtkConstraintLayout.Constraint>`.
 *
 * Declares one row in the constraint solver. `target` and `source` reference
 * ids registered by `<GtkConstraintLayout.Widget id="…">` wrappers
 * or `<GtkConstraintLayout.Guide id="…">` markers; either may be omitted or
 * set to `"super"` to mean the widget owning the layout. The underlying
 * `Gtk.Constraint` is immutable, so the reconciler re-creates it on every
 * prop change.
 */
export type ConstraintProps = {
    /** id of the constrained target (registered widget, guide, or `"super"` / omitted for the container) */
    target?: string;
    /** Attribute of the target the constraint sets */
    targetAttribute: Gtk.ConstraintAttribute;
    /** Comparison relation between target and source attributes (default `EQ`) */
    relation?: Gtk.ConstraintRelation;
    /** id of the constraint's source (registered widget, guide, or `"super"` / omitted for the container) */
    source?: string;
    /** Attribute of the source the constraint reads (default `NONE`) */
    sourceAttribute?: Gtk.ConstraintAttribute;
    /** Multiplier applied to the source attribute (default 1) */
    multiplier?: number;
    /** Constant added to the source attribute (default 0) */
    constant?: number;
    /** Strength of the constraint (default `REQUIRED`) */
    strength?: number;
};

/**
 * Props for `<GtkConstraintLayout.Guide>`.
 *
 * Adds a `Gtk.ConstraintGuide` to the layout. The `id` doubles as the guide's
 * internal name (settable via `Gtk.ConstraintGuide.setName`) and the lookup
 * key used by `<Constraint>` and `<Vfl>` markers.
 */
export type ConstraintGuideProps = {
    /** Identifier for the guide (sets `Gtk.ConstraintGuide.name` and registers in the layout target map) */
    id: string;
    /** Minimum width in pixels */
    minWidth?: number;
    /** Minimum height in pixels */
    minHeight?: number;
    /** Natural width in pixels */
    natWidth?: number;
    /** Natural height in pixels */
    natHeight?: number;
    /** Maximum width in pixels */
    maxWidth?: number;
    /** Maximum height in pixels */
    maxHeight?: number;
    /** Strength of the natural-size constraint (default `MEDIUM`) */
    strength?: Gtk.ConstraintStrength;
};

/**
 * Props for `<GtkConstraintLayout.Vfl>`.
 *
 * Wraps `Gtk.ConstraintLayout.addConstraintsFromDescription`. The marker builds
 * the `views` map automatically from `<GtkConstraintLayout.Widget>`
 * registrations plus any `<Guide>` ids on the same layout.
 */
export type ConstraintVflProps = {
    /** Visual Format Language lines to parse */
    lines: string[];
    /** Default horizontal spacing for `-` separators (default 0) */
    hspacing?: number;
    /** Default vertical spacing for `-` separators (default 0) */
    vspacing?: number;
};

/**
 * Props for `<GtkConstraintLayout.Widget>`.
 *
 * Wraps a single widget that participates in constraints. The wrapper is
 * transparent in the GTK tree — the wrapped widget attaches to the host
 * widget — and registers `id → widget` on the `<GtkConstraintLayout>` carried
 * by the host's `layoutManager` prop. `<Constraint>` and `<Vfl>` markers then
 * resolve `id` references against that registry.
 */
export type ConstraintLayoutWidgetProps = {
    /** Identifier used by Constraint/Vfl markers to reference this widget */
    id: string;
    /** Single widget to register with the enclosing constraint layout */
    children: ReactNode;
};

/**
 * Permissive prop bag for the internal wrapper sentinel element
 * (`"__GTKX_WRAPPER_NODE__"`). Every metadata wrapper renders this single
 * element, passing its concrete kind through `kind` and its metadata through the
 * remaining props. The publicly typed wrapper prop shapes (e.g. {@link SlotProps},
 * {@link StackPageProps}) are validated by the sugar components, which then pass
 * the values through to this element.
 */
export type WrapperNodeElementProps = {
    /** The wrapper kind name, e.g. `"Slot"` or `"StackPage"`. */
    kind: string;
    /** The wrapped subtree the wrapper attaches to its grandparent. */
    children?: ReactNode;
    [key: string]: unknown;
};

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                __GTKX_WRAPPER_NODE__: WrapperNodeElementProps;
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
