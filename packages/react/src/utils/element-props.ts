import type * as Gdk from "@gtkx/gi/gdk";
import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type { GType } from "@gtkx/gi/gobject";
import type * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import type * as Pango from "@gtkx/gi/pango";
import type { ReactNode } from "react";

/** Props for a child anchor inside a `Gtk.TextView`, optionally overriding the replacement character. */
export type TextAnchorProps = {
    replacementChar?: string;
    children?: ReactNode;
};

/** Props for embedding a paintable into a text buffer. */
export type TextPaintableProps = {
    paintable: Gdk.Paintable;
};

/** Props for a `Gtk.TextTag` applied to a span of buffer text. */
export type TextTagProps = {
    id: string;
    priority?: number;
    background?: string;
    backgroundFullHeight?: boolean;
    foreground?: string;
    family?: string;
    font?: string;
    sizePoints?: number;
    size?: number;
    scale?: number;
    weight?: Pango.Weight | (number & {});
    style?: Pango.Style;
    stretch?: Pango.Stretch;
    variant?: Pango.Variant;
    strikethrough?: boolean;
    underline?: Pango.Underline;
    overline?: Pango.Overline;
    rise?: number;
    letterSpacing?: number;
    lineHeight?: number;
    leftMargin?: number;
    rightMargin?: number;
    indent?: number;
    pixelsAboveLines?: number;
    pixelsBelowLines?: number;
    pixelsInsideWrap?: number;
    justification?: Gtk.Justification;
    direction?: Gtk.TextDirection;
    wrapMode?: Gtk.WrapMode;
    editable?: boolean;
    invisible?: boolean;
    allowBreaks?: boolean;
    insertHyphens?: boolean;
    fallback?: boolean;
    accumulativeMargin?: boolean;
    paragraphBackground?: string;
    showSpaces?: Pango.ShowFlags;
    textTransform?: Pango.TextTransform;
    fontFeatures?: string;
    language?: string;
    children?: ReactNode;
};

/** A single mark on a `Gtk.Scale`, with its value, position, and optional label. */
export type ScaleMark = {
    value: number;
    position?: Gtk.PositionType;
    label?: string | null;
};

/** A named offset threshold on a `Gtk.LevelBar`. */
export type LevelBarOffset = {
    id: string;
    value: number;
};

/** A day number marked on a `Gtk.Calendar`. */
export type CalendarMark = number;

/** An action name paired with its keyboard accelerators. */
export type ActionAccel = {
    action: string;
    accels: string[];
};

/** A `GType` accepted as a drop target type. */
export type DropTargetType = GType;

/** A named section of credited people for an about dialog. */
export type CreditSection = {
    name: string;
    people: string[];
};

/** Props for a named slot wrapper that fills a single object-valued property of its parent. */
export type SlotProps = {
    id?: string;
    children?: ReactNode;
};

/** Props for a container-prop wrapper that contributes children through a parent add method. */
export type ContainerPropProps = {
    id: string;
    children?: ReactNode;
};

/**
 * A list model item: either a value row (optionally with nested children) or a section header.
 *
 * @typeParam T - The value type of a regular item.
 * @typeParam S - The value type of a section header.
 */
export type ListItem<T = unknown, S = unknown> =
    | {
          id: string;
          value: T;
          section?: false | undefined;
          children?: ListItem<T, S>[] | undefined;
          hideExpander?: boolean | undefined;
          indentForDepth?: boolean | undefined;
          indentForIcon?: boolean | undefined;
      }
    | {
          id: string;
          value: S;
          section: true;
          children: ListItem<T, S>[];
      };

/** Props positioning a child within a `Gtk.Grid` or `Gtk.GridLayout`. */
export type GridChildProps = {
    children?: ReactNode;
    column?: number | undefined;
    row?: number | undefined;
    columnSpan?: number | undefined;
    rowSpan?: number | undefined;
};

/** Props positioning a child within a `Gtk.Fixed` or `Gtk.FixedLayout`. */
export type FixedChildProps = {
    children?: ReactNode;
    x?: number | undefined;
    y?: number | undefined;
    transform?: Gsk.Transform | undefined;
};

/**
 * Props for a `Gtk.ColumnViewColumn`, including its cell renderer.
 *
 * @typeParam T - The value type of the rows rendered in the column.
 */
export type ColumnViewColumnProps<T = unknown> = {
    title: string;
    expand?: boolean | undefined;
    resizable?: boolean | undefined;
    fixedWidth?: number | undefined;
    id: string;
    sortable?: boolean | undefined;
    visible?: boolean | undefined;
    renderCell: (item: T) => ReactNode;
    headerMenu?: ReactNode;
};

