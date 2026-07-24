import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import type {
    ActionAccel,
    CreditSection,
    DragSourceIcon,
    GActionGroupElementProps,
    LevelBarOffset,
    MenuItem,
    ScaleMark,
    VflConstraints,
} from "./element-props.js";
import type { Props } from "./kinds.js";

/** Values available to a container behavior while attaching or moving one child. */
export type PlaceContext<C = GObject.Object, CP = Props> = {
    index: number;
    sibling: C | null;
    adopted: GObject.Object | null;
    props: CP;
};

/** Values available to a container behavior while detaching one child. */
export type DetachContext<CP = Props> = { adopted: GObject.Object | null; props: CP };

/**
 * How a container installs, moves, and removes one child. `attach` is required; a
 * container that cannot place a child through this prop states that by omitting the
 * corresponding hook rather than falling back to a method looked up by name.
 */
export type ContainerBehavior<P = GObject.Object, C = GObject.Object, CP = Props> = {
    attach?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    detach?: (parent: P, child: C, context: DetachContext<CP>) => void;
    insert?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    reorder?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    resolve?: (parent: P, child: C) => GObject.Object | null;
};

/** How a list element prop adds, removes, and clears its items. */
export type ListBehavior<P = GObject.Object, I = unknown> = {
    add?: (parent: P, item: I) => void;
    remove?: (parent: P, item: I) => void;
    clear?: (parent: P) => void;
};

/** Where a container's adopted object comes from: the attach result, or `resolve`. */
export type AdoptSource = "result" | "resolve";

export type ContainerRule = {
    kind: "container";
    prop: string;
    child: string;
    autowrap?: (inner: GObject.Object) => GObject.Object;
    adopt?: AdoptSource;
    behavior: ContainerBehavior;
};

export type ValueRule = {
    kind: "value";
    prop: string;
    apply: (object: GObject.Object, value: unknown) => void;
};

export type ListRule = { kind: "list"; prop: string; behavior: ListBehavior };

export type LazyRule = {
    kind: "lazy";
    prop: string;
    canApply?: (object: GObject.Object, value: unknown) => boolean;
};

export type ControlledTextRule = { kind: "controlled-text"; prop: string };

/** A single prop rule, discriminated by `kind`. */
export type ElementRule = ContainerRule | ValueRule | ListRule | LazyRule | ControlledTextRule;

const RULES: Record<string, ElementRule[]> = {};

/** Every registered rule, keyed by GLib type name. Adwaita rules appear once `@gtkx/react/adw` is loaded. */
export const ELEMENT_RULES: Record<string, ElementRule[]> = RULES;

const addRule = (types: string[], rule: ElementRule): void => {
    for (const type of types) {
        const existing = RULES[type];
        if (existing === undefined) RULES[type] = [rule];
        else existing.push(rule);
    }
};

type ContainerOptions<P, C> = {
    autowrap?: (inner: GObject.Object) => GObject.Object;
    adopt?: AdoptSource;
    behavior: ContainerBehavior<P, C, never>;
};

/** Declares a container prop and the behavior that places its children. */
export const defineContainer = <P extends GObject.Object, C extends GObject.Object, CP = Props>(
    types: string[],
    prop: string,
    child: string,
    options: ContainerOptions<P, C> & { behavior: ContainerBehavior<P, C, CP> },
): void => {
    const { behavior, ...rest } = options;
    addRule(types, { kind: "container", prop, child, ...rest, behavior: behavior as ContainerBehavior });
};

/** Declares an array prop and the behavior that applies its items. */
export const defineList = <P extends GObject.Object, I>(
    types: string[],
    prop: string,
    behavior: ListBehavior<P, I>,
): void => {
    addRule(types, { kind: "list", prop, behavior: behavior as ListBehavior });
};

/** Declares a scalar prop applied by invoking `apply` whenever the value changes. */
export const defineValue = <P extends GObject.Object, V>(
    types: string[],
    prop: string,
    apply: (object: P, value: V) => void,
): void => {
    addRule(types, { kind: "value", prop, apply: (object, value) => apply(object as P, value as V) });
};

