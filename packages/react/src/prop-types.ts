import type * as Gdk from "@gtkx/gi/gdk";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";

/** One entry of a `GMenu`'s `items` prop; `submenu` and `section` nest further menus. */
type MenuItem = {
    label?: string | null;
    action?: string | null;
    submenu?: MenuItem[];
    section?: MenuItem[];
};

/** One Visual Format Language block applied to a `Gtk.ConstraintLayout`. */
type VflConstraints = {
    lines: string[];
    hspacing?: number;
    vspacing?: number;
    views?: Map<string, Gtk.ConstraintTarget>;
};

/** One mark on a `Gtk.Scale`. */
type ScaleMark = { value?: number; position: Gtk.PositionType; markup?: string | null };
/** One labelled offset on a `Gtk.LevelBar`. */
type LevelBarOffset = { name: string; value?: number };
/** One credit section on a `Gtk.AboutDialog`. */
type CreditSection = { sectionName: string; people: string[] };
/** One accelerator binding on a `Gtk.Application`. */
type ActionAccel = { detailedActionName: string; accels: string[] };
/** The drag icon of a `Gtk.DragSource`, with its hotspot. */
type DragSourceIcon = { paintable?: Gdk.Paintable | null; hotX?: number; hotY?: number };

/** Props of an element that accepts children. */
type ChildrenProps = {
    children?: ReactNode;
};

type GtkWidgetProps = {
    controllers?: ReactNode | null | undefined;
    actionGroups?: ReactNode | null | undefined;
} & ChildrenProps;

type GActionGroupProps = {
    prefix?: string | null | undefined;
};

type GActionMapProps = {
    actions?: ReactNode | null | undefined;
};

type GMenuProps = {
    items?: MenuItem[] | null | undefined;
};

type GtkShortcutControllerProps = {
    shortcuts?: ReactNode | null | undefined;
};

type GtkOverlayProps = {
    overlays?: ReactNode | null | undefined;
} & ChildrenProps;

type GtkConstraintLayoutProps = {
    constraints?: ReactNode | null | undefined;
    guides?: ReactNode | null | undefined;
    vfl?: VflConstraints[] | null | undefined;
};

type GtkHeaderBarProps = {
    start?: ReactNode | null | undefined;
    end?: ReactNode | null | undefined;
};

type GtkScaleProps = {
    marks?: ScaleMark[] | null | undefined;
};

type GtkCalendarProps = {
    markedDays?: number[] | null | undefined;
};

type GtkLevelBarProps = {
    offsets?: LevelBarOffset[] | null | undefined;
};

type GtkSizeGroupProps = {
    widgets?: Gtk.Widget[] | null | undefined;
};

type GtkAboutDialogProps = {
    creditSections?: CreditSection[] | null | undefined;
};

type GtkApplicationProps = {
    actionAccels?: ActionAccel[] | null | undefined;
} & ChildrenProps;

type GtkDropTargetProps = {
    types?: GObject.Type[] | null | undefined;
};

type GtkDrawingAreaProps = {
    drawFunc?: Gtk.DrawingAreaDrawFunc | null | undefined;
};

type GtkDragSourceProps = {
    icon?: DragSourceIcon | null | undefined;
};

export {
    type MenuItem,
    type VflConstraints,
    type ScaleMark,
    type LevelBarOffset,
    type CreditSection,
    type ActionAccel,
    type DragSourceIcon,
    type ChildrenProps,
    type GtkWidgetProps,
    type GActionGroupProps,
    type GActionMapProps,
    type GMenuProps,
    type GtkShortcutControllerProps,
    type GtkOverlayProps,
    type GtkConstraintLayoutProps,
    type GtkHeaderBarProps,
    type GtkScaleProps,
    type GtkCalendarProps,
    type GtkLevelBarProps,
    type GtkSizeGroupProps,
    type GtkAboutDialogProps,
    type GtkApplicationProps,
    type GtkDropTargetProps,
    type GtkDrawingAreaProps,
    type GtkDragSourceProps,
};