/** Props for a `Gtk.Notebook` page, including its tab label and tab packing flags. */
export type NotebookPageProps = {
    children?: ReactNode;
    label?: string | undefined;
    tabLabel?: ReactNode;
    tabExpand?: boolean | undefined;
    tabFill?: boolean | undefined;
};

/** Props for a `Gtk.Stack`/`Adw.ViewStack` page, including its id, title, and icon. */
export type StackPageProps = {
    children?: ReactNode;
    id?: string | undefined;
    title?: string | undefined;
    iconName?: string | undefined;
    needsAttention?: boolean | undefined;
    visible?: boolean | undefined;
    useUnderline?: boolean | undefined;
    badgeNumber?: number | undefined;
};

/** Props for a child placed in the overlay layer of a `Gtk.Overlay`. */
export type OverlayChildProps = {
    children?: ReactNode;
    measure?: boolean | undefined;
    clipOverlay?: boolean | undefined;
};

/** Props for a response button on an `Adw.AlertDialog`. */
export type AlertDialogResponseProps = {
    id: string;
    label: string;
    appearance?: 0 | 1 | 2 | undefined;
    enabled?: boolean | undefined;
};

type ListViewSharedProps = {
    estimatedItemHeight?: number | undefined;
    estimatedItemWidth?: number | undefined;
};

type ListViewControlledSelectionProps = {
    selected?: string[] | null | undefined;
    onSelectionChanged?: ((ids: string[]) => void) | null | undefined;
    selectionMode?: Gtk.SelectionMode | null | undefined;
};

type UncontrolledItemType<T> = [T] extends [GObject.Object] ? T : GObject.Object;

/**
 * Props for a `Gtk.ListView`, either controlled via `items` or driven by an external model.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export type ListViewProps<T = unknown, S = unknown> = ListViewSharedProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ListItem<T, S>[] | undefined;
              renderItem: (item: T, row?: Gtk.TreeListRow | null) => ReactNode;
              autoexpand?: boolean | undefined;
              renderHeader?: ((item: S) => ReactNode) | null | undefined;
              model?: never;
          })
        | {
              model: Gio.ListModel;
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
 * Props for a `Gtk.GridView`, either controlled via `items` or driven by an external model.
 *
 * @typeParam T - The value type of the grid items.
 */
export type GridViewProps<T = unknown> = ListViewSharedProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ListItem<T>[] | undefined;
              renderItem: (item: T) => ReactNode;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              renderItem: (item: UncontrolledItemType<T>) => ReactNode;
              items?: never;
              selected?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

type ColumnViewSortProps = {
    sortColumn?: string | null | undefined;
    sortOrder?: Gtk.SortType | null | undefined;
    onSortChanged?: ((column: string | null, order: Gtk.SortType) => void) | null | undefined;
    estimatedRowHeight?: number | null | undefined;
};

/**
 * Props for a `Gtk.ColumnView`, either controlled via `items` or driven by an external model.
 *
 * @typeParam T - The value type of regular rows.
 * @typeParam S - The value type of section headers.
 */
export type ColumnViewProps<T = unknown, S = unknown> = ColumnViewSortProps &
    (
        | (ListViewControlledSelectionProps & {
              items?: ListItem<T, S>[] | undefined;
              renderHeader?: ((item: S) => ReactNode) | null | undefined;
              model?: never;
          })
        | {
              model: Gio.ListModel;
              items?: never;
              renderHeader?: never;
              selected?: never;
              onSelectionChanged?: never;
              selectionMode?: never;
          }
    );

/**
 * Props for an `Adw.ComboRow`/`Gtk.DropDown`, either controlled via `items` or driven by a model.
 *
 * @typeParam T - The value type of regular items.
 * @typeParam S - The value type of section headers.
 */
export type DropDownProps<T = unknown, S = unknown> =
    | {
          items?: ListItem<T, S>[] | undefined;
          selectedId?: string | null | undefined;
          onSelectionChanged?: ((id: string) => void) | null | undefined;
          renderItem?: ((item: T) => ReactNode) | null | undefined;
          renderListItem?: ((item: T) => ReactNode) | null | undefined;
          renderHeader?: ((item: S) => ReactNode) | null | undefined;
          model?: never;
      }
    | {
          model: Gio.ListModel;
          renderItem?: ((item: UncontrolledItemType<T>) => ReactNode) | null | undefined;
          renderListItem?: ((item: UncontrolledItemType<T>) => ReactNode) | null | undefined;
          items?: never;
          selectedId?: never;
          onSelectionChanged?: never;
          renderHeader?: never;
      };

