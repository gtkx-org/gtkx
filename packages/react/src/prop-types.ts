/* eslint-disable gtkx/no-library-prefix */
import type * as Gdk from "@gtkx/gi/gdk";
import type * as GLib from "@gtkx/gi/glib";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { CSSProperties, ReactNode } from "react";

/** One entry of a `GMenu`'s `items` prop; `submenu` and `section` nest further menus. */
type MenuItem = {
    /** Text shown for the entry, or the heading of the submenu or section it introduces. */
    label?: string | null;
    /** Detailed action name the entry activates, ignored when `submenu` or `section` is given. */
    action?: string | null;
    /** Entries of a separate menu the labelled entry opens. */
    submenu?: MenuItem[];
    /** Entries appended below the label as an inline section, used only when `submenu` is absent. */
    section?: MenuItem[];
};

/** One Visual Format Language block applied to a `Gtk.ConstraintLayout`. */
type VflConstraints = {
    /** Format lines, each describing every constraint on one row or column. */
    lines: string[];
    /** Default horizontal spacing the `-` operator stands for; defaults to 0. */
    hspacing?: number;
    /** Default vertical spacing the `-` operator stands for; defaults to 0. */
    vspacing?: number;
    /** Targets the view names in `lines` refer to; defaults to none. */
    views?: Map<string, Gtk.ConstraintTarget>;
};

/** One mark on a `Gtk.Scale`. */
type ScaleMark = {
    /** Point on the scale the mark is drawn at; defaults to 0. */
    value?: number;
    /** Side of the scale the mark and its label sit on. */
    position: Gtk.PositionType;
    /** Pango markup drawn beside the mark, or `null` for an unlabelled one. */
    markup?: string | null;
};

/** One labelled offset on a `Gtk.LevelBar`. */
type LevelBarOffset = {
    /** Style class applied to the bar's blocks while the value falls in this offset's interval. */
    name: string;
    /** Upper bound of that interval; defaults to 0. */
    value?: number;
};

/** One credit section on a `Gtk.AboutDialog`. */
type CreditSection = {
    /** Heading the names are listed under. */
    sectionName: string;
    /** Names listed in the section. */
    people: string[];
};

/** One command-line option a `Gtk.Application` accepts. */
type MainOption = {
    /** Name the option is spelled with after two dashes, such as `verbose` for `--verbose`. */
    longName: string;
    /** Single character the option is spelled with after one dash, such as `v` for `-v`; defaults to none. */
    shortName?: string | null;
    /** How the option itself is parsed and listed; defaults to `GLib.OptionFlags.NONE`. */
    flags?: GLib.OptionFlags;
    /** Type of argument the option takes; defaults to `GLib.OptionArg.NONE`, meaning it takes none. */
    arg?: GLib.OptionArg;
    /** Text describing the option in `--help`. */
    description: string;
    /** Placeholder standing for the option's argument in `--help`; defaults to none. */
    argDescription?: string | null;
};

/** One accelerator binding on a `Gtk.Application`. */
type ActionAccel = {
    /** Action the accelerators activate, such as `app.quit` or `win.open('file')`. */
    detailedActionName: string;
    /** Accelerators in `Gtk.acceleratorParse` syntax, cleared when the entry goes away. */
    accels: string[];
};

/** The drag icon of a `Gtk.DragSource`, with its hotspot. */
type DragSourceIcon = {
    /** Image shown under the pointer during the drag; defaults to none. */
    paintable?: Gdk.Paintable | null;
    /** Horizontal offset of the pointer within the image; defaults to 0. */
    hotX?: number;
    /** Vertical offset of the pointer within the image; defaults to 0. */
    hotY?: number;
};

/** Props of an element that accepts children. */
type ChildrenProps = {
    /** Elements attached to the element's default child slot, or its text for elements that hold text. */
    children?: ReactNode;
};

