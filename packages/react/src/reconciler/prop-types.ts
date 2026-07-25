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
export interface ChildrenProps {
    children?: ReactNode;
}

export interface GtkWidgetProps extends ChildrenProps {
    controllers?: ReactNode | null | undefined;
    actionGroups?: ReactNode | null | undefined;
}

export interface GActionGroupProps {
    prefix?: string | null | undefined;
}

export interface GActionMapProps {
    actions?: ReactNode | null | undefined;
}

export interface GMenuProps {
    items?: MenuItem[] | null | undefined;
}

export interface GtkShortcutControllerProps {
    shortcuts?: ReactNode | null | undefined;
}

export interface GtkOverlayProps extends ChildrenProps {
    overlays?: ReactNode | null | undefined;
}

export interface GtkConstraintLayoutProps {
    constraints?: ReactNode | null | undefined;
    guides?: ReactNode | null | undefined;
    vfl?: VflConstraints[] | null | undefined;
}

export interface GtkHeaderBarProps {
    start?: ReactNode | null | undefined;
    end?: ReactNode | null | undefined;
}

export interface GtkScaleProps {
    marks?: ScaleMark[] | null | undefined;
}

export interface GtkCalendarProps {
    markedDays?: number[] | null | undefined;
}

export interface GtkLevelBarProps {
    offsets?: LevelBarOffset[] | null | undefined;
}

export interface GtkSizeGroupProps {
    widgets?: Gtk.Widget[] | null | undefined;
}

export interface GtkAboutDialogProps {
    creditSections?: CreditSection[] | null | undefined;
}

export interface GtkApplicationProps extends ChildrenProps {
    actionAccels?: ActionAccel[] | null | undefined;
}

export interface GtkDropTargetProps {
    types?: GObject.Type[] | null | undefined;
}

export interface GtkDrawingAreaProps {
    drawFunc?: Gtk.DrawingAreaDrawFunc | null | undefined;
}

export interface GtkDragSourceProps {
    icon?: DragSourceIcon | null | undefined;
}

export type GtkActionBarProps = GtkHeaderBarProps;

export type GtkAspectFrameProps = ChildrenProps;
export type GtkButtonProps = ChildrenProps;
export type GtkCheckButtonProps = ChildrenProps;
export type GtkComboBoxProps = ChildrenProps;
export type GtkDragIconProps = ChildrenProps;
export type GtkExpanderProps = ChildrenProps;
export type GtkFlowBoxChildProps = ChildrenProps;
export type GtkFrameProps = ChildrenProps;
export type GtkGraphicsOffloadProps = ChildrenProps;
export type GtkListBoxRowProps = ChildrenProps;
export type GtkListHeaderProps = ChildrenProps;
export type GtkListItemProps = ChildrenProps;
export type GtkMenuButtonProps = ChildrenProps;
export type GtkPopoverProps = ChildrenProps;
export type GtkPopoverBinProps = ChildrenProps;
export type GtkRevealerProps = ChildrenProps;
export type GtkScrolledWindowProps = ChildrenProps;
export type GtkSearchBarProps = ChildrenProps;
export type GtkTreeExpanderProps = ChildrenProps;
export type GtkViewportProps = ChildrenProps;
export type GtkWindowProps = ChildrenProps;
export type GtkWindowHandleProps = ChildrenProps;
export type GtkBoxProps = ChildrenProps;
export type GtkColumnViewProps = ChildrenProps;
export type GtkFixedProps = ChildrenProps;
export type GtkFlowBoxProps = ChildrenProps;
export type GtkGridProps = ChildrenProps;
export type GtkListBoxProps = ChildrenProps;
export type GtkNotebookProps = ChildrenProps;
export type GtkStackProps = ChildrenProps;
export type GtkTextViewProps = ChildrenProps;
export type GtkLabelProps = ChildrenProps;
export type GtkTextBufferProps = ChildrenProps;
export type GtkTextTagProps = ChildrenProps;
export type GtkTextChildAnchorProps = ChildrenProps;
