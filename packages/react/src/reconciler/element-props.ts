import type * as Gdk from "@gtkx/gi/gdk";
import type * as Gio from "@gtkx/gi/gio";
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

export interface GtkWidgetElementProps {
    controllers?: ReactNode | null | undefined;
    actionGroups?: ReactNode | null | undefined;
}

export interface GActionGroupElementProps {
    prefix?: string | null | undefined;
}

export interface GActionMapElementProps {
    actions?: ReactNode | null | undefined;
}

export interface GMenuElementProps {
    items?: MenuItem[] | null | undefined;
}

export interface GtkShortcutControllerElementProps {
    shortcuts?: ReactNode | null | undefined;
}

export interface GtkOverlayElementProps {
    overlays?: ReactNode | null | undefined;
}

export interface GtkConstraintLayoutElementProps {
    constraints?: ReactNode | null | undefined;
    guides?: ReactNode | null | undefined;
    vfl?: VflConstraints[] | null | undefined;
}

export interface GtkHeaderBarElementProps {
    start?: ReactNode | null | undefined;
    end?: ReactNode | null | undefined;
}

export interface GtkScaleElementProps {
    marks?: ScaleMark[] | null | undefined;
}

export interface GtkCalendarElementProps {
    markedDays?: number[] | null | undefined;
}

export interface GtkLevelBarElementProps {
    offsets?: LevelBarOffset[] | null | undefined;
}

export interface GtkSizeGroupElementProps {
    widgets?: Gtk.Widget[] | null | undefined;
}

export interface GtkAboutDialogElementProps {
    creditSections?: CreditSection[] | null | undefined;
}

export interface GtkApplicationElementProps {
    actionAccels?: ActionAccel[] | null | undefined;
}

export interface GtkDropTargetElementProps {
    types?: GObject.Type[] | null | undefined;
}

export interface GtkDrawingAreaElementProps {
    drawFunc?: Gtk.DrawingAreaDrawFunc | null | undefined;
}

export interface GtkDragSourceElementProps {
    icon?: DragSourceIcon | null | undefined;
}

export type { Gio };
