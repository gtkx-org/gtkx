import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getInstanceType, TYPE_INVALID, typeFromName, typeIsA } from "@gtkx/runtime";
import { isDeepEqual, structuredClone } from "@gtkx/utils";
import type { Props } from "./kinds.js";
import type {
    ActionAccel,
    CreditSection,
    DragSourceIcon,
    LevelBarOffset,
    MenuItem,
    ScaleMark,
    VflConstraints,
} from "./prop-types.js";

/** Per-child values a slot hook receives while placing or moving one child. */
export type PlaceInfo = {
    slot: string;
    index: number;
    sibling: GObject.Object | null;
    adopted: GObject.Object | null;
    props: Props;
    context: unknown;
};

/** Per-child values a slot hook receives while removing one child. */
export type DetachInfo = {
    slot: string;
    adopted: GObject.Object | null;
    props: Props;
    context: unknown;
};

/**
 * Customizes how one element type places children and applies props. Every hook receives the
 * GObject instance and a private per-node `context` built once by `createContext`. A slot hook
 * claims a child by returning a non-`undefined` value; that value, or `resolve`, is the object
 * the container adopts for the child. `update` returns the prop names it consumed so those props
 * are not also set as plain GObject properties.
 */
export type ElementBehavior<T extends GObject.Object = GObject.Object> = {
    createContext?: (node: T) => unknown;
    attach?: (node: T, child: GObject.Object, info: PlaceInfo) => unknown;
    reorder?: (node: T, child: GObject.Object, info: PlaceInfo) => unknown;
    detach?: (node: T, child: GObject.Object, info: DetachInfo) => void;
    resolve?: (node: T, child: GObject.Object) => GObject.Object | null;
    update?: (node: T, prev: Props, next: Props, context: unknown) => Iterable<string> | undefined;
    flush?: (node: T, context: unknown) => void;
    mount?: (node: T, context: unknown) => void;
    unmount?: (node: T, context: unknown) => void;
};

/** A named export in a module, referenced as plain data (the module is never imported at runtime). */
export type ModuleExport = { module: string; export: string };

/**
 * Per-element configuration keyed by GLib type name: whether the element is lazy (its GObject is
 * created by its parent container, as pages and layout children are), the custom behaviors bound to
 * its type, an optional component that wraps the generated element, and the base props interface its
 * generated props extend. `component` and `props` are inert at runtime; they are read only by codegen.
 */
export type ElementConfig<T extends GObject.Object = GObject.Object> = {
    lazy?: boolean;
    behaviors?: ElementBehavior<T>[];
    component?: ModuleExport;
    props?: ModuleExport;
};

/** Every registered element config, keyed by GLib type name. Adwaita entries appear once `@gtkx/react/adw` is loaded. */
export const ELEMENTS: Record<string, ElementConfig> = {};

const mergeConfigEntry = (base: ElementConfig, added: ElementConfig<never>): ElementConfig => {
    const entry: ElementConfig = { ...base };
    if (added.behaviors !== undefined) {
        entry.behaviors = [...(entry.behaviors ?? []), ...(added.behaviors as ElementBehavior[])];
    }
    if (added.lazy === true) entry.lazy = true;
    if (added.component !== undefined) entry.component = added.component;
    if (added.props !== undefined) entry.props = added.props;
    return entry;
};

/**
 * Merges maps of {@link ElementConfig} keyed by GLib type name into one, concatenating each type's
 * behaviors in the order the maps are given (an earlier map's behaviors come first) and taking the last
 * lazy flag, component, and props seen. Use it to combine an app's element config with its behaviors.
 */
export const mergeElementConfigs = (...maps: Record<string, ElementConfig<never>>[]): Record<string, ElementConfig> => {
    const merged: Record<string, ElementConfig> = {};
    for (const map of maps) {
        for (const [type, config] of Object.entries(map)) merged[type] = mergeConfigEntry(merged[type] ?? {}, config);
    }
    return merged;
};

/**
 * Registers one or more maps of {@link ElementConfig} keyed by GLib type name, merging each entry's
 * behaviors and lazy flag into the registry. Behaviors accumulate in the order the maps are given, so a
 * map passed earlier is consulted before a later one for the same slot; pass an app's own configuration
 * ahead of the framework's built-ins to let it override a slot or prop.
 */
