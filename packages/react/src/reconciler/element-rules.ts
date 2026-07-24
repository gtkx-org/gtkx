import type { AdoptedElement, Call, ContainerProp, ElementProp } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
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

const behaviors = new Map<string, ContainerBehavior>();

const behaviorKey = (type: string, prop: string, child: string): string => `${type}:${prop}:${child}`;

/** Returns the imperative behavior registered for a container prop and child type, if any. */
export const behaviorFor = (type: string, prop: string, child: string): ContainerBehavior | undefined =>
    behaviors.get(behaviorKey(type, prop, child));

const withBehavior = <P extends GObject.Object, C extends GObject.Object, CP = Props>(
    type: string,
    rule: ElementProp,
    behavior: ContainerBehavior<P, C, CP>,
): ElementProp => {
    if (rule.kind === "container")
        behaviors.set(behaviorKey(type, rule.prop, rule.child), behavior as ContainerBehavior);
    return rule;
};

type TabViewLike = GObject.Object & {
    append: (child: Gtk.Widget) => GObject.Object;
    insert: (child: Gtk.Widget, position: number) => GObject.Object;
    reorderPage: (page: GObject.Object, position: number) => boolean;
    closePage: (page: GObject.Object) => void;
    getPage: (child: Gtk.Widget) => GObject.Object;
};

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

type ChildSetter = GObject.Object & { setChild: (child: Gtk.Widget | null) => void };

type ContentSetter = GObject.Object & { setContent: (content: Gtk.Widget | null) => void };

type BoxLike = GObject.Object & {
    append: (child: Gtk.Widget) => void;
    remove: (child: Gtk.Widget) => void;
    insertChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
    reorderChildAfter: (child: Gtk.Widget, sibling: Gtk.Widget | null) => void;
};

type IndexedLike = GObject.Object & {
    remove: (child: Gtk.Widget) => void;
    insert: (child: Gtk.Widget, position: number) => void;
};

const singleChild = (type: string): ElementProp =>
    withBehavior<ChildSetter, Gtk.Widget>(
        type,
        container("children", "GtkWidget", { append: "setChild", remove: "setChild" }),
        {
            attach: (parent, child) => parent.setChild(child),
            detach: (parent) => parent.setChild(null),
        },
    );

const singleContent = (type: string): ElementProp =>
    withBehavior<ContentSetter, Gtk.Widget>(
        type,
        container("children", "GtkWidget", { append: "setContent", remove: "setContent" }),
        {
            attach: (parent, child) => parent.setContent(child),
            detach: (parent) => parent.setContent(null),
        },
    );

const boxChildren = (type: string): ElementProp =>
    withBehavior<BoxLike, Gtk.Widget>(
        type,
        container("children", "GtkWidget", {
            append: "append",
            remove: "remove",
            insert: "insertChildAfter",
            reorder: "reorderChildAfter",
        }),
        {
            attach: (box, child) => box.append(child),
            detach: (box, child) => box.remove(child),
            insert: (box, child, { sibling }) => box.insertChildAfter(child, sibling),
            reorder: (box, child, { sibling }) => box.reorderChildAfter(child, sibling),
        },
    );

const autowrapChildren = (type: string, wrapper: string): ElementProp =>
    withBehavior<IndexedLike & { append: (child: Gtk.Widget) => void }, Gtk.Widget>(
        type,
        container("children", "GtkWidget", {
            append: "append",
            remove: "remove",
            insert: "insert",
            autowrap: wrapper,
        }),
        {
            attach: (parent, child) => parent.append(child),
            detach: (parent, child) => parent.remove(child),
            insert: (parent, child, { index }) => parent.insert(child, index),
        },
    );

const addRemoveChildren = (): ElementProp => container("children", "GtkWidget", { append: "add", remove: "remove" });

const prefixSuffixProps = (): ElementProp[] => [
    container("prefix", "GtkWidget", { append: "addPrefix" }),
    container("suffix", "GtkWidget", { append: "addSuffix" }),
];