/** Declares a prop applied after construction, optionally guarded by `canApply`. */
export const defineLazy = <P extends GObject.Object, V>(
    types: string[],
    prop: string,
    canApply?: (object: P, value: V) => boolean,
): void => {
    addRule(types, {
        kind: "lazy",
        prop,
        ...(canApply === undefined ? {} : { canApply: (object, value) => canApply(object as P, value as V) }),
    });
};

/** Declares a prop kept in sync with the element's own edits rather than reset on every render. */
export const defineControlledText = (types: string[], prop: string): void => {
    addRule(types, { kind: "controlled-text", prop });
};

/** Behavior for a container that installs its single child with `setChild`. */
export const childSetterBehavior = <
    P extends GObject.Object & { setChild: (child: Gtk.Widget | null) => void },
>(): ContainerBehavior<P, Gtk.Widget> => ({
    attach: (parent, child) => parent.setChild(child),
    detach: (parent) => parent.setChild(null),
});

/** Behavior for a container that installs its single child with `setContent`. */
export const contentSetterBehavior = <
    P extends GObject.Object & { setContent: (content: C | null) => void },
    C extends Gtk.Widget = Gtk.Widget,
>(): ContainerBehavior<P, C> => ({
    attach: (parent, child) => parent.setContent(child),
    detach: (parent) => parent.setContent(null),
});

/** Behavior for a `GtkBox`-style container that orders children by sibling. */
export const boxBehavior = <
    P extends GObject.Object & {
        append: (child: Gtk.Widget) => unknown;
        remove: (child: Gtk.Widget) => void;
        insertChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => unknown;
        reorderChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
    },
>(): ContainerBehavior<P, Gtk.Widget> => ({
    attach: (box, child) => box.append(child),
    detach: (box, child) => box.remove(child),
    insert: (box, child, { sibling }) => box.insertChildAfter(child, sibling),
    reorder: (box, child, { sibling }) => box.reorderChildAfter(child, sibling),
});

/** Behavior for a container that places children by index. */
export const indexedBehavior = <
    C extends GObject.Object,
    P extends GObject.Object & {
        append: (child: C) => unknown;
        remove: (child: C) => void;
        insert: (child: C, position: number) => unknown;
    } = GObject.Object & {
        append: (child: C) => unknown;
        remove: (child: C) => void;
        insert: (child: C, position: number) => unknown;
    },
>(): ContainerBehavior<P, C> => ({
    attach: (parent, child) => parent.append(child),
    detach: (parent, child) => parent.remove(child),
    insert: (parent, child, { index }) => parent.insert(child, index),
});

/** Behavior for a container whose children are added and removed by a pair of methods. */
export const addRemoveBehavior = <C extends GObject.Object, P extends GObject.Object>(
    add: (parent: P, child: C) => unknown,
    remove: (parent: P, child: C) => void,
): ContainerBehavior<P, C> => ({ attach: add, detach: remove });

const autowrapWith = <W extends Gtk.Widget>(
    Wrapper: new (props: Props) => W,
    setChild: (wrapper: W, inner: Gtk.Widget) => void,
): ((inner: GObject.Object) => GObject.Object) => {
    return (inner) => {
        if (inner instanceof Wrapper || !(inner instanceof Gtk.Widget)) return inner;
        const wrapper = new Wrapper({});
        setChild(wrapper, inner);
        return wrapper;
    };
};

type GtkChildSetter =
    | Gtk.AspectFrame
    | Gtk.Button
    | Gtk.CheckButton
    | Gtk.ComboBox
    | Gtk.DragIcon
    | Gtk.Expander
    | Gtk.FlowBoxChild
    | Gtk.Frame
    | Gtk.GraphicsOffload
    | Gtk.ListBoxRow
    | Gtk.ListHeader
    | Gtk.ListItem
    | Gtk.MenuButton
    | Gtk.Overlay
    | Gtk.Popover
    | Gtk.PopoverBin
    | Gtk.Revealer
    | Gtk.ScrolledWindow
    | Gtk.SearchBar
    | Gtk.TreeExpander
    | Gtk.Viewport
    | Gtk.Window
    | Gtk.WindowHandle;