export const registerElements = (...maps: Record<string, ElementConfig<never>>[]): void => {
    for (const elements of maps) {
        for (const [type, config] of Object.entries(elements)) {
            ELEMENTS[type] = mergeConfigEntry(ELEMENTS[type] ?? {}, config);
        }
    }
};

/**
 * Identity helper that types the module named by the `elements` entry of `gtkx.config.ts`, enabling
 * editor autocompletion and type checking. Key each entry by GLib type name and annotate each hook's
 * node parameter with the concrete GObject class the behavior applies to.
 */
export const defineElements = (elements: Record<string, ElementConfig<never>>): Record<string, ElementConfig<never>> =>
    elements;

const childTypeCache = new Map<string, bigint>();

const childTypeOf = (name: string): bigint => {
    let type = childTypeCache.get(name);
    if (type === undefined) {
        type = typeFromName(name);
        childTypeCache.set(name, type);
    }
    return type;
};

const childMatcher =
    (name: string): ((child: GObject.Object) => boolean) =>
    (child) => {
        const type = childTypeOf(name);
        return type === TYPE_INVALID || typeIsA(getInstanceType(child), type);
    };

type SlotHooks<P extends GObject.Object, C extends GObject.Object> = {
    attach: (parent: P, child: C, info: PlaceInfo) => unknown;
    detach?: (parent: P, child: C, info: DetachInfo) => void;
    reorder?: (parent: P, child: C, info: PlaceInfo) => unknown;
    resolve?: (parent: P, child: C) => GObject.Object | null;
};

/** Builds a behavior for a named child slot holding children of `childType`, claiming matches only. */
const slot = <P extends GObject.Object, C extends GObject.Object>(
    prop: string,
    childType: string,
    hooks: SlotHooks<P, C>,
): ElementBehavior => {
    const matches = childMatcher(childType);
    const { attach, detach, reorder, resolve } = hooks;
    const behavior: ElementBehavior = {
        attach: (node, child, info) =>
            info.slot === prop && matches(child) ? (attach(node as P, child as C, info) ?? true) : undefined,
    };
    if (reorder !== undefined) behavior.reorder = (node, child, info) => reorder(node as P, child as C, info) ?? true;
    if (detach !== undefined)
        behavior.detach = (node, child, info) => {
            detach(node as P, child as C, info);
        };
    if (resolve !== undefined) behavior.resolve = (node, child) => resolve(node as P, child as C);
    return behavior;
};

/** Builds a scalar-prop behavior that invokes `apply` whenever the value changes, and claims the prop. */
const value = <P extends GObject.Object, V>(prop: string, apply: (object: P, value: V) => void): ElementBehavior => ({
    update: (node, prev, next) => {
        if (!Object.is(prev[prop], next[prop]) && next[prop] !== undefined) apply(node as P, next[prop] as V);
        return [prop];
    },
});

type ListHooks<P extends GObject.Object, I, H> = {
    add?: (parent: P, item: I) => H;
    remove?: (parent: P, item: I, handle: H) => void;
    clear?: (parent: P) => void;
};

type ListEntry = { item: unknown; handle: unknown };
type ListState = { snapshot: unknown[]; entries: ListEntry[] };

/**
 * Builds an array-prop behavior that adds, removes, and clears its items, reapplying on structural
 * change. `add` may return a handle that the same item's later `remove` receives, for items whose
 * teardown needs what `add` produced (as VFL constraints need the objects the layout created).
 */
const list = <P extends GObject.Object, I, H = void>(prop: string, hooks: ListHooks<P, I, H>): ElementBehavior => {
    const { add, remove, clear } = hooks;
    return {
        createContext: (): ListState => ({ snapshot: [], entries: [] }),
        update: (node, _prev, next, context) => {
            const state = context as ListState;
            const raw = next[prop];
            const items = Array.isArray(raw) ? raw : [];
            if (isDeepEqual(state.snapshot, items)) return [prop];
            if (clear !== undefined) clear(node as P);
            else if (remove !== undefined)
                for (const entry of state.entries) remove(node as P, entry.item as I, entry.handle as H);
            state.entries = items.map((item) => ({ item, handle: add?.(node as P, item as I) }));
            state.snapshot = structuredClone(items);
            return [prop];
        },
    };
};