/** The drag icon for a `Gtk.DragSource`, with its paintable and hotspot offsets. */
export type DragSourceIcon = {
    paintable: Gdk.Paintable;
    hotX?: number | undefined;
    hotY?: number | undefined;
};

/** A menu entry: an item, a submenu, or a section, used to build a `Gio.Menu` tree. */
export type MenuEntry = {
    label?: string | undefined;
    action?: string | undefined;
    submenu?: MenuEntry[] | undefined;
    section?: MenuEntry[] | undefined;
};

/** Props supplying the declarative menu entries of a menu. */
export type MenuItemsProps = {
    items?: MenuEntry[] | null | undefined;
};

/** Props supplying the action-group prefix applied to descendant actions. */
export type ActionGroupPrefixProps = {
    prefix?: string | undefined;
};

/** Props for a single constraint within a `Gtk.ConstraintLayout`. */
export type ConstraintProps = {
    target?: string;
    targetAttribute: Gtk.ConstraintAttribute;
    relation?: Gtk.ConstraintRelation;
    source?: string;
    sourceAttribute?: Gtk.ConstraintAttribute;
    multiplier?: number;
    constant?: number;
    strength?: number;
};

/** Props for a guide (flexible spacer) within a `Gtk.ConstraintLayout`. */
export type ConstraintGuideProps = {
    id: string;
    minWidth?: number;
    minHeight?: number;
    natWidth?: number;
    natHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    strength?: Gtk.ConstraintStrength;
};

/** Props for a Visual Format Language batch of constraints within a `Gtk.ConstraintLayout`. */
export type ConstraintVflProps = {
    lines: string[];
    hspacing?: number;
    vspacing?: number;
};

/** Props for the internal reconciler wrapper element identified by its `kind` discriminator. */
export type WrapperNodeElementProps = {
    kind: string;
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

/** Accessibility props mapping to GTK accessible properties, states, and relations. */
export type AccessibleProps = {
    accessibleAutocomplete?: Gtk.AccessibleAutocomplete | undefined;
    accessibleDescription?: string | undefined;
    accessibleHasPopup?: boolean | undefined;
    accessibleKeyShortcuts?: string | undefined;
    accessibleLabel?: string | undefined;
    accessibleLevel?: number | undefined;
    accessibleModal?: boolean | undefined;
    accessibleMultiLine?: boolean | undefined;
    accessibleMultiSelectable?: boolean | undefined;
    accessibleOrientation?: Gtk.Orientation | undefined;
    accessiblePlaceholder?: string | undefined;
    accessibleReadOnly?: boolean | undefined;
    accessibleRequired?: boolean | undefined;
    accessibleRoleDescription?: string | undefined;
    accessibleSort?: Gtk.AccessibleSort | undefined;
    accessibleValueMax?: number | undefined;
    accessibleValueMin?: number | undefined;
    accessibleValueNow?: number | undefined;
    accessibleValueText?: string | undefined;
    accessibleHelpText?: string | undefined;

    accessibleBusy?: boolean | undefined;
    accessibleChecked?: Gtk.AccessibleTristate | undefined;
    accessibleDisabled?: boolean | undefined;
    accessibleExpanded?: boolean | undefined;
    accessibleHidden?: boolean | undefined;
    accessibleInvalid?: Gtk.AccessibleInvalidState | undefined;
    accessiblePressed?: Gtk.AccessibleTristate | undefined;
    accessibleSelected?: boolean | undefined;
    accessibleVisited?: boolean | undefined;

    accessibleActiveDescendant?: Gtk.Widget | undefined;
    accessibleColCount?: number | undefined;
    accessibleColIndex?: number | undefined;
    accessibleColIndexText?: string | undefined;
    accessibleColSpan?: number | undefined;
    accessibleControls?: Gtk.Widget[] | undefined;
    accessibleDescribedBy?: Gtk.Widget[] | undefined;
    accessibleDetails?: Gtk.Widget[] | undefined;
    accessibleErrorMessage?: Gtk.Widget[] | undefined;
    accessibleFlowTo?: Gtk.Widget[] | undefined;
    accessibleLabelledBy?: Gtk.Widget[] | undefined;
    accessibleOwns?: Gtk.Widget[] | undefined;
    accessiblePosInSet?: number | undefined;
    accessibleRowCount?: number | undefined;
    accessibleRowIndex?: number | undefined;
    accessibleRowIndexText?: string | undefined;
    accessibleRowSpan?: number | undefined;
    accessibleSetSize?: number | undefined;
};
