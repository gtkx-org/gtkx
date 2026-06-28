import type * as Gdk from "@gtkx/gi/gdk";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gsk from "@gtkx/gi/gsk";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";

export type TextAnchorProps = {
    replacementChar?: string;
    children?: ReactNode;
};

export type TextPaintableProps = {
    paintable: Gdk.Paintable;
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

export type DropTargetType = GObject.Type;

export type CreditSection = {
    name: string;
    people: string[];
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

export type RelationshipNodeElementProps = {
    kind: string;
    children?: ReactNode;
    [key: string]: unknown;
};

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

export type SyntheticPropsFor<K extends string> = UnionToIntersection<
    K extends keyof SyntheticProps ? SyntheticProps[K] : never
>;

declare global {
    namespace React {
        namespace JSX {
            interface IntrinsicElements {
                __GTKX_RELATIONSHIP_NODE__: RelationshipNodeElementProps;
            }
        }
    }
}
