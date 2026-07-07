import type { Call, ContainerProp, ElementProp } from "@gtkx/config";

export type AncestryWrapperName =
    | "withWindowPresentation"
    | "withApplicationLifecycle"
    | "withApplicationWindowPresentation";

type AncestryWrapper = { ancestors: string[]; wrapper: AncestryWrapperName };

export const BUILT_IN_ANCESTRY_WRAPPERS: AncestryWrapper[] = [
    { ancestors: ["GtkApplication"], wrapper: "withApplicationLifecycle" },
    { ancestors: ["GtkApplicationWindow"], wrapper: "withApplicationWindowPresentation" },
    { ancestors: ["GtkWindow"], wrapper: "withWindowPresentation" },
];

type ManyMethods = Pick<ContainerProp, "append" | "remove">;

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

const forEach = (types: string[], build: () => ElementProp[]): Record<string, ElementProp[]> =>
    Object.fromEntries(types.map((type) => [type, build()]));

export const CURATED_ELEMENT_PROPS: Record<string, ElementProp[]> = {
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
    GtkDragSource: [
        {
            kind: "value",
            prop: "icon",
            call: {
                method: "setIcon",
                args: [
                    { field: "paintable", or: null },
                    { field: "hotX", or: 0 },
                    { field: "hotY", or: 0 },
                ],
            },
        },
    ],
    GtkEditable: [{ kind: "controlled-text", prop: "text" }],
    GtkScale: [{ kind: "list", prop: "marks", add: "addMark", clear: "clearMarks" }],
    GtkCalendar: [{ kind: "list", prop: "markedDays", add: "markDay", clear: "clearMarks" }],
    GtkLevelBar: [{ kind: "list", prop: "offsets", add: "addOffsetValue", remove: "removeOffsetValue" }],
    GtkApplication: [
        {
            kind: "list",
            prop: "actionAccels",
            add: "setAccelsForAction",
            remove: { method: "setAccelsForAction", args: [{ field: "detailedActionName" }, { literal: [] }] },
        },
    ],
    GtkAboutDialog: [{ kind: "list", prop: "creditSections", add: "addCreditSection" }],
};

type AccessibleAttributeKind = "property" | "state" | "relation";

type AccessibleAttributeValue = "string" | "boolean" | "int" | "double" | "object" | "ref-list";

type AccessibleAttribute = {
    kind: AccessibleAttributeKind;
    member: string;
    value: AccessibleAttributeValue;
    type: string;
};

