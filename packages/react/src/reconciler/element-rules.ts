import type { AdoptedElement, ContainerProp, ElementProp } from "@gtkx/config";
import type * as Gio from "@gtkx/gi/gio";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type {
    ActionAccel,
    CreditSection,
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
 * Imperative overrides for a container element prop. Any hook present here replaces the
 * declarative call of the same role, so a rule states its method names for codegen and its
 * behavior for the runtime in one entry.
 */
export type ContainerBehavior<P = GObject.Object, C = GObject.Object, CP = Props> = {
    attach?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    detach?: (parent: P, child: C, context: DetachContext<CP>) => void;
    insert?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    reorder?: (parent: P, child: C, context: PlaceContext<C, CP>) => unknown;
    resolve?: (parent: P, child: C) => GObject.Object | null;
};

/** Imperative overrides for a list element prop, replacing the declarative call of the same role. */
export type ListBehavior<P = GObject.Object, I = unknown> = {
    add?: (parent: P, item: I) => void;
    remove?: (parent: P, item: I) => void;
    clear?: (parent: P) => void;
};

const behaviors = new Map<string, ContainerBehavior>();

const listBehaviors = new Map<string, ListBehavior>();

const listKey = (type: string, prop: string): string => `${type}:${prop}`;

/** Returns the imperative behavior registered for a list prop, if any. */
export const listBehaviorFor = (type: string, prop: string): ListBehavior | undefined =>
    listBehaviors.get(listKey(type, prop));

const withListBehavior = <P extends GObject.Object, I>(
    type: string,
    rule: ElementProp,
    behavior: ListBehavior<P, I>,
): ElementProp => {
    if (rule.kind === "list") listBehaviors.set(listKey(type, rule.prop), behavior as ListBehavior);
    return rule;
};

const behaviorKey = (type: string, prop: string, child: string): string => `${type}:${prop}:${child}`;

/** Returns the imperative behavior registered for a container prop and child type, if any. */
export const behaviorFor = (type: string, prop: string, child: string): ContainerBehavior | undefined =>
    behaviors.get(behaviorKey(type, prop, child));

/** Registers a container behavior for each of `types` under the same prop and child type. */
export const registerBehavior = <P extends GObject.Object, C extends GObject.Object, CP = Props>(
    types: string[],
    prop: string,
    child: string,
    behavior: ContainerBehavior<P, C, CP>,
): void => {
    for (const type of types) behaviors.set(behaviorKey(type, prop, child), behavior as ContainerBehavior);
};

/** Registers a list behavior for a prop on `type`. */
export const registerListBehavior = <P extends GObject.Object, I>(
    type: string,
    prop: string,
    behavior: ListBehavior<P, I>,
): void => {
    listBehaviors.set(listKey(type, prop), behavior as ListBehavior);
};

/** Behavior for a container that installs its single child with `setChild`. */
export const childSetterBehavior = <
    P extends GObject.Object & { setChild: (child: Gtk.Widget | null) => void },
>(): ContainerBehavior<P, Gtk.Widget> => ({
    attach: (parent, child) => parent.setChild(child),
    detach: (parent) => parent.setChild(null),
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
    P extends GObject.Object & {
        append: (child: Gtk.Widget) => unknown;
        remove: (child: Gtk.Widget) => void;
        insert: (child: Gtk.Widget, position: number) => unknown;
    },
>(): ContainerBehavior<P, Gtk.Widget> => ({
    attach: (parent, child) => parent.append(child),
    detach: (parent, child) => parent.remove(child),
    insert: (parent, child, { index }) => parent.insert(child, index),
});

const withBehavior = <P extends GObject.Object, C extends GObject.Object, CP = Props>(
    type: string,
    rule: ElementProp,
    behavior: ContainerBehavior<P, C, CP>,
): ElementProp => {
    if (rule.kind === "container")
        behaviors.set(behaviorKey(type, rule.prop, rule.child), behavior as ContainerBehavior);
    return rule;
};

const buildMenu = (items: MenuItem[], create: () => Gio.Menu): Gio.Menu => {
    const menu = create();
    for (const item of items) appendMenuItem(menu, item);
    return menu;
};

let createMenu: () => Gio.Menu = () => {
    throw new Error("GMenu construction is not available");
};

/** Installs the factory used to build nested `GMenu` instances for submenus and sections. */
export const setMenuFactory = (factory: () => GObject.Object): void => {
    createMenu = factory as () => Gio.Menu;
};

function appendMenuItem(menu: Gio.Menu, item: MenuItem): void {
    if (item.submenu !== undefined) menu.appendSubmenu(item.label ?? null, buildMenu(item.submenu, createMenu));
    else if (item.section !== undefined) menu.appendSection(item.label ?? null, buildMenu(item.section, createMenu));
    else menu.append(item.label ?? null, item.action ?? null);
}

const layoutChild = (parent: Gtk.Widget, child: Gtk.Widget): GObject.Object | null =>
    parent.getLayoutManager()?.getLayoutChild(child) ?? null;

type ManyMethods = Pick<ContainerProp, "append" | "remove">;

const container = (
    prop: string,
    child: string,
    methods: Omit<ContainerProp, "kind" | "prop" | "child">,
): ElementProp => ({
    kind: "container",
    prop,
    child,
    ...methods,
});

const singleChild = (): ElementProp => container("children", "GtkWidget", { append: "setChild", remove: "setChild" });

const singleContent = (child: string): ElementProp =>
    container("children", child, { append: "setContent", remove: "setContent" });

const boxChildren = (): ElementProp =>
    container("children", "GtkWidget", {
        append: "append",
        remove: "remove",
        insert: "insertChildAfter",
        reorder: "reorderChildAfter",
    });

const autowrapChildren = (wrapper: string): ElementProp =>
    container("children", "GtkWidget", {
        append: "append",
        remove: "remove",
        insert: "insert",
        autowrap: wrapper,
    });

const addRemoveChildren = (child: string): ElementProp =>
    container("children", child, { append: "add", remove: "remove" });

const prefixSuffixProps = (): ElementProp[] => [
    container("prefix", "GtkWidget", { append: "addPrefix" }),
    container("suffix", "GtkWidget", { append: "addSuffix" }),
];

const packProps = (): ElementProp[] => [
    container("start", "GtkWidget", { append: "packStart" }),
    container("end", "GtkWidget", { append: "packEnd" }),
];

const adopts = (element: string): AdoptedElement => ({ element });

const forEach = (types: string[], build: (type: string) => ElementProp[]): Record<string, ElementProp[]> =>
    Object.fromEntries(types.map((type) => [type, build(type)]));

const CONTROLLER_METHODS = { append: "addController", remove: "removeController" } satisfies ManyMethods;
const SHORTCUT_METHODS = { append: "addShortcut", remove: "removeShortcut" } satisfies ManyMethods;

const vflConstraints = new WeakMap<VflConstraints, Gtk.Constraint[]>();

type ActionPlacement = { name?: string };

/** Adwaita types whose single child is installed with `setChild`; behaviors come from `@gtkx/react/adw`. */
export const ADW_SINGLE_CHILD_TYPES: string[] = [
    "AdwBin",
    "AdwBreakpointBin",
    "AdwClamp",
    "AdwClampScrollable",
    "AdwDialog",
    "AdwNavigationPage",
    "AdwSplitButton",
    "AdwStatusPage",
    "AdwTabOverview",
    "AdwToastOverlay",
    "AdwToggle",
];

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

const SINGLE_CHILD_TYPES = [...ADW_SINGLE_CHILD_TYPES, ...GTK_SINGLE_CHILD_TYPES];

/** Adwaita types whose single child is installed with `setContent`; behaviors come from `@gtkx/react/adw`. */
export const ADW_SINGLE_CONTENT_TYPES: string[] = [
    "AdwApplicationWindow",
    "AdwBottomSheet",
    "AdwFlap",
    "AdwOverlaySplitView",
    "AdwWindow",
    "AdwToolbarView",
];

/** Adwaita types laid out like a `GtkBox`; behaviors come from `@gtkx/react/adw`. */
export const ADW_BOX_TYPES: string[] = ["AdwLeaflet", "AdwWrapBox"];

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

registerBehavior(
    [...GTK_SINGLE_CHILD_TYPES, "GtkOverlay"],
    "children",
    "GtkWidget",
    childSetterBehavior<GtkChildSetter>(),
);

registerBehavior(["GtkBox"], "children", "GtkWidget", boxBehavior<Gtk.Box>());

registerBehavior(["GtkListBox", "GtkFlowBox"], "children", "GtkWidget", indexedBehavior<Gtk.ListBox | Gtk.FlowBox>());

const ADD_REMOVE_CHILDREN: Record<string, string> = {
    AdwNavigationView: "AdwNavigationPage",
    AdwPreferencesDialog: "AdwPreferencesPage",
    AdwPreferencesGroup: "GtkWidget",
    AdwPreferencesWindow: "AdwPreferencesPage",
    AdwSqueezer: "GtkWidget",
};

const withBreakpoints = (props: Record<string, ElementProp[]>): Record<string, ElementProp[]> => {
    for (const type of ["AdwApplicationWindow", "AdwWindow", "AdwDialog"]) {
        props[type] = [...(props[type] ?? []), container("breakpoints", "AdwBreakpoint", { append: "addBreakpoint" })];
    }
    props.AdwBreakpointBin = [
        ...(props.AdwBreakpointBin ?? []),
        container("breakpoints", "AdwBreakpoint", { append: "addBreakpoint", remove: "removeBreakpoint" }),
    ];
    return props;
};

export const ELEMENT_RULES: Record<string, ElementProp[]> = withBreakpoints({
    ...forEach(SINGLE_CHILD_TYPES, () => [singleChild()]),
    ...forEach(ADW_SINGLE_CONTENT_TYPES, () => [singleContent("GtkWidget")]),
    ...forEach([...ADW_BOX_TYPES, "GtkBox"], () => [boxChildren()]),
    ...forEach(Object.keys(ADD_REMOVE_CHILDREN), (type) => [
        addRemoveChildren(ADD_REMOVE_CHILDREN[type] ?? "GtkWidget"),
    ]),
    AdwNavigationSplitView: [singleContent("AdwNavigationPage")],
    GtkWidget: [
        container("controllers", "GtkEventController", CONTROLLER_METHODS),
        withBehavior<Gtk.Widget, Gtk.LayoutManager>(
            "GtkWidget",
            container("layoutManager", "GtkLayoutManager", { append: "setLayoutManager", remove: "setLayoutManager" }),
            {
                attach: (widget, manager) => widget.setLayoutManager(manager),
                detach: (widget) => widget.setLayoutManager(null),
            },
        ),
        withBehavior<Gtk.Widget, Gio.ActionGroup, GActionGroupElementProps>(
            "GtkWidget",
            container("actionGroups", "GActionGroup", {
                append: "insertActionGroup",
                remove: "insertActionGroup",
                childProps: ["prefix"],
            }),
            {
                attach: (widget, group, { props }) => widget.insertActionGroup(props.prefix ?? "", group),
                detach: (widget, _group, { props }) => widget.insertActionGroup(props.prefix ?? "", null),
            },
        ),
    ],
    GtkShortcutController: [container("shortcuts", "GtkShortcut", SHORTCUT_METHODS)],
    GtkTextView: [
        withBehavior<Gtk.TextView, Gtk.TextBuffer>(
            "GtkTextView",
            container("children", "GtkTextBuffer", { append: "setBuffer", remove: "setBuffer" }),
            {
                attach: (view, buffer) => view.setBuffer(buffer),
                detach: (view) => view.setBuffer(null),
            },
        ),
        container("children", "GtkWidget", { remove: "remove" }),
    ],
    GActionMap: [
        withBehavior<Gio.ActionMap, Gio.Action, ActionPlacement>(
            "GActionMap",
            container("actions", "GAction", { append: "addAction", remove: "removeAction" }),
            {
                attach: (map, action) => map.addAction(action),
                detach: (map, _action, { props }) => map.removeAction(props.name ?? ""),
            },
        ),
    ],
    GMenu: [
        withListBehavior<Gio.Menu, MenuItem>(
            "GMenu",
            { kind: "list", prop: "items", itemType: "MenuItem", clear: "removeAll", add: "append" },
            {
                clear: (menu) => menu.removeAll(),
                add: (menu, item) => appendMenuItem(menu, item),
            },
        ),
    ],
    GtkColumnView: [
        withBehavior<Gtk.ColumnView, Gtk.ColumnViewColumn>(
            "GtkColumnView",
            container("children", "GtkColumnViewColumn", {
                append: "appendColumn",
                remove: "removeColumn",
                insert: "insertColumn",
            }),
            {
                attach: (view, column) => view.appendColumn(column),
                detach: (view, column) => view.removeColumn(column),
                insert: (view, column, { index }) => view.insertColumn(index, column),
            },
        ),
    ],
    GtkGrid: [
        withBehavior<Gtk.Grid, Gtk.Widget>(
            "GtkGrid",
            container("children", "GtkWidget", { adopt: adopts("GtkGridLayoutChild") }),
            {
                attach: (grid, child) => grid.attach(child, 0, 0, 1, 1),
                detach: (grid, child) => grid.remove(child),
                resolve: layoutChild,
            },
        ),
    ],
    GtkFixed: [
        withBehavior<Gtk.Fixed, Gtk.Widget>(
            "GtkFixed",
            container("children", "GtkWidget", { adopt: adopts("GtkFixedLayoutChild") }),
            {
                attach: (fixed, child) => fixed.put(child, 0, 0),
                detach: (fixed, child) => fixed.remove(child),
                resolve: layoutChild,
            },
        ),
    ],
    GtkOverlay: [
        singleChild(),
        withBehavior<Gtk.Overlay, Gtk.Widget>(
            "GtkOverlay",
            container("overlays", "GtkWidget", { adopt: adopts("GtkOverlayLayoutChild") }),
            {
                attach: (overlay, child) => overlay.addOverlay(child),
                detach: (overlay, child) => overlay.removeOverlay(child),
                resolve: layoutChild,
            },
        ),
    ],
    GtkSizeGroup: [{ kind: "list", prop: "widgets", add: "addWidget", remove: "removeWidget" }],
    GtkConstraintLayout: [
        container("constraints", "GtkConstraint", { append: "addConstraint", remove: "removeConstraint" }),
        container("guides", "GtkConstraintGuide", { append: "addGuide", remove: "removeGuide" }),
        withListBehavior<Gtk.ConstraintLayout, VflConstraints>(
            "GtkConstraintLayout",
            { kind: "list", prop: "vfl", itemType: "VflConstraints", add: "addConstraintsFromDescription" },
            {
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
            },
        ),
    ],
    AdwShortcutsDialog: [container("children", "AdwShortcutsSection", { append: "add" })],
    AdwShortcutsSection: [container("children", "AdwShortcutsItem", { append: "add" })],
    AdwActionRow: prefixSuffixProps(),
    AdwEntryRow: prefixSuffixProps(),
    AdwExpanderRow: [
        ...prefixSuffixProps(),
        container("rows", "GtkWidget", { append: "addRow" }),
        container("actions", "GtkWidget", { append: "addAction" }),
    ],
    AdwHeaderBar: packProps(),
    GtkHeaderBar: packProps(),
    GtkActionBar: packProps(),
    AdwToolbarView: [
        container("topBar", "GtkWidget", { append: "addTopBar" }),
        container("bottomBar", "GtkWidget", { append: "addBottomBar" }),
        singleContent("GtkWidget"),
    ],
    AdwCarousel: [
        container("children", "GtkWidget", {
            append: "append",
            remove: "remove",
            insert: "insert",
            reorder: "reorder",
        }),
    ],
    AdwPreferencesPage: [
        container("children", "AdwPreferencesGroup", { append: "add", remove: "remove", insert: "insert" }),
    ],
    AdwTabView: [
        container("children", "GtkWidget", {
            append: "append",
            insert: "insert",
            reorder: "reorderPage",
            remove: "closePage",
            adopt: "getPage",
        }),
    ],
    GtkListBox: [autowrapChildren("GtkListBoxRow")],
    GtkFlowBox: [autowrapChildren("GtkFlowBoxChild")],
    GtkStack: [
        container("children", "GtkWidget", { append: "addChild", remove: "remove", adopt: true }),
        { kind: "lazy", prop: "visibleChildName", lookup: "getChildByName" },
    ],
    AdwViewStack: [
        container("children", "GtkWidget", { append: "add", remove: "remove", adopt: true }),
        { kind: "lazy", prop: "visibleChildName", lookup: "getChildByName" },
    ],
    GtkNotebook: [
        withBehavior<Gtk.Notebook, Gtk.Widget>(
            "GtkNotebook",
            container("children", "GtkWidget", { adopt: "getPage" }),
            {
                attach: (notebook, child) => notebook.appendPage(child, null),
                insert: (notebook, child, { index }) => notebook.insertPage(child, null, index),
                reorder: (notebook, child, { index }) => notebook.reorderChild(child, index),
                detach: (notebook, child) => notebook.detachTab(child),
                resolve: (notebook, child) => notebook.getPage(child),
            },
        ),
    ],
    AdwToggleGroup: [
        container("children", "AdwToggle", { append: "add", remove: "remove" }),
        { kind: "lazy", prop: "activeName", lookup: "getToggleByName" },
        { kind: "lazy", prop: "active" },
    ],
    GtkDropTarget: [{ kind: "value", prop: "types", call: "setGtypes" }],
    GtkDrawingArea: [{ kind: "value", prop: "drawFunc", call: "setDrawFunc", after: "queueDraw" }],
    GtkDragSource: [{ kind: "value", prop: "icon", call: "setIcon" }],
    GtkEditable: [{ kind: "controlled-text", prop: "text" }],
    GtkScale: [
        withListBehavior<Gtk.Scale, ScaleMark>(
            "GtkScale",
            { kind: "list", prop: "marks", add: "addMark", clear: "clearMarks" },
            {
                add: (scale, mark) => scale.addMark(mark.value ?? 0, mark.position, mark.markup ?? null),
                clear: (scale) => scale.clearMarks(),
            },
        ),
    ],
    GtkCalendar: [{ kind: "list", prop: "markedDays", add: "markDay", clear: "clearMarks" }],
    GtkLevelBar: [
        withListBehavior<Gtk.LevelBar, LevelBarOffset>(
            "GtkLevelBar",
            { kind: "list", prop: "offsets", add: "addOffsetValue", remove: "removeOffsetValue" },
            {
                add: (bar, offset) => bar.addOffsetValue(offset.name, offset.value ?? 0),
                remove: (bar, offset) => bar.removeOffsetValue(offset.name),
            },
        ),
    ],
    GtkApplication: [
        container("children", "GtkWindow", { append: "addWindow", remove: "removeWindow" }),
        withListBehavior<Gtk.Application, ActionAccel>(
            "GtkApplication",
            { kind: "list", prop: "actionAccels", add: "setAccelsForAction", remove: "setAccelsForAction" },
            {
                add: (app, item) => app.setAccelsForAction(item.detailedActionName, item.accels),
                remove: (app, item) => app.setAccelsForAction(item.detailedActionName, []),
            },
        ),
    ],
    GtkAboutDialog: [
        withListBehavior<Gtk.AboutDialog, CreditSection>(
            "GtkAboutDialog",
            { kind: "list", prop: "creditSections", add: "addCreditSection" },
            { add: (dialog, section) => dialog.addCreditSection(section.sectionName, section.people) },
        ),
    ],
    AdwAlertDialog: [
        {
            kind: "list",
            prop: "responses",
            itemKey: "id",
            add: ["addResponse", "setResponseAppearance", "setResponseEnabled"],
            remove: "removeResponse",
        },
    ],
});
