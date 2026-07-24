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

type ContainerOptions<P, C> = {
    autowrap?: (inner: GObject.Object) => GObject.Object;
    adopt?: AdoptSource;
    behavior: ContainerBehavior<P, C, never>;
};

/** Builds a container rule: a child slot and the behavior that places its children. */
export const containerRule = <P extends GObject.Object, C extends GObject.Object, CP = Props>(
    prop: string,
    child: string,
    options: ContainerOptions<P, C> & { behavior: ContainerBehavior<P, C, CP> },
): ContainerRule => {
    const { behavior, ...rest } = options;
    return { kind: "container", prop, child, ...rest, behavior: behavior as ContainerBehavior };
};

/** Builds an array-prop rule and the behavior that applies its items. */
export const listRule = <P extends GObject.Object, I>(prop: string, behavior: ListBehavior<P, I>): ListRule => ({
    kind: "list",
    prop,
    behavior: behavior as ListBehavior,
});

/** Builds a scalar-prop rule applied by invoking `apply` whenever the value changes. */
export const valueRule = <P extends GObject.Object, V>(
    prop: string,
    apply: (object: P, value: V) => void,
): ValueRule => ({
    kind: "value",
    prop,
    apply: (object, value) => apply(object as P, value as V),
});

/** Builds a rule for a prop applied after construction, optionally guarded by `canApply`. */
export const lazyRule = <P extends GObject.Object, V>(
    prop: string,
    canApply?: (object: P, value: V) => boolean,
): LazyRule => ({
    kind: "lazy",
    prop,
    ...(canApply === undefined ? {} : { canApply: (object, value) => canApply(object as P, value as V) }),
});

/** Builds a rule for a prop kept in sync with the element's own edits. */
export const controlledTextRule = (prop: string): ControlledTextRule => ({ kind: "controlled-text", prop });

const ruleKey = (rule: ElementRule): string =>
    rule.kind === "container" ? `container:${rule.prop}:${rule.child}` : `${rule.kind}:${rule.prop}`;

/**
 * Registers rules keyed by GLib type name. A rule replaces a registered one with the same
 * kind, prop, and child type, keeping its position; anything else is appended.
 */
export const registerElementProps = (rules: Record<string, ElementRule[]>): void => {
    for (const [type, added] of Object.entries(rules)) {
        const existing = RULES[type] ?? [];
        const replacements = new Map(added.map((rule) => [ruleKey(rule), rule]));
        const merged = existing.map((rule) => replacements.get(ruleKey(rule)) ?? rule);
        const replaced = new Set(existing.map(ruleKey));
        RULES[type] = [...merged, ...added.filter((rule) => !replaced.has(ruleKey(rule)))];
    }
};

/**
 * Identity helper that types a module of element rules for the `elementProps` entry of
 * `gtkx.config.ts`, enabling editor autocompletion and type checking.
 */
export const defineElementProps = (rules: Record<string, ElementRule[]>): Record<string, ElementRule[]> => rules;

const forTypes = (types: string[], ...rules: ElementRule[]): Record<string, ElementRule[]> =>
    Object.fromEntries(types.map((type) => [type, rules]));

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

/** Rule for a `children` slot whose attach call returns the page object the container adopts. */
export const adoptedChildrenRule = <P extends GObject.Object, C extends GObject.Object>(
    child: string,
    add: (parent: P, item: C) => unknown,
    remove: (parent: P, item: C) => void,
): ContainerRule =>
    containerRule<P, C>("children", child, { adopt: "result", behavior: { attach: add, detach: remove } });

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

const layoutChild = (parent: Gtk.Widget, child: Gtk.Widget): GObject.Object | null =>
    parent.getLayoutManager()?.getLayoutChild(child) ?? null;

type ActionPlacement = { name?: string };

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

const vflConstraints = new WeakMap<VflConstraints, Gtk.Constraint[]>();

type Packer = Gtk.HeaderBar | Gtk.ActionBar;

const packBehavior = (pack: (bar: Packer, child: Gtk.Widget) => void): ContainerBehavior<Packer, Gtk.Widget> =>
    addRemoveBehavior(pack, (bar, child) => {
        bar.remove(child);
    });