export const ACCESSIBLE_ATTRIBUTES: Record<string, AccessibleAttribute> = {
    accessibleAutocomplete: {
        kind: "property",
        member: "AUTOCOMPLETE",
        value: "int",
        type: "Gtk.AccessibleAutocomplete",
    },
    accessibleDescription: { kind: "property", member: "DESCRIPTION", value: "string", type: "string" },
    accessibleHasPopup: { kind: "property", member: "HAS_POPUP", value: "boolean", type: "boolean" },
    accessibleKeyShortcuts: { kind: "property", member: "KEY_SHORTCUTS", value: "string", type: "string" },
    accessibleLabel: { kind: "property", member: "LABEL", value: "string", type: "string" },
    accessibleLevel: { kind: "property", member: "LEVEL", value: "int", type: "number" },
    accessibleModal: { kind: "property", member: "MODAL", value: "boolean", type: "boolean" },
    accessibleMultiLine: { kind: "property", member: "MULTI_LINE", value: "boolean", type: "boolean" },
    accessibleMultiSelectable: { kind: "property", member: "MULTI_SELECTABLE", value: "boolean", type: "boolean" },
    accessibleOrientation: { kind: "property", member: "ORIENTATION", value: "int", type: "Gtk.Orientation" },
    accessiblePlaceholder: { kind: "property", member: "PLACEHOLDER", value: "string", type: "string" },
    accessibleReadOnly: { kind: "property", member: "READ_ONLY", value: "boolean", type: "boolean" },
    accessibleRequired: { kind: "property", member: "REQUIRED", value: "boolean", type: "boolean" },
    accessibleRoleDescription: { kind: "property", member: "ROLE_DESCRIPTION", value: "string", type: "string" },
    accessibleSort: { kind: "property", member: "SORT", value: "int", type: "Gtk.AccessibleSort" },
    accessibleValueMax: { kind: "property", member: "VALUE_MAX", value: "double", type: "number" },
    accessibleValueMin: { kind: "property", member: "VALUE_MIN", value: "double", type: "number" },
    accessibleValueNow: { kind: "property", member: "VALUE_NOW", value: "double", type: "number" },
    accessibleValueText: { kind: "property", member: "VALUE_TEXT", value: "string", type: "string" },
    accessibleHelpText: { kind: "property", member: "HELP_TEXT", value: "string", type: "string" },
    accessibleBusy: { kind: "state", member: "BUSY", value: "boolean", type: "boolean" },
    accessibleChecked: { kind: "state", member: "CHECKED", value: "int", type: "Gtk.AccessibleTristate" },
    accessibleDisabled: { kind: "state", member: "DISABLED", value: "boolean", type: "boolean" },
    accessibleExpanded: { kind: "state", member: "EXPANDED", value: "int", type: "boolean" },
    accessibleHidden: { kind: "state", member: "HIDDEN", value: "boolean", type: "boolean" },
    accessibleInvalid: { kind: "state", member: "INVALID", value: "int", type: "Gtk.AccessibleInvalidState" },
    accessiblePressed: { kind: "state", member: "PRESSED", value: "int", type: "Gtk.AccessibleTristate" },
    accessibleSelected: { kind: "state", member: "SELECTED", value: "int", type: "boolean" },
    accessibleVisited: { kind: "state", member: "VISITED", value: "int", type: "boolean" },
    accessibleActiveDescendant: { kind: "relation", member: "ACTIVE_DESCENDANT", value: "object", type: "Gtk.Widget" },
    accessibleColCount: { kind: "relation", member: "COL_COUNT", value: "int", type: "number" },
    accessibleColIndex: { kind: "relation", member: "COL_INDEX", value: "int", type: "number" },
    accessibleColIndexText: { kind: "relation", member: "COL_INDEX_TEXT", value: "string", type: "string" },
    accessibleColSpan: { kind: "relation", member: "COL_SPAN", value: "int", type: "number" },
    accessibleControls: { kind: "relation", member: "CONTROLS", value: "ref-list", type: "Gtk.Widget[]" },
    accessibleDescribedBy: { kind: "relation", member: "DESCRIBED_BY", value: "ref-list", type: "Gtk.Widget[]" },
    accessibleDetails: { kind: "relation", member: "DETAILS", value: "ref-list", type: "Gtk.Widget[]" },
    accessibleErrorMessage: { kind: "relation", member: "ERROR_MESSAGE", value: "ref-list", type: "Gtk.Widget[]" },
    accessibleFlowTo: { kind: "relation", member: "FLOW_TO", value: "ref-list", type: "Gtk.Widget[]" },
    accessibleLabelledBy: { kind: "relation", member: "LABELLED_BY", value: "ref-list", type: "Gtk.Widget[]" },
    accessibleOwns: { kind: "relation", member: "OWNS", value: "ref-list", type: "Gtk.Widget[]" },
    accessiblePosInSet: { kind: "relation", member: "POS_IN_SET", value: "int", type: "number" },
    accessibleRowCount: { kind: "relation", member: "ROW_COUNT", value: "int", type: "number" },
    accessibleRowIndex: { kind: "relation", member: "ROW_INDEX", value: "int", type: "number" },
    accessibleRowIndexText: { kind: "relation", member: "ROW_INDEX_TEXT", value: "string", type: "string" },
    accessibleRowSpan: { kind: "relation", member: "ROW_SPAN", value: "int", type: "number" },
    accessibleSetSize: { kind: "relation", member: "SET_SIZE", value: "int", type: "number" },
};
