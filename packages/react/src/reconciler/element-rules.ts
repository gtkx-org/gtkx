import type { AdoptedElement, Call, ContainerProp, ElementProp } from "@gtkx/config";
import type * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import type { Props } from "./kinds.js";

/** Values available to a container behavior while attaching or moving one child. */
export type PlaceContext = { index: number; sibling: GObject.Object | null; props: Props };

/** Values available to a container behavior while detaching one child. */
export type DetachContext = { adopted: GObject.Object | null; props: Props };

/**
 * Imperative overrides for a container element prop. Any hook present here replaces the
 * declarative call of the same role, so a rule states its method names for codegen and its
 * behavior for the runtime in one entry.
 */
export type ContainerBehavior<P = GObject.Object, C = GObject.Object> = {
    attach?: (parent: P, child: C, context: PlaceContext) => unknown;
    detach?: (parent: P, child: C, context: DetachContext) => void;
    insert?: (parent: P, child: C, context: PlaceContext) => unknown;
    reorder?: (parent: P, child: C, context: PlaceContext) => unknown;
    resolve?: (parent: P, child: C) => GObject.Object | null;
};

const behaviors = new Map<string, ContainerBehavior>();

const behaviorKey = (type: string, prop: string): string => `${type}:${prop}`;

/** Returns the imperative behavior registered for a container prop, if any. */
export const behaviorFor = (type: string, prop: string): ContainerBehavior | undefined =>
    behaviors.get(behaviorKey(type, prop));

const withBehavior = <P extends GObject.Object, C extends GObject.Object>(
    type: string,
    rule: ElementProp,
    behavior: ContainerBehavior<P, C>,
): ElementProp => {
    if (rule.kind === "container") behaviors.set(behaviorKey(type, rule.prop), behavior as ContainerBehavior);
    return rule;
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

const nullSetter = (method: string): Call => ({ method, args: [{ literal: null }] });

const singleChild = (): ElementProp =>
    container("children", "GtkWidget", { append: "setChild", remove: nullSetter("setChild") });

const singleContent = (): ElementProp =>
    container("children", "GtkWidget", { append: "setContent", remove: nullSetter("setContent") });

const boxChildren = (): ElementProp =>
    container("children", "GtkWidget", {
        append: "append",
        remove: "remove",
        insert: { method: "insertChildAfter", args: ["child", "sibling"] },
        reorder: { method: "reorderChildAfter", args: ["child", "sibling"] },
    });

const indexedChildren = (append: string, reorder?: string): ElementProp =>
    container("children", "GtkWidget", {
        append,
        remove: "remove",
        insert: { method: "insert", args: ["child", "index"] },
        ...(reorder !== undefined ? { reorder: { method: reorder, args: ["child", "index"] } } : {}),
    });

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

const autowrapProp = (wrapper: string): ElementProp =>
    container("children", "GtkWidget", {
        append: "append",
        remove: "remove",
        insert: { method: "insert", args: ["child", "index"] },
        autowrap: wrapper,
    });

const linkedMenu = (method: string, link: string): Call => ({
    method,
    args: [
        { field: "label", or: null },
        { build: "GMenu", prop: "items", from: link },
    ],
    when: link,
});

const forEach = (types: string[], build: () => ElementProp[]): Record<string, ElementProp[]> =>
    Object.fromEntries(types.map((type) => [type, build()]));

const CONTROLLER_METHODS = { append: "addController", remove: "removeController" } satisfies ManyMethods;
const SHORTCUT_METHODS = { append: "addShortcut", remove: "removeShortcut" } satisfies ManyMethods;

const ACTION_METHODS = {
    append: "addAction",
    remove: { method: "removeAction", args: [{ prop: "name" }] },
} satisfies ManyMethods;

const ACTION_GROUP_METHODS = {
    append: { method: "insertActionGroup", args: [{ prop: "prefix" }, "child"] },
    remove: { method: "insertActionGroup", args: [{ prop: "prefix" }, { literal: null }] },
} satisfies ManyMethods;

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
    ...forEach(SINGLE_CHILD_TYPES, () => [singleChild()]),
    ...forEach(SINGLE_CONTENT_TYPES, () => [singleContent()]),
    ...forEach(BOX_TYPES, () => [boxChildren()]),
    ...forEach(ADD_REMOVE_TYPES, () => [addRemoveChildren()]),
    GtkWidget: [
        container("controllers", "GtkEventController", CONTROLLER_METHODS),
        container("layoutManager", "GtkLayoutManager", {
            append: "setLayoutManager",
            remove: { method: "setLayoutManager", args: [{ literal: null }] },
        }),
        container("actionGroups", "GActionGroup", ACTION_GROUP_METHODS),
    ],
    GtkShortcutController: [container("shortcuts", "GtkShortcut", SHORTCUT_METHODS)],
    GtkTextView: [
        container("children", "GtkTextBuffer", {
            append: "setBuffer",
            remove: { method: "setBuffer", args: [{ literal: null }] },
        }),
        container("children", "GtkWidget", { remove: "remove" }),
    ],
    GActionMap: [container("actions", "GAction", ACTION_METHODS)],
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
        container("children", "GtkColumnViewColumn", {
            append: "appendColumn",
            remove: "removeColumn",
            insert: { method: "insertColumn", args: ["index", "child"] },
        }),
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
        singleContent(),
    ],
    AdwCarousel: [indexedChildren("append", "reorder")],
    AdwPreferencesPage: [indexedChildren("add")],
    AdwTabView: [
        container("children", "GtkWidget", {
            append: "append",
            insert: { method: "insert", args: ["child", "index"] },
            reorder: { method: "reorderPage", args: ["adopted", "index"] },
            remove: { method: "closePage", args: ["adopted"] },
            adopt: "getPage",
        }),
    ],
    GtkListBox: [autowrapProp("GtkListBoxRow")],
    GtkFlowBox: [autowrapProp("GtkFlowBoxChild")],
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