/** Paint and typography declarations GTK4 CSS accepts, spelled the way React DOM spells them. */
type StyleProperties = Pick<
    CSSProperties,
    | "animation" |
    "animationDelay" |
    "animationDirection" |
    "animationDuration" |
    "animationFillMode" |
    "animationIterationCount" |
    "animationName" |
    "animationPlayState" |
    "animationTimingFunction" |
    "background" |
    "backgroundClip" |
    "backgroundColor" |
    "backgroundImage" |
    "backgroundOrigin" |
    "backgroundPosition" |
    "backgroundRepeat" |
    "backgroundSize" |
    "border" |
    "borderBottom" |
    "borderColor" |
    "borderLeft" |
    "borderRadius" |
    "borderRight" |
    "borderStyle" |
    "borderTop" |
    "borderWidth" |
    "boxShadow" |
    "caretColor" |
    "color" |
    "filter" |
    "font" |
    "fontFamily" |
    "fontSize" |
    "fontStyle" |
    "fontVariant" |
    "fontWeight" |
    "letterSpacing" |
    "lineHeight" |
    "margin" |
    "marginBottom" |
    "marginLeft" |
    "marginRight" |
    "marginTop" |
    "minHeight" |
    "minWidth" |
    "opacity" |
    "outline" |
    "outlineColor" |
    "outlineOffset" |
    "outlineStyle" |
    "outlineWidth" |
    "padding" |
    "paddingBottom" |
    "paddingLeft" |
    "paddingRight" |
    "paddingTop" |
    "textDecoration" |
    "textDecorationColor" |
    "textDecorationLine" |
    "textDecorationStyle" |
    "textShadow" |
    "textTransform" |
    "transform" |
    "transformOrigin" |
    "transition" |
    "transitionDelay" |
    "transitionDuration" |
    "transitionProperty" |
    "transitionTimingFunction"
>;

/**
 * Style declarations for one widget. A key starting with `&` nests a block under a selector derived from
 * it, such as `"&:hover"` or `"& label"`. GTK4 CSS covers paint and typography only, so layout properties
 * such as `display`, `width` and `gap` are deliberately absent; use the widget's own layout props instead.
 */
type Style = StyleProperties & Partial<Record<`&${string}`, StyleProperties>>;

/** Objects a widget takes through a method call rather than a property. */
type GtkWidgetProps = {
    /** `Gtk.EventController` elements added to the widget. */
    controllers?: ReactNode | null | undefined;
    /** `Gio.ActionGroup` elements inserted into the widget, each under its own `prefix`. */
    actionGroups?: ReactNode | null | undefined;
    /** Style declarations applied to this widget alone, outranking any class in `cssClasses`. */
    style?: Style | null | undefined;
} & ChildrenProps;

/** Props of an action group placed in a widget's `actionGroups` slot. */
type ActionGroupProps = {
    /** Prefix the group's actions are addressed by, such as `win`; defaults to the empty string. */
    prefix?: string | null | undefined;
};

/** Props of an element implementing `Gio.ActionMap`. */
type ActionMapProps = {
    /** `Gio.Action` elements added to the map, removed again by their `name`. */
    actions?: ReactNode | null | undefined;
};

/** Props of a `Gio.Menu` element. */
type MenuProps = {
    /** Entries the menu is rebuilt from whenever they change. */
    items?: MenuItem[] | null | undefined;
};

/** Props of a `Gtk.ShortcutController` element. */
type GtkShortcutControllerProps = {
    /** `Gtk.Shortcut` elements the controller watches for. */
    shortcuts?: ReactNode | null | undefined;
};

/** Props of a `Gtk.Overlay` element, whose `children` is the widget the overlays sit above. */
type GtkOverlayProps = {
    /** Widgets stacked over the main child. */
    overlays?: ReactNode | null | undefined;
} & ChildrenProps;

/** Props of a `Gtk.ConstraintLayout` element. */
type GtkConstraintLayoutProps = {
    /** `Gtk.Constraint` elements added to the layout. */
    constraints?: ReactNode | null | undefined;
    /** `Gtk.ConstraintGuide` elements added to the layout as invisible spacers. */
    guides?: ReactNode | null | undefined;
    /** Visual Format Language blocks whose constraints are added alongside `constraints`. */
    vfl?: VflConstraints[] | null | undefined;
};