const packProps = (): ElementProp[] => [
    container("start", "GtkWidget", { append: "packStart" }),
    container("end", "GtkWidget", { append: "packEnd" }),
];

const adopts = (element: string): AdoptedElement => ({ element });

const linkedMenu = (method: string, link: string): Call => ({
    method,
    args: [
        { field: "label", or: null },
        { build: "GMenu", prop: "items", from: link },
    ],
    when: link,
});

const forEach = (types: string[], build: (type: string) => ElementProp[]): Record<string, ElementProp[]> =>
    Object.fromEntries(types.map((type) => [type, build(type)]));

const CONTROLLER_METHODS = { append: "addController", remove: "removeController" } satisfies ManyMethods;
const SHORTCUT_METHODS = { append: "addShortcut", remove: "removeShortcut" } satisfies ManyMethods;

type LayoutManagerHost = GObject.Object & { setLayoutManager: (manager: GObject.Object | null) => void };

type BufferHost = GObject.Object & { setBuffer: (buffer: GObject.Object | null) => void };

type ColumnViewLike = GObject.Object & {
    appendColumn: (column: GObject.Object) => void;
    removeColumn: (column: GObject.Object) => void;
    insertColumn: (position: number, column: GObject.Object) => void;
};

type ActionMapLike = GObject.Object & {
    addAction: (action: GObject.Object) => void;
    removeAction: (name: string) => void;
};

type ActionGroupHost = GObject.Object & {
    insertActionGroup: (prefix: string, group: GObject.Object | null) => void;
};

/** Placement props contributed to every element usable as a `GActionGroup` child. */
export type ActionGroupPlacement = { prefix?: string };

type ActionPlacement = { name?: string };

