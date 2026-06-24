import type * as Gdk from "@gtkx/gi/gdk";
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

export type ContainerSlotProps = {
    id: string;
    children?: ReactNode;
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

export type DragSourceIcon = {
    paintable: Gdk.Paintable;
    hotX?: number | undefined;
    hotY?: number | undefined;
};

export type ActionGroupPrefixProps = {
    prefix?: string | undefined;
};

export type WrapperNodeElementProps = {
    kind: string;
    children?: ReactNode;
    [key: string]: unknown;
};

/**
 * The synthetic JSX props of each widget that has no backing GObject property,
 * keyed by GLib type name. These props are applied by the reconciler rules
 * rather than by GObject, so they cannot be derived from GIR. `@gtkx/codegen`
 * composes the matching entry onto each widget's element component through
 * {@link SyntheticPropsFor}, leaving the generated `<Glib>Props` interface pure
 * GIR. Augment this interface to type synthetic props for further widgets.
 */
export interface SyntheticProps {
    GSimpleActionGroup: { prefix?: string | null | undefined };
    GtkApplication: { actionAccels?: ActionAccel[] | null | undefined };
    GtkSizeGroup: { widgets?: Gtk.Widget[] | null | undefined };
    GtkScale: { marks?: ScaleMark[] | null | undefined };
    GtkLevelBar: { offsets?: LevelBarOffset[] | null | undefined };
    GtkCalendar: { markedDays?: CalendarMark[] | null | undefined };
    GtkDropTarget: { types?: DropTargetType[] | null | undefined };
    GtkAboutDialog: { creditSections?: CreditSection[] | null | undefined };
    GtkDragSource: { icon?: DragSourceIcon | null | undefined };
    GtkDrawingArea: { drawFunc?: Gtk.DrawingAreaDrawFunc | null | undefined };
    AdwAlertDialog: { responses?: AlertDialogResponseProps[] | null | undefined };
}

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void
    ? I
    : never;

/**
 * Resolves the synthetic JSX props `@gtkx/codegen` composes onto an element
 * component. `K` is the union of the widget's GLib type name and its ancestor
 * type names, mirroring how the reconciler resolves rules by GType ancestry: it
 * intersects every synthetic entry any of those types contribute, resolving to
 * `unknown` (a no-op in an intersection) when none do.
 */
export type SyntheticPropsFor<K extends string> = UnionToIntersection<
    K extends keyof SyntheticProps ? SyntheticProps[K] : never
>;

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
