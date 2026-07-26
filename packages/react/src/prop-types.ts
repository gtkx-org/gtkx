import type * as Gdk from "@gtkx/gi/gdk";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { ReactNode } from "react";

/** One entry of a `GMenu`'s `items` prop; `submenu` and `section` nest further menus. */
export type MenuItem = {
    label?: string | null;
    action?: string | null;
    submenu?: MenuItem[];
    section?: MenuItem[];
};

/** One Visual Format Language block applied to a `Gtk.ConstraintLayout`. */
export type VflConstraints = {
    lines: string[];
    hspacing?: number;
    vspacing?: number;
    views?: Map<string, Gtk.ConstraintTarget>;
};

/** One mark on a `Gtk.Scale`. */
export type ScaleMark = { value?: number; position: Gtk.PositionType; markup?: string | null };

/** One labelled offset on a `Gtk.LevelBar`. */
export type LevelBarOffset = { name: string; value?: number };

/** One credit section on a `Gtk.AboutDialog`. */
export type CreditSection = { sectionName: string; people: string[] };

/** One accelerator binding on a `Gtk.Application`. */
export type ActionAccel = { detailedActionName: string; accels: string[] };

/** The drag icon of a `Gtk.DragSource`, with its hotspot. */
export type DragSourceIcon = { paintable?: Gdk.Paintable | null; hotX?: number; hotY?: number };

/** Props of an element that accepts children. */
export type ChildrenProps = {
    children?: ReactNode;
};

export type GtkWidgetProps = {
    controllers?: ReactNode | null | undefined;
    actionGroups?: ReactNode | null | undefined;
} & ChildrenProps;

export type GActionGroupProps = {
    prefix?: string | null | undefined;
};

export type GActionMapProps = {
    actions?: ReactNode | null | undefined;
};

export type GMenuProps = {
    items?: MenuItem[] | null | undefined;
};

export type GtkShortcutControllerProps = {
    shortcuts?: ReactNode | null | undefined;
};

export type GtkOverlayProps = {
    overlays?: ReactNode | null | undefined;
} & ChildrenProps;

export type GtkConstraintLayoutProps = {
    constraints?: ReactNode | null | undefined;
    guides?: ReactNode | null | undefined;
    vfl?: VflConstraints[] | null | undefined;
};

export type GtkHeaderBarProps = {
    start?: ReactNode | null | undefined;
    end?: ReactNode | null | undefined;
};

export type GtkScaleProps = {
    marks?: ScaleMark[] | null | undefined;
};

export type GtkCalendarProps = {
    markedDays?: number[] | null | undefined;
};

export type GtkLevelBarProps = {
    offsets?: LevelBarOffset[] | null | undefined;
};

export type GtkSizeGroupProps = {
    widgets?: Gtk.Widget[] | null | undefined;
};

export type GtkAboutDialogProps = {
    creditSections?: CreditSection[] | null | undefined;
};

export type GtkApplicationProps = {
    actionAccels?: ActionAccel[] | null | undefined;
} & ChildrenProps;

export type GtkDropTargetProps = {
    types?: GObject.Type[] | null | undefined;
};

export type GtkDrawingAreaProps = {
    drawFunc?: Gtk.DrawingAreaDrawFunc | null | undefined;
};

export type GtkDragSourceProps = {
    icon?: DragSourceIcon | null | undefined;
};