/** Props of `GtkTextChildAnchor`, which embeds either a child widget or a paintable in a text buffer. */
type GtkTextChildAnchorProps = {
    /** Image inserted into the buffer instead of an anchored widget; giving both is an error. */
    paintable?: Gdk.Paintable | null | undefined;
} & ChildrenProps;

/** Props of a `Gtk.HeaderBar` or `Gtk.ActionBar` element. */
type GtkHeaderBarProps = {
    /** Widgets packed at the start of the bar. */
    start?: ReactNode | null | undefined;
    /** Widgets packed at the end of the bar. */
    end?: ReactNode | null | undefined;
};

/** Props of a `Gtk.Scale` element. */
type GtkScaleProps = {
    /** Marks drawn along the scale, cleared and re-added whenever the list changes. */
    marks?: ScaleMark[] | null | undefined;
};

/** Props of a `Gtk.ListBox` element. */
type GtkListBoxProps = {
    /**
     * Index of the row to select; `-1` or `null` selects none. Applied once the row exists, and
     * re-applied whenever the box's own selection drifts from it. Left alone while the prop is absent.
     */
    selectedIndex?: number | null | undefined;
} & ChildrenProps;

/** Props of a `Gtk.Calendar` element. */
type GtkCalendarProps = {
    /** Days of the shown month drawn as marked, cleared and re-marked whenever the list changes. */
    markedDays?: number[] | null | undefined;
};

/** Props of a `Gtk.LevelBar` element. */
type GtkLevelBarProps = {
    /** Offsets that split the bar's range into differently styled intervals. */
    offsets?: LevelBarOffset[] | null | undefined;
};

/** Props of a `Gtk.SizeGroup` element. */
type GtkSizeGroupProps = {
    /** Widgets the group keeps at a common size. */
    widgets?: Gtk.Widget[] | null | undefined;
};

/** Props of a `Gtk.AboutDialog` element. */
type GtkAboutDialogProps = {
    /**
     * Extra sections appended to the dialog's credits. GTK offers no way to remove one, so the list
     * cannot change once it has been applied.
     */
    creditSections?: CreditSection[] | null | undefined;
};

/** Props of a `Gtk.Application` element, whose `children` are the windows it owns. */
type GtkApplicationProps = {
    /** Accelerators bound to the application's actions. */
    actionAccels?: ActionAccel[] | null | undefined;
    /**
     * Command-line options the application parses, registered before it starts. GLib offers no way to
     * unregister one, so the list cannot change once it has been applied.
     */
    mainOptions?: MainOption[] | null | undefined;
} & ChildrenProps;

/** Props of a `Gtk.DropTarget` element. */
type GtkDropTargetProps = {
    /** GTypes the target accepts a drop of. */
    types?: GObject.Type[] | null | undefined;
};

/** Props of a `Gtk.DrawingArea` element. */
type GtkDrawingAreaProps = {
    /** Callback that draws the area's contents; setting it queues a redraw. */
    drawFunc?: Gtk.DrawingAreaDrawFunc | null | undefined;
};

/** Props of a `Gtk.DragSource` element. */
type GtkDragSourceProps = {
    /** Icon shown under the pointer while a drag started from this source is in flight. */
    icon?: DragSourceIcon | null | undefined;
};

export {
    type MenuItem,
    type VflConstraints,
    type ScaleMark,
    type LevelBarOffset,
    type CreditSection,
    type MainOption,
    type ActionAccel,
    type DragSourceIcon,
    type ChildrenProps,
    type GtkWidgetProps,
    type Style,
    type StyleProperties,
    type ActionGroupProps,
    type ActionMapProps,
    type MenuProps,
    type GtkShortcutControllerProps,
    type GtkOverlayProps,
    type GtkTextChildAnchorProps,
    type GtkConstraintLayoutProps,
    type GtkHeaderBarProps,
    type GtkScaleProps,
    type GtkListBoxProps,
    type GtkCalendarProps,
    type GtkLevelBarProps,
    type GtkSizeGroupProps,
    type GtkAboutDialogProps,
    type GtkApplicationProps,
    type GtkDropTargetProps,
    type GtkDrawingAreaProps,
    type GtkDragSourceProps,
};
