import type * as Gdk from "@gtkx/gi/gdk";
import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type { GType } from "@gtkx/gi/gobject";
import type * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import type * as Pango from "@gtkx/gi/pango";
import type { ReactNode } from "react";

export type TextAnchorProps = {
    replacementChar?: string;
    children?: ReactNode;
};

export type TextPaintableProps = {
    paintable: Gdk.Paintable;
};

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

export type ScaleMark = {
    value: number;
    position?: Gtk.PositionType;
    label?: string | null;
};

export type LevelBarOffset = {
    id: string;
    value: number;
};

export type CalendarMark = number;

export type ActionAccel = {
    action: string;
    accels: string[];
};

export type DropTargetType = GType;

export type CreditSection = {
    name: string;
    people: string[];
};

export type SlotProps = {
    id?: string;
    children?: ReactNode;
};

export type ContainerPropProps = {
    id: string;
    children?: ReactNode;
};

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

export type GridChildProps = {
    children?: ReactNode;
    column?: number | undefined;
    row?: number | undefined;
    columnSpan?: number | undefined;
    rowSpan?: number | undefined;
};

export type FixedChildProps = {
    children?: ReactNode;
    x?: number | undefined;
    y?: number | undefined;
    transform?: Gsk.Transform | undefined;
};

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

export type NotebookPageProps = {
    children?: ReactNode;
    label?: string | undefined;
    tabLabel?: ReactNode;
    tabExpand?: boolean | undefined;
    tabFill?: boolean | undefined;
};

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

export type OverlayChildProps = {
    children?: ReactNode;
    measure?: boolean | undefined;
    clipOverlay?: boolean | undefined;
};

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

export type DragSourceIcon = {
    paintable: Gdk.Paintable;
    hotX?: number | undefined;
    hotY?: number | undefined;
};

export type MenuEntry = {
    label?: string | undefined;
    action?: string | undefined;
    submenu?: MenuEntry[] | undefined;
    section?: MenuEntry[] | undefined;
};

export type MenuItemsProps = {
    items?: MenuEntry[] | null | undefined;
};

export type ActionGroupPrefixProps = {
    prefix?: string | undefined;
};

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

export type ConstraintVflProps = {
    lines: string[];
    hspacing?: number;
    vspacing?: number;
};

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