type DeferredState = { desired: unknown; present: boolean; applied: unknown };

/** Props a behavior applies after construction; the constructor is never given them. */
export const deferredProps = (behavior: ElementBehavior): string[] =>
    (behavior as { deferred?: string[] }).deferred ?? [];

/** Builds a behavior for a prop applied after the surrounding commit, deferred until `canApply` returns true. */
const deferred = <P extends GObject.Object, V>(
    prop: string,
    canApply?: (object: P, value: V) => boolean,
): ElementBehavior & { deferred: string[] } => ({
    deferred: [prop],
    createContext: (): DeferredState => ({ desired: undefined, present: false, applied: undefined }),
    update: (_node, _prev, next, context) => {
        const state = context as DeferredState;
        state.desired = next[prop];
        state.present = next[prop] !== undefined;
        return [prop];
    },
    flush: (node, context) => {
        const state = context as DeferredState;
        if (!state.present || Object.is(state.applied, state.desired)) return;
        if (canApply !== undefined && !canApply(node as P, state.desired as V)) return;
        Reflect.set(node, prop, state.desired);
        state.applied = state.desired;
    },
});

/** Builds a behavior for a text prop kept in controlled-input sync: set when provided, never reset. */
const controlledText = (prop: string): ElementBehavior => ({
    update: (node, prev, next) => {
        if (next[prop] !== undefined && !Object.is(prev[prop], next[prop])) Reflect.set(node, prop, next[prop]);
        return [prop];
    },
});

const forTypes = (types: string[], config: ElementConfig): Record<string, ElementConfig> =>
    Object.fromEntries(types.map((type) => [type, config]));

/** References a base props interface exported from `@gtkx/react/internal`. */
const internal = (name: string): ModuleExport => ({ module: "@gtkx/react/internal", export: name });

/** Behavior for a container that installs its single child with `setChild`. */
const childSetterSlot = <
    P extends GObject.Object & { setChild: (child: Gtk.Widget | null) => void },
>(): ElementBehavior =>
    slot<P, Gtk.Widget>("children", "GtkWidget", {
        attach: (parent, child) => parent.setChild(child),
        detach: (parent) => parent.setChild(null),
    });

/** Behavior for a container that installs its single child with `setContent`. */
const contentSetterSlot = <
    P extends GObject.Object & { setContent: (content: C | null) => void },
    C extends Gtk.Widget = Gtk.Widget,
>(
    childType = "GtkWidget",
): ElementBehavior =>
    slot<P, C>("children", childType, {
        attach: (parent, child) => parent.setContent(child),
        detach: (parent) => parent.setContent(null),
    });

/** Behavior for a `GtkBox`-style container that orders children by sibling. */
const boxSlot = <
    P extends GObject.Object & {
        remove: (child: Gtk.Widget) => void;
        insertChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => unknown;
        reorderChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
    },
>(): ElementBehavior =>
    slot<P, Gtk.Widget>("children", "GtkWidget", {
        attach: (box, child, info) => box.insertChildAfter(child, info.sibling as Gtk.Widget | null),
        detach: (box, child) => box.remove(child),
        reorder: (box, child, info) => box.reorderChildAfter(child, info.sibling as Gtk.Widget | null),
    });

/** Behavior for a container whose children are added and removed by a pair of methods. */
const addRemoveSlot = <C extends GObject.Object, P extends GObject.Object>(
    prop: string,
    childType: string,
    add: (parent: P, child: C) => unknown,
    remove: (parent: P, child: C) => void,
): ElementBehavior => slot<P, C>(prop, childType, { attach: add, detach: remove });

/** Behavior for a `children` slot whose attach call returns the page object the container adopts. */
const adoptedChildrenSlot = <P extends GObject.Object, C extends GObject.Object>(
    childType: string,
    add: (parent: P, item: C) => unknown,
    remove: (parent: P, item: C) => void,
): ElementBehavior => slot<P, C>("children", childType, { attach: add, detach: remove });

type RowCache = WeakMap<GObject.Object, Gtk.Widget>;

/** Behavior for an index-placed container that wraps each child in `Wrapper` before adding it. */
const wrappingIndexedSlot = <
    W extends Gtk.Widget,
    P extends GObject.Object & {
        remove: (child: Gtk.Widget) => void;
        insert: (child: Gtk.Widget, position: number) => unknown;
    },