const GTK_SINGLE_CHILD_TYPES = [
    "GtkAspectFrame",
    "GtkButton",
    "GtkCheckButton",
    "GtkComboBox",
    "GtkDragIcon",
    "GtkExpander",
    "GtkFlowBoxChild",
    "GtkFrame",
    "GtkGraphicsOffload",
    "GtkListBoxRow",
    "GtkListHeader",
    "GtkListItem",
    "GtkMenuButton",
    "GtkOverlay",
    "GtkPopover",
    "GtkPopoverBin",
    "GtkRevealer",
    "GtkScrolledWindow",
    "GtkSearchBar",
    "GtkTreeExpander",
    "GtkViewport",
    "GtkWindow",
    "GtkWindowHandle",
];

defineContainer<GtkChildSetter, Gtk.Widget>(GTK_SINGLE_CHILD_TYPES, "children", "GtkWidget", {
    behavior: childSetterBehavior<GtkChildSetter>(),
});

defineContainer<Gtk.Box, Gtk.Widget>(["GtkBox"], "children", "GtkWidget", { behavior: boxBehavior<Gtk.Box>() });

defineContainer<Gtk.ListBox, Gtk.Widget>(["GtkListBox"], "children", "GtkWidget", {
    autowrap: autowrapWith(Gtk.ListBoxRow, (row, inner) => {
        row.setChild(inner);
    }),
    behavior: indexedBehavior<Gtk.Widget, Gtk.ListBox>(),
});

defineContainer<Gtk.FlowBox, Gtk.Widget>(["GtkFlowBox"], "children", "GtkWidget", {
    autowrap: autowrapWith(Gtk.FlowBoxChild, (child, inner) => {
        child.setChild(inner);
    }),
    behavior: indexedBehavior<Gtk.Widget, Gtk.FlowBox>(),
});

const layoutChild = (parent: Gtk.Widget, child: Gtk.Widget): GObject.Object | null =>
    parent.getLayoutManager()?.getLayoutChild(child) ?? null;

defineContainer<Gtk.Widget, Gtk.Popover>(["GtkWidget"], "children", "GtkPopover", {
    behavior: {
        attach: (parent, popover) => popover.setParent(parent),
        detach: (_parent, popover) => popover.unparent(),
    },
});

defineContainer<Gtk.Widget, Gtk.EventController>(["GtkWidget"], "controllers", "GtkEventController", {
    behavior: addRemoveBehavior(
        (widget, controller) => {
            widget.addController(controller);
        },
        (widget, controller) => {
            widget.removeController(controller);
        },
    ),
});

defineContainer<Gtk.Widget, Gtk.LayoutManager>(["GtkWidget"], "layoutManager", "GtkLayoutManager", {
    behavior: {
        attach: (widget, manager) => widget.setLayoutManager(manager),
        detach: (widget) => widget.setLayoutManager(null),
    },
});

defineContainer<Gtk.Widget, Gio.ActionGroup, GActionGroupElementProps>(["GtkWidget"], "actionGroups", "GActionGroup", {
    behavior: {
        attach: (widget, group, { props }) => widget.insertActionGroup(props.prefix ?? "", group),
        detach: (widget, _group, { props }) => widget.insertActionGroup(props.prefix ?? "", null),
    },
});

defineContainer<Gtk.ShortcutController, Gtk.Shortcut>(["GtkShortcutController"], "shortcuts", "GtkShortcut", {
    behavior: addRemoveBehavior(
        (controller, shortcut) => {
            controller.addShortcut(shortcut);
        },
        (controller, shortcut) => {
            controller.removeShortcut(shortcut);
        },
    ),
});

defineContainer<Gtk.TextView, Gtk.TextBuffer>(["GtkTextView"], "children", "GtkTextBuffer", {
    behavior: {
        attach: (view, buffer) => view.setBuffer(buffer),
        detach: (view) => view.setBuffer(null),
    },
});

type ActionPlacement = { name?: string };