const SINGLE_CHILD_TYPES = [
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

const SINGLE_CONTENT_TYPES = [
    "AdwApplicationWindow",
    "AdwBottomSheet",
    "AdwFlap",
    "AdwNavigationSplitView",
    "AdwOverlaySplitView",
    "AdwWindow",
];

const BOX_TYPES = ["AdwLeaflet", "AdwWrapBox", "GtkBox"];

const ADD_REMOVE_TYPES = [
    "AdwNavigationView",
    "AdwPreferencesDialog",
    "AdwPreferencesGroup",
    "AdwPreferencesWindow",
    "AdwSqueezer",
];

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
    ...forEach(SINGLE_CHILD_TYPES, (type) => [singleChild(type)]),
    ...forEach(SINGLE_CONTENT_TYPES, (type) => [singleContent(type)]),
    ...forEach(BOX_TYPES, (type) => [boxChildren(type)]),
    ...forEach(ADD_REMOVE_TYPES, () => [addRemoveChildren()]),
    GtkWidget: [
        container("controllers", "GtkEventController", CONTROLLER_METHODS),
        withBehavior<LayoutManagerHost, GObject.Object>(
            "GtkWidget",
            container("layoutManager", "GtkLayoutManager", { append: "setLayoutManager", remove: "setLayoutManager" }),
            {
                attach: (widget, manager) => widget.setLayoutManager(manager),
                detach: (widget) => widget.setLayoutManager(null),
            },
        ),
        withBehavior<ActionGroupHost, GObject.Object, ActionGroupPlacement>(
            "GtkWidget",
            container("actionGroups", "GActionGroup", {
                append: "insertActionGroup",
                remove: "insertActionGroup",
                childProps: "ActionGroupPlacement",
            }),
            {
                attach: (widget, group, { props }) => widget.insertActionGroup(props.prefix ?? "", group),
                detach: (widget, _group, { props }) => widget.insertActionGroup(props.prefix ?? "", null),
            },
        ),
    ],
    GtkShortcutController: [container("shortcuts", "GtkShortcut", SHORTCUT_METHODS)],
    GtkTextView: [
        withBehavior<BufferHost, GObject.Object>(
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
        withBehavior<ActionMapLike, GObject.Object, ActionPlacement>(
            "GActionMap",
            container("actions", "GAction", { append: "addAction", remove: "removeAction" }),
            {
                attach: (map, action) => map.addAction(action),
                detach: (map, _action, { props }) => map.removeAction(props.name ?? ""),
            },
        ),
    ],
    GMenu: [
        {
            kind: "list",
            prop: "items",
            clear: "removeAll",
            add: [
                linkedMenu("appendSubmenu", "submenu"),
                linkedMenu("appendSection", "section"),
                {
                    method: "append",
                    args: [
                        { field: "label", or: null },
                        { field: "action", or: null },
                    ],
                    unless: ["submenu", "section"],
                },
            ],
        },
    ],
    GtkColumnView: [
        withBehavior<ColumnViewLike, GObject.Object>(
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
        singleChild("GtkOverlay"),
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
        singleContent("AdwToolbarView"),
    ],
    AdwCarousel: [
        withBehavior<
            IndexedLike & {
                append: (child: Gtk.Widget) => void;
                reorder: (child: Gtk.Widget, position: number) => void;
            },
            Gtk.Widget
        >(
            "AdwCarousel",
            container("children", "GtkWidget", {
                append: "append",
                remove: "remove",
                insert: "insert",
                reorder: "reorder",
            }),
            {
                attach: (carousel, child) => carousel.append(child),
                detach: (carousel, child) => carousel.remove(child),
                insert: (carousel, child, { index }) => carousel.insert(child, index),
                reorder: (carousel, child, { index }) => carousel.reorder(child, index),
            },
        ),
    ],
    AdwPreferencesPage: [
        withBehavior<IndexedLike & { add: (child: Gtk.Widget) => void }, Gtk.Widget>(
            "AdwPreferencesPage",
            container("children", "GtkWidget", { append: "add", remove: "remove", insert: "insert" }),
            {
                attach: (page, child) => page.add(child),
                detach: (page, child) => page.remove(child),
                insert: (page, child, { index }) => page.insert(child, index),
            },
        ),
    ],
    AdwTabView: [
        withBehavior<TabViewLike, Gtk.Widget>(
            "AdwTabView",
            container("children", "GtkWidget", {
                append: "append",
                insert: "insert",
                reorder: "reorderPage",
                remove: "closePage",
                adopt: "getPage",
            }),
            {
                attach: (view, child) => view.append(child),
                insert: (view, child, { index }) => view.insert(child, index),
                reorder: (view, _child, { adopted, index }) => {
                    if (adopted !== null) view.reorderPage(adopted, index);
                },
                detach: (view, _child, { adopted }) => {
                    if (adopted !== null) view.closePage(adopted);
                },
                resolve: (view, child) => view.getPage(child),
            },
        ),
    ],
    GtkListBox: [autowrapChildren("GtkListBox", "GtkListBoxRow")],
    GtkFlowBox: [autowrapChildren("GtkFlowBox", "GtkFlowBoxChild")],
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
    GtkScale: [{ kind: "list", prop: "marks", add: "addMark", clear: "clearMarks" }],
    GtkCalendar: [{ kind: "list", prop: "markedDays", add: "markDay", clear: "clearMarks" }],
    GtkLevelBar: [{ kind: "list", prop: "offsets", add: "addOffsetValue", remove: "removeOffsetValue" }],
    GtkApplication: [
        container("children", "GtkWindow", { append: "addWindow", remove: "removeWindow" }),
        {
            kind: "list",
            prop: "actionAccels",
            add: "setAccelsForAction",
            remove: { method: "setAccelsForAction", args: [{ field: "detailedActionName" }, { literal: [] }] },
        },
    ],
    GtkAboutDialog: [{ kind: "list", prop: "creditSections", add: "addCreditSection" }],
    AdwAlertDialog: [
        {
            kind: "list",
            prop: "responses",
            add: [
                "addResponse",
                {
                    method: "setResponseAppearance",
                    args: [{ field: "id" }, { field: "appearance", or: 0 }],
                    when: "appearance",
                },
                {
                    method: "setResponseEnabled",
                    args: [{ field: "id" }, { field: "enabled", or: true }],
                    when: "enabled",
                },
            ],
            remove: "removeResponse",
        },
    ],
});
