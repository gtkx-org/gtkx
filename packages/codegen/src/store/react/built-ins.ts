import type { Call, ContainerProp, ElementProp } from "@gtkx/config";

export type ElementComponentName = "createWindowComponent" | "createApplicationComponent";

type ElementComponent = { types: string[]; componentName: ElementComponentName };
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

const indexedChildren = (append: string): ElementProp =>
    container("children", "GtkWidget", {
        append,
        remove: "remove",
        insert: { method: "insert", args: ["child", "index"] },
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

const autowrapProp = (wrapper: string): ElementProp =>
    container("children", "GtkWidget", {
        append: "append",
        remove: "remove",
        insert: { method: "insert", args: ["child", "index"] },
        autowrap: wrapper,
    });

const forEach = (types: string[], build: () => ElementProp[]): Record<string, ElementProp[]> =>
    Object.fromEntries(types.map((type) => [type, build()]));

export const BUILT_IN_ELEMENT_COMPONENTS: ElementComponent[] = [
    { types: ["GtkApplication"], componentName: "createApplicationComponent" },
    { types: ["GtkWindow"], componentName: "createWindowComponent" },
];

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

export const BUILT_IN_ELEMENT_PROPS: Record<string, ElementProp[]> = withBreakpoints({
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
    GActionMap: [container("children", "GAction", ACTION_METHODS)],
    GtkApplicationWindow: [container("actions", "GAction", ACTION_METHODS)],
    GtkColumnView: [
        container("children", "GtkColumnViewColumn", {
            append: "appendColumn",
            remove: "removeColumn",
            insert: { method: "insertColumn", args: ["index", "child"] },
        }),
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
    AdwCarousel: [indexedChildren("append")],
    AdwPreferencesPage: [indexedChildren("add")],
    AdwTabView: [
        container("children", "GtkWidget", {
            append: "append",
            insert: { method: "insert", args: ["child", "index"] },
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
        container("children", "GtkWidget", {
            append: { method: "appendPage", args: ["child", { literal: null }] },
            insert: { method: "insertPage", args: ["child", { literal: null }, "index"] },
            remove: "detachTab",
            adopt: "getPage",
        }),
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
});