defineContainer<Gio.ActionMap, Gio.Action, ActionPlacement>(["GActionMap"], "actions", "GAction", {
    behavior: {
        attach: (map, action) => map.addAction(action),
        detach: (map, _action, { props }) => map.removeAction(props.name ?? ""),
    },
});

let createMenu: () => Gio.Menu = () => {
    throw new Error("GMenu construction is not available");
};

/** Installs the factory used to build nested `GMenu` instances for submenus and sections. */
export const setMenuFactory = (factory: () => Gio.Menu): void => {
    createMenu = factory;
};

const buildMenu = (items: MenuItem[]): Gio.Menu => {
    const menu = createMenu();
    for (const item of items) appendMenuItem(menu, item);
    return menu;
};

function appendMenuItem(menu: Gio.Menu, item: MenuItem): void {
    if (item.submenu !== undefined) menu.appendSubmenu(item.label ?? null, buildMenu(item.submenu));
    else if (item.section !== undefined) menu.appendSection(item.label ?? null, buildMenu(item.section));
    else menu.append(item.label ?? null, item.action ?? null);
}

defineList<Gio.Menu, MenuItem>(["GMenu"], "items", {
    clear: (menu) => menu.removeAll(),
    add: (menu, item) => appendMenuItem(menu, item),
});

defineContainer<Gtk.ColumnView, Gtk.ColumnViewColumn>(["GtkColumnView"], "children", "GtkColumnViewColumn", {
    behavior: {
        attach: (view, column) => view.appendColumn(column),
        detach: (view, column) => view.removeColumn(column),
        insert: (view, column, { index }) => view.insertColumn(index, column),
    },
});

defineContainer<Gtk.Grid, Gtk.Widget>(["GtkGrid"], "children", "GtkWidget", {
    adopt: "resolve",
    behavior: {
        attach: (grid, child) => grid.attach(child, 0, 0, 1, 1),
        detach: (grid, child) => grid.remove(child),
        resolve: layoutChild,
    },
});

defineContainer<Gtk.Fixed, Gtk.Widget>(["GtkFixed"], "children", "GtkWidget", {
    adopt: "resolve",
    behavior: {
        attach: (fixed, child) => fixed.put(child, 0, 0),
        detach: (fixed, child) => fixed.remove(child),
        resolve: layoutChild,
    },
});

defineContainer<Gtk.Overlay, Gtk.Widget>(["GtkOverlay"], "overlays", "GtkWidget", {
    adopt: "resolve",
    behavior: {
        attach: (overlay, child) => overlay.addOverlay(child),
        detach: (overlay, child) => overlay.removeOverlay(child),
        resolve: layoutChild,
    },
});

defineList<Gtk.SizeGroup, Gtk.Widget>(["GtkSizeGroup"], "widgets", {
    add: (group, widget) => group.addWidget(widget),
    remove: (group, widget) => group.removeWidget(widget),
});

defineContainer<Gtk.ConstraintLayout, Gtk.Constraint>(["GtkConstraintLayout"], "constraints", "GtkConstraint", {
    behavior: addRemoveBehavior(
        (layout, constraint) => {
            layout.addConstraint(constraint);
        },
        (layout, constraint) => {
            layout.removeConstraint(constraint);
        },
    ),
});

defineContainer<Gtk.ConstraintLayout, Gtk.ConstraintGuide>(["GtkConstraintLayout"], "guides", "GtkConstraintGuide", {
    behavior: addRemoveBehavior(
        (layout, guide) => {
            layout.addGuide(guide);
        },
        (layout, guide) => {
            layout.removeGuide(guide);
        },
    ),
});

const vflConstraints = new WeakMap<VflConstraints, Gtk.Constraint[]>();

defineList<Gtk.ConstraintLayout, VflConstraints>(["GtkConstraintLayout"], "vfl", {
    add: (layout, item) => {
        const added = layout.addConstraintsFromDescription(
            item.lines,
            item.hspacing ?? 0,
            item.vspacing ?? 0,
            item.views ?? new Map(),
        );
        vflConstraints.set(item, [...added]);
    },
    remove: (layout, item) => {
        for (const constraint of vflConstraints.get(item) ?? []) layout.removeConstraint(constraint);
        vflConstraints.delete(item);
    },
});