registerElementProps({
    ...forTypes(
        GTK_SINGLE_CHILD_TYPES,
        containerRule<GtkChildSetter, Gtk.Widget>("children", "GtkWidget", {
            behavior: childSetterBehavior<GtkChildSetter>(),
        }),
    ),
    ...forTypes(
        ["GtkHeaderBar", "GtkActionBar"],
        containerRule<Packer, Gtk.Widget>("start", "GtkWidget", {
            behavior: packBehavior((bar, child) => {
                bar.packStart(child);
            }),
        }),
        containerRule<Packer, Gtk.Widget>("end", "GtkWidget", {
            behavior: packBehavior((bar, child) => {
                bar.packEnd(child);
            }),
        }),
    ),
    GtkWidget: [
        containerRule<Gtk.Widget, Gtk.Popover>("children", "GtkPopover", {
            behavior: {
                attach: (parent, popover) => popover.setParent(parent),
                detach: (_parent, popover) => popover.unparent(),
            },
        }),
        containerRule<Gtk.Widget, Gtk.EventController>("controllers", "GtkEventController", {
            behavior: addRemoveBehavior(
                (widget, controller) => {
                    widget.addController(controller);
                },
                (widget, controller) => {
                    widget.removeController(controller);
                },
            ),
        }),
        containerRule<Gtk.Widget, Gtk.LayoutManager>("layoutManager", "GtkLayoutManager", {
            behavior: {
                attach: (widget, manager) => widget.setLayoutManager(manager),
                detach: (widget) => widget.setLayoutManager(null),
            },
        }),
        containerRule<Gtk.Widget, Gio.ActionGroup, GActionGroupElementProps>("actionGroups", "GActionGroup", {
            behavior: {
                attach: (widget, group, { props }) => widget.insertActionGroup(props.prefix ?? "", group),
                detach: (widget, _group, { props }) => widget.insertActionGroup(props.prefix ?? "", null),
            },
        }),
    ],
    GtkBox: [containerRule<Gtk.Box, Gtk.Widget>("children", "GtkWidget", { behavior: boxBehavior<Gtk.Box>() })],
    GtkListBox: [
        containerRule<Gtk.ListBox, Gtk.Widget>("children", "GtkWidget", {
            autowrap: autowrapWith(Gtk.ListBoxRow, (row, inner) => {
                row.setChild(inner);
            }),
            behavior: indexedBehavior<Gtk.Widget, Gtk.ListBox>(),
        }),
    ],
    GtkFlowBox: [
        containerRule<Gtk.FlowBox, Gtk.Widget>("children", "GtkWidget", {
            autowrap: autowrapWith(Gtk.FlowBoxChild, (child, inner) => {
                child.setChild(inner);
            }),
            behavior: indexedBehavior<Gtk.Widget, Gtk.FlowBox>(),
        }),
    ],
    GtkOverlay: [
        containerRule<Gtk.Overlay, Gtk.Widget>("children", "GtkWidget", {
            behavior: childSetterBehavior<Gtk.Overlay>(),
        }),
        containerRule<Gtk.Overlay, Gtk.Widget>("overlays", "GtkWidget", {
            adopt: "resolve",
            behavior: {
                attach: (overlay, child) => overlay.addOverlay(child),
                detach: (overlay, child) => overlay.removeOverlay(child),
                resolve: layoutChild,
            },
        }),
    ],
    GtkShortcutController: [
        containerRule<Gtk.ShortcutController, Gtk.Shortcut>("shortcuts", "GtkShortcut", {
            behavior: addRemoveBehavior(
                (controller, shortcut) => {
                    controller.addShortcut(shortcut);
                },
                (controller, shortcut) => {
                    controller.removeShortcut(shortcut);
                },
            ),
        }),
    ],
    GtkTextView: [
        containerRule<Gtk.TextView, Gtk.TextBuffer>("children", "GtkTextBuffer", {
            behavior: {
                attach: (view, buffer) => view.setBuffer(buffer),
                detach: (view) => view.setBuffer(null),
            },
        }),
    ],
    GActionMap: [
        containerRule<Gio.ActionMap, Gio.Action, ActionPlacement>("actions", "GAction", {
            behavior: {
                attach: (map, action) => map.addAction(action),
                detach: (map, _action, { props }) => map.removeAction(props.name ?? ""),
            },
        }),
    ],
    GMenu: [
        listRule<Gio.Menu, MenuItem>("items", {
            clear: (menu) => menu.removeAll(),
            add: (menu, item) => appendMenuItem(menu, item),
        }),
    ],
    GtkColumnView: [
        containerRule<Gtk.ColumnView, Gtk.ColumnViewColumn>("children", "GtkColumnViewColumn", {
            behavior: {
                attach: (view, column) => view.appendColumn(column),
                detach: (view, column) => view.removeColumn(column),
                insert: (view, column, { index }) => view.insertColumn(index, column),
            },
        }),
    ],
    GtkGrid: [
        containerRule<Gtk.Grid, Gtk.Widget>("children", "GtkWidget", {
            adopt: "resolve",
            behavior: {
                attach: (grid, child) => grid.attach(child, 0, 0, 1, 1),
                detach: (grid, child) => grid.remove(child),
                resolve: layoutChild,
            },
        }),
    ],
    GtkFixed: [
        containerRule<Gtk.Fixed, Gtk.Widget>("children", "GtkWidget", {
            adopt: "resolve",
            behavior: {
                attach: (fixed, child) => fixed.put(child, 0, 0),
                detach: (fixed, child) => fixed.remove(child),
                resolve: layoutChild,
            },
        }),
    ],
    GtkSizeGroup: [
        listRule<Gtk.SizeGroup, Gtk.Widget>("widgets", {
            add: (group, widget) => group.addWidget(widget),
            remove: (group, widget) => group.removeWidget(widget),
        }),
    ],
    GtkConstraintLayout: [
        containerRule<Gtk.ConstraintLayout, Gtk.Constraint>("constraints", "GtkConstraint", {
            behavior: addRemoveBehavior(
                (layout, constraint) => {
                    layout.addConstraint(constraint);
                },
                (layout, constraint) => {
                    layout.removeConstraint(constraint);
                },
            ),
        }),
        containerRule<Gtk.ConstraintLayout, Gtk.ConstraintGuide>("guides", "GtkConstraintGuide", {
            behavior: addRemoveBehavior(
                (layout, guide) => {
                    layout.addGuide(guide);
                },
                (layout, guide) => {
                    layout.removeGuide(guide);
                },
            ),
        }),
        listRule<Gtk.ConstraintLayout, VflConstraints>("vfl", {
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
        }),
    ],
    GtkStack: [
        adoptedChildrenRule<Gtk.Stack, Gtk.Widget>(
            "GtkWidget",
            (stack, child) => stack.addChild(child),
            (stack, child) => {
                stack.remove(child);
            },
        ),
        lazyRule<Gtk.Stack, string>("visibleChildName", (stack, name) => stack.getChildByName(name) !== null),
    ],
    GtkNotebook: [
        containerRule<Gtk.Notebook, Gtk.Widget>("children", "GtkWidget", {
            adopt: "resolve",
            behavior: {
                attach: (notebook, child) => notebook.appendPage(child, null),
                insert: (notebook, child, { index }) => notebook.insertPage(child, null, index),
                reorder: (notebook, child, { index }) => notebook.reorderChild(child, index),
                detach: (notebook, child) => notebook.detachTab(child),
                resolve: (notebook, child) => notebook.getPage(child),
            },
        }),
    ],
    GtkApplication: [
        containerRule<Gtk.Application, Gtk.Window>("children", "GtkWindow", {
            behavior: addRemoveBehavior(
                (application, window) => {
                    application.addWindow(window);
                },
                (application, window) => {
                    application.removeWindow(window);
                },
            ),
        }),
        listRule<Gtk.Application, ActionAccel>("actionAccels", {
            add: (application, item) => application.setAccelsForAction(item.detailedActionName, item.accels),
            remove: (application, item) => application.setAccelsForAction(item.detailedActionName, []),
        }),
    ],
    GtkAboutDialog: [
        listRule<Gtk.AboutDialog, CreditSection>("creditSections", {
            add: (dialog, section) => dialog.addCreditSection(section.sectionName, section.people),
        }),
    ],
    GtkScale: [
        listRule<Gtk.Scale, ScaleMark>("marks", {
            add: (scale, mark) => scale.addMark(mark.value ?? 0, mark.position, mark.markup ?? null),
            clear: (scale) => scale.clearMarks(),
        }),
    ],
    GtkCalendar: [
        listRule<Gtk.Calendar, number>("markedDays", {
            add: (calendar, day) => calendar.markDay(day),
            clear: (calendar) => calendar.clearMarks(),
        }),
    ],
    GtkLevelBar: [
        listRule<Gtk.LevelBar, LevelBarOffset>("offsets", {
            add: (bar, offset) => bar.addOffsetValue(offset.name, offset.value ?? 0),
            remove: (bar, offset) => bar.removeOffsetValue(offset.name),
        }),
    ],
    GtkDropTarget: [
        valueRule<Gtk.DropTarget, GObject.Type[]>("types", (target, types) => {
            target.setGtypes(types);
        }),
    ],
    GtkDrawingArea: [
        valueRule<Gtk.DrawingArea, Gtk.DrawingAreaDrawFunc>("drawFunc", (area, draw) => {
            area.setDrawFunc(draw);
            area.queueDraw();
        }),
    ],
    GtkDragSource: [
        valueRule<Gtk.DragSource, DragSourceIcon>("icon", (source, icon) => {
            source.setIcon(icon.paintable ?? null, icon.hotX ?? 0, icon.hotY ?? 0);
        }),
    ],
    GtkEditable: [controlledTextRule("text")],
});