>(
    Wrapper: new (props: Props) => W,
    setChild: (wrapper: W, inner: Gtk.Widget) => void,
): ElementBehavior => {
    const rowFor = (rows: RowCache, child: Gtk.Widget): Gtk.Widget => {
        if (child instanceof Wrapper) return child;
        const existing = rows.get(child);
        if (existing !== undefined) return existing;
        const wrapper = new Wrapper({});
        setChild(wrapper, child);
        rows.set(child, wrapper);
        return wrapper;
    };
    return {
        ...slot<P, Gtk.Widget>("children", "GtkWidget", {
            attach: (parent, child, info) => parent.insert(rowFor(info.context as RowCache, child), info.index),
            detach: (parent, child, info) => {
                const row = child instanceof Wrapper ? child : (info.context as RowCache).get(child);
                if (row !== undefined) parent.remove(row);
            },
        }),
        createContext: (): RowCache => new WeakMap(),
    };
};

const layoutChild = (parent: Gtk.Widget, child: Gtk.Widget): GObject.Object | null =>
    parent.getLayoutManager()?.getLayoutChild(child) ?? null;

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
    "GtkWindowHandle",
];

export const GTK_ELEMENTS: Record<string, ElementConfig> = {
    ...forTypes(GTK_SINGLE_CHILD_TYPES, { props: internal("ChildrenProps"), behaviors: [childSetterSlot()] }),
    ...forTypes(["GtkHeaderBar", "GtkActionBar"], {
        props: internal("GtkHeaderBarProps"),
        behaviors: [
            addRemoveSlot<Gtk.Widget, Gtk.HeaderBar | Gtk.ActionBar>(
                "start",
                "GtkWidget",
                (bar, child) => {
                    bar.packStart(child);
                },
                (bar, child) => {
                    bar.remove(child);
                },
            ),
            addRemoveSlot<Gtk.Widget, Gtk.HeaderBar | Gtk.ActionBar>(
                "end",
                "GtkWidget",
                (bar, child) => {
                    bar.packEnd(child);
                },
                (bar, child) => {
                    bar.remove(child);
                },
            ),
        ],
    }),
    GtkWindow: {
        props: internal("ChildrenProps"),
        component: internal("createWindowComponent"),
        behaviors: [childSetterSlot()],
    },
    GtkLabel: { props: internal("ChildrenProps") },
    GtkTextBuffer: { props: internal("ChildrenProps") },
    GtkTextTag: { props: internal("ChildrenProps") },
    GtkTextChildAnchor: { props: internal("ChildrenProps") },
    GtkGridLayoutChild: { lazy: true },
    GtkFixedLayoutChild: { lazy: true },
    GtkOverlayLayoutChild: { lazy: true },
    GtkStackPage: { lazy: true },
    GtkNotebookPage: { lazy: true },
    GActionGroup: { props: internal("GActionGroupProps") },
    GtkWidget: {
        props: internal("GtkWidgetProps"),
        behaviors: [
            slot<Gtk.Widget, Gtk.Popover>("children", "GtkPopover", {
                attach: (parent, popover) => popover.setParent(parent),
                detach: (_parent, popover) => popover.unparent(),
            }),
            addRemoveSlot<Gtk.EventController, Gtk.Widget>(
                "controllers",
                "GtkEventController",
                (widget, controller) => {
                    widget.addController(controller);
                },
                (widget, controller) => {
                    widget.removeController(controller);
                },
            ),
            slot<Gtk.Widget, Gtk.LayoutManager>("layoutManager", "GtkLayoutManager", {
                attach: (widget, manager) => widget.setLayoutManager(manager),
                detach: (widget) => widget.setLayoutManager(null),
            }),
            slot<Gtk.Widget, Gio.ActionGroup>("actionGroups", "GActionGroup", {
                attach: (widget, group, info) =>
                    widget.insertActionGroup((info.props.prefix as string | null) ?? "", group),
                detach: (widget, _group, info) =>
                    widget.insertActionGroup((info.props.prefix as string | null) ?? "", null),
            }),
        ],
    },
    GtkBox: { props: internal("ChildrenProps"), behaviors: [boxSlot<Gtk.Box>()] },
    GtkListBox: {
        props: internal("ChildrenProps"),
        behaviors: [
            wrappingIndexedSlot(Gtk.ListBoxRow, (row, inner) => {
                row.setChild(inner);
            }),
        ],
    },
    GtkFlowBox: {
        props: internal("ChildrenProps"),
        behaviors: [
            wrappingIndexedSlot(Gtk.FlowBoxChild, (child, inner) => {
                child.setChild(inner);
            }),
        ],
    },
    GtkOverlay: {
        props: internal("GtkOverlayProps"),
        behaviors: [
            childSetterSlot<Gtk.Overlay>(),
            slot<Gtk.Overlay, Gtk.Widget>("overlays", "GtkWidget", {
                attach: (overlay, child) => overlay.addOverlay(child),
                detach: (overlay, child) => overlay.removeOverlay(child),
                resolve: layoutChild,
            }),
        ],
    },
    GtkShortcutController: {
        props: internal("GtkShortcutControllerProps"),
        behaviors: [
            addRemoveSlot<Gtk.Shortcut, Gtk.ShortcutController>(
                "shortcuts",
                "GtkShortcut",
                (controller, shortcut) => {
                    controller.addShortcut(shortcut);
                },
                (controller, shortcut) => {
                    controller.removeShortcut(shortcut);
                },
            ),
        ],
    },
    GtkTextView: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.TextView, Gtk.TextBuffer>("children", "GtkTextBuffer", {
                attach: (view, buffer) => view.setBuffer(buffer),
                detach: (view) => view.setBuffer(null),
            }),
        ],
    },
    GActionMap: {
        props: internal("GActionMapProps"),
        behaviors: [
            slot<Gio.ActionMap, Gio.Action>("actions", "GAction", {
                attach: (map, action) => map.addAction(action),
                detach: (map, _action, info) => map.removeAction((info.props.name as string | null) ?? ""),
            }),
        ],
    },
    GMenu: {
        props: internal("GMenuProps"),
        behaviors: [
            list<Gio.Menu, MenuItem>("items", {
                clear: (menu) => menu.removeAll(),
                add: (menu, item) => appendMenuItem(menu, item),
            }),
        ],
    },
    GtkColumnView: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.ColumnView, Gtk.ColumnViewColumn>("children", "GtkColumnViewColumn", {
                attach: (view, column, info) => view.insertColumn(info.index, column),
                detach: (view, column) => view.removeColumn(column),
            }),
        ],
    },
    GtkGrid: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.Grid, Gtk.Widget>("children", "GtkWidget", {
                attach: (grid, child) => grid.attach(child, 0, 0, 1, 1),
                detach: (grid, child) => grid.remove(child),
                resolve: layoutChild,
            }),
        ],
    },
    GtkFixed: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.Fixed, Gtk.Widget>("children", "GtkWidget", {
                attach: (fixed, child) => fixed.put(child, 0, 0),
                detach: (fixed, child) => fixed.remove(child),
                resolve: layoutChild,
            }),
        ],
    },
    GtkSizeGroup: {
        props: internal("GtkSizeGroupProps"),
        behaviors: [
            list<Gtk.SizeGroup, Gtk.Widget>("widgets", {
                add: (group, widget) => group.addWidget(widget),
                remove: (group, widget) => group.removeWidget(widget),
            }),
        ],
    },
    GtkConstraintLayout: {
        props: internal("GtkConstraintLayoutProps"),
        behaviors: [
            addRemoveSlot<Gtk.Constraint, Gtk.ConstraintLayout>(
                "constraints",
                "GtkConstraint",
                (layout, constraint) => {
                    layout.addConstraint(constraint);
                },
                (layout, constraint) => {
                    layout.removeConstraint(constraint);
                },
            ),
            addRemoveSlot<Gtk.ConstraintGuide, Gtk.ConstraintLayout>(
                "guides",
                "GtkConstraintGuide",
                (layout, guide) => {
                    layout.addGuide(guide);
                },
                (layout, guide) => {
                    layout.removeGuide(guide);
                },
            ),
            list<Gtk.ConstraintLayout, VflConstraints, Gtk.Constraint[]>("vfl", {
                add: (layout, item) => [
                    ...layout.addConstraintsFromDescription(
                        item.lines,
                        item.hspacing ?? 0,
                        item.vspacing ?? 0,
                        item.views ?? new Map(),
                    ),
                ],
                remove: (layout, _item, constraints) => {
                    for (const constraint of constraints) layout.removeConstraint(constraint);
                },
            }),
        ],
    },
    GtkStack: {
        props: internal("ChildrenProps"),
        behaviors: [
            adoptedChildrenSlot<Gtk.Stack, Gtk.Widget>(
                "GtkWidget",
                (stack, child) => stack.addChild(child),
                (stack, child) => {
                    stack.remove(child);
                },
            ),
            deferred<Gtk.Stack, string>("visibleChildName", (stack, name) => stack.getChildByName(name) !== null),
        ],
    },
    GtkNotebook: {
        props: internal("ChildrenProps"),
        behaviors: [
            slot<Gtk.Notebook, Gtk.Widget>("children", "GtkWidget", {
                attach: (notebook, child, info) => notebook.insertPage(child, null, info.index),
                reorder: (notebook, child, info) => notebook.reorderChild(child, info.index),
                detach: (notebook, child) => notebook.detachTab(child),
                resolve: (notebook, child) => notebook.getPage(child),
            }),
        ],
    },
    GtkApplication: {
        props: internal("GtkApplicationProps"),
        component: internal("createApplicationComponent"),
        behaviors: [
            addRemoveSlot<Gtk.Window, Gtk.Application>(
                "children",
                "GtkWindow",
                (application, window) => {
                    application.addWindow(window);
                },
                (application, window) => {
                    application.removeWindow(window);
                },
            ),
            list<Gtk.Application, ActionAccel>("actionAccels", {
                add: (application, item) => application.setAccelsForAction(item.detailedActionName, item.accels),
                remove: (application, item) => application.setAccelsForAction(item.detailedActionName, []),
            }),
        ],
    },
    GtkAboutDialog: {
        props: internal("GtkAboutDialogProps"),
        behaviors: [
            list<Gtk.AboutDialog, CreditSection>("creditSections", {
                add: (dialog, section) => dialog.addCreditSection(section.sectionName, section.people),
            }),
        ],
    },
    GtkScale: {
        props: internal("GtkScaleProps"),
        behaviors: [
            list<Gtk.Scale, ScaleMark>("marks", {
                add: (scale, mark) => scale.addMark(mark.value ?? 0, mark.position, mark.markup ?? null),
                clear: (scale) => scale.clearMarks(),
            }),
        ],
    },
    GtkCalendar: {
        props: internal("GtkCalendarProps"),
        behaviors: [
            list<Gtk.Calendar, number>("markedDays", {
                add: (calendar, day) => calendar.markDay(day),
                clear: (calendar) => calendar.clearMarks(),
            }),
        ],
    },
    GtkLevelBar: {
        props: internal("GtkLevelBarProps"),
        behaviors: [
            list<Gtk.LevelBar, LevelBarOffset>("offsets", {
                add: (bar, offset) => bar.addOffsetValue(offset.name, offset.value ?? 0),
                remove: (bar, offset) => bar.removeOffsetValue(offset.name),
            }),
        ],
    },
    GtkDropTarget: {
        props: internal("GtkDropTargetProps"),
        behaviors: [
            value<Gtk.DropTarget, GObject.Type[]>("types", (target, types) => {
                target.setGtypes(types);
            }),
        ],
    },
    GtkDrawingArea: {
        props: internal("GtkDrawingAreaProps"),
        behaviors: [
            value<Gtk.DrawingArea, Gtk.DrawingAreaDrawFunc>("drawFunc", (area, draw) => {
                area.setDrawFunc(draw);
                area.queueDraw();
            }),
        ],
    },
    GtkDragSource: {
        props: internal("GtkDragSourceProps"),
        behaviors: [
            value<Gtk.DragSource, DragSourceIcon>("icon", (source, icon) => {
                source.setIcon(icon.paintable ?? null, icon.hotX ?? 0, icon.hotY ?? 0);
            }),
        ],
    },
    GtkEditable: { behaviors: [controlledText("text")] },
};

export { addRemoveSlot, adoptedChildrenSlot, boxSlot, childSetterSlot, contentSetterSlot, deferred, list, slot };