type Packer = Gtk.HeaderBar | Gtk.ActionBar;

const packBehavior = (pack: (bar: Packer, child: Gtk.Widget) => void): ContainerBehavior<Packer, Gtk.Widget> =>
    addRemoveBehavior(pack, (bar, child) => {
        bar.remove(child);
    });

defineContainer<Packer, Gtk.Widget>(["GtkHeaderBar", "GtkActionBar"], "start", "GtkWidget", {
    behavior: packBehavior((bar, child) => {
        bar.packStart(child);
    }),
});

defineContainer<Packer, Gtk.Widget>(["GtkHeaderBar", "GtkActionBar"], "end", "GtkWidget", {
    behavior: packBehavior((bar, child) => {
        bar.packEnd(child);
    }),
});

defineContainer<Gtk.Stack, Gtk.Widget>(["GtkStack"], "children", "GtkWidget", {
    adopt: "result",
    behavior: {
        attach: (stack, child) => stack.addChild(child),
        detach: (stack, child) => stack.remove(child),
    },
});

defineLazy<Gtk.Stack, string>(["GtkStack"], "visibleChildName", (stack, name) => stack.getChildByName(name) !== null);

defineContainer<Gtk.Notebook, Gtk.Widget>(["GtkNotebook"], "children", "GtkWidget", {
    adopt: "resolve",
    behavior: {
        attach: (notebook, child) => notebook.appendPage(child, null),
        insert: (notebook, child, { index }) => notebook.insertPage(child, null, index),
        reorder: (notebook, child, { index }) => notebook.reorderChild(child, index),
        detach: (notebook, child) => notebook.detachTab(child),
        resolve: (notebook, child) => notebook.getPage(child),
    },
});

defineContainer<Gtk.Application, Gtk.Window>(["GtkApplication"], "children", "GtkWindow", {
    behavior: addRemoveBehavior(
        (application, window) => {
            application.addWindow(window);
        },
        (application, window) => {
            application.removeWindow(window);
        },
    ),
});

defineList<Gtk.Application, ActionAccel>(["GtkApplication"], "actionAccels", {
    add: (application, item) => application.setAccelsForAction(item.detailedActionName, item.accels),
    remove: (application, item) => application.setAccelsForAction(item.detailedActionName, []),
});

defineList<Gtk.AboutDialog, CreditSection>(["GtkAboutDialog"], "creditSections", {
    add: (dialog, section) => dialog.addCreditSection(section.sectionName, section.people),
});

defineList<Gtk.Scale, ScaleMark>(["GtkScale"], "marks", {
    add: (scale, mark) => scale.addMark(mark.value ?? 0, mark.position, mark.markup ?? null),
    clear: (scale) => scale.clearMarks(),
});

defineList<Gtk.Calendar, number>(["GtkCalendar"], "markedDays", {
    add: (calendar, day) => calendar.markDay(day),
    clear: (calendar) => calendar.clearMarks(),
});

defineList<Gtk.LevelBar, LevelBarOffset>(["GtkLevelBar"], "offsets", {
    add: (bar, offset) => bar.addOffsetValue(offset.name, offset.value ?? 0),
    remove: (bar, offset) => bar.removeOffsetValue(offset.name),
});

defineValue<Gtk.DropTarget, GObject.Type[]>(["GtkDropTarget"], "types", (target, types) => {
    target.setGtypes(types);
});

defineValue<Gtk.DrawingArea, Gtk.DrawingAreaDrawFunc>(["GtkDrawingArea"], "drawFunc", (area, draw) => {
    area.setDrawFunc(draw);
    area.queueDraw();
});

defineValue<Gtk.DragSource, DragSourceIcon>(["GtkDragSource"], "icon", (source, icon) => {
    source.setIcon(icon.paintable ?? null, icon.hotX ?? 0, icon.hotY ?? 0);
});

defineControlledText(["GtkEditable"], "text");
