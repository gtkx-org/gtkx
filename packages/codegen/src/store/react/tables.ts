import type { RelationshipRule, SyntheticPropRule } from "@gtkx/config";

export type AncestryWrapperName =
    | "withWindowPresentation"
    | "withApplicationLifecycle"
    | "withApplicationWindowPresentation";

export type AncestryWrapperRule = { ancestors: string[]; wrapper: AncestryWrapperName };

export const BUILT_IN_ANCESTRY_WRAPPERS: AncestryWrapperRule[] = [
    { ancestors: ["GtkApplication"], wrapper: "withApplicationLifecycle" },
    { ancestors: ["GtkApplicationWindow"], wrapper: "withApplicationWindowPresentation" },
    { ancestors: ["GtkWindow", "AdwDialog"], wrapper: "withWindowPresentation" },
];

export const COMPANION_WRAPPERS: Record<string, string> = {
    GtkFixedChild: "withFixedTransform",
    GtkNotebookPage: "withNotebookTabLabel",
};

export const TOPLEVEL_TYPES: string[] = ["GtkWindow", "AdwDialog"];

export const DEFAULT_BLOCKABLE_TYPES: string[] = ["GtkTextBuffer"];

const PREFIX_SUFFIX_SLOT_RULES = (parent: string): RelationshipRule[] => [
    { kind: "attach", parent, child: "GtkWidget", slot: "prefix", add: "addPrefix" },
    { kind: "attach", parent, child: "GtkWidget", slot: "suffix", add: "addSuffix" },
];

const PACK_SLOT_RULES = (parent: string): RelationshipRule[] => [
    { kind: "attach", parent, child: "GtkWidget", slot: "start", add: "packStart" },
    { kind: "attach", parent, child: "GtkWidget", slot: "end", add: "packEnd" },
];

const ACTION_CALLS = {
    add: "addAction",
    remove: { method: "removeAction", args: [{ prop: "name" }] },
} satisfies Pick<Extract<RelationshipRule, { kind: "attach" }>, "add" | "remove">;

const ACTION_GROUP_CALLS = {
    add: { method: "insertActionGroup", args: [{ prop: "prefix" }, "child"] },
    remove: { method: "insertActionGroup", args: [{ prop: "prefix" }, { literal: null }] },
} satisfies Pick<Extract<RelationshipRule, { kind: "attach" }>, "add" | "remove">;

const CONTROLLER_CALLS = {
    add: "addController",
    remove: "removeController",
} satisfies Pick<Extract<RelationshipRule, { kind: "attach" }>, "add" | "remove">;

const SHORTCUT_CALLS = {
    add: "addShortcut",
    remove: "removeShortcut",
} satisfies Pick<Extract<RelationshipRule, { kind: "attach" }>, "add" | "remove">;

const AUTOWRAP_RULE = (parent: string, wrapper: string): RelationshipRule => ({
    kind: "attach",
    parent,
    child: "GtkWidget",
    add: "append",
    remove: "remove",
    insert: { method: "insert", args: ["child", "index"] },
    autowrap: wrapper,
});

export const RELATIONSHIP_RULES: RelationshipRule[] = [
    { kind: "attach", parent: "GtkWidget", child: "GtkEventController", ...CONTROLLER_CALLS },
    { kind: "attach", parent: "GtkWidget", child: "GtkEventController", slot: "controllers", ...CONTROLLER_CALLS },
    { kind: "reject", parent: "GObject", child: "GtkEventController", prop: "controllers" },
    {
        kind: "attach",
        parent: "GtkWidget",
        child: "GtkLayoutManager",
        add: "setLayoutManager",
        remove: { method: "setLayoutManager", args: [{ literal: null }] },
    },
    { kind: "reject", parent: "GObject", child: "GtkLayoutManager", prop: "layoutManager" },
    { kind: "attach", parent: "GtkShortcutController", child: "GtkShortcut", ...SHORTCUT_CALLS },
    { kind: "attach", parent: "GtkShortcutController", child: "GtkShortcut", slot: "shortcuts", ...SHORTCUT_CALLS },
    { kind: "reject", parent: "GObject", child: "GtkShortcut", prop: "shortcuts" },
    {
        kind: "attach",
        parent: "GtkTextView",
        child: "GtkTextBuffer",
        add: "setBuffer",
        remove: { method: "setBuffer", args: [{ literal: null }] },
    },
    { kind: "reject", parent: "GObject", child: "GtkTextBuffer", prop: "buffer" },
    { kind: "attach", parent: "GActionMap", child: "GAction", ...ACTION_CALLS },
    { kind: "attach", parent: "GtkApplicationWindow", child: "GAction", slot: "actions", ...ACTION_CALLS },
    { kind: "attach", parent: "GtkWidget", child: "GActionGroup", ...ACTION_GROUP_CALLS },
    { kind: "attach", parent: "GtkWidget", child: "GActionGroup", slot: "actionGroups", ...ACTION_GROUP_CALLS },
    {
        kind: "attach",
        parent: "GtkColumnView",
        child: "GtkColumnViewColumn",
        add: "appendColumn",
        remove: "removeColumn",
        insert: { method: "insertColumn", args: ["index", "child"] },
    },
    { kind: "attach", parent: "AdwToggleGroup", child: "AdwToggle", add: "add", remove: "remove" },
    { kind: "attach", parent: "AdwShortcutsDialog", child: "AdwShortcutsSection", add: "add" },
    { kind: "attach", parent: "AdwShortcutsSection", child: "AdwShortcutsItem", add: "add" },
    ...PREFIX_SUFFIX_SLOT_RULES("AdwActionRow"),
    ...PREFIX_SUFFIX_SLOT_RULES("AdwEntryRow"),
    ...PREFIX_SUFFIX_SLOT_RULES("AdwExpanderRow"),
    { kind: "attach", parent: "AdwExpanderRow", child: "GtkWidget", slot: "rows", add: "addRow" },
    { kind: "attach", parent: "AdwExpanderRow", child: "GtkWidget", slot: "actions", add: "addAction" },
    ...PACK_SLOT_RULES("AdwHeaderBar"),
    ...PACK_SLOT_RULES("GtkHeaderBar"),
    ...PACK_SLOT_RULES("GtkActionBar"),
    { kind: "attach", parent: "AdwToolbarView", child: "GtkWidget", slot: "topBar", add: "addTopBar" },
    { kind: "attach", parent: "AdwToolbarView", child: "GtkWidget", slot: "bottomBar", add: "addBottomBar" },
    AUTOWRAP_RULE("GtkListBox", "GtkListBoxRow"),
    AUTOWRAP_RULE("GtkFlowBox", "GtkFlowBoxChild"),
    {
        kind: "companion",
        element: "GtkStackPage",
        parent: "GtkStack",
        add: "addChild",
        remove: "remove",
        aliases: { id: "name" },
    },
    {
        kind: "companion",
        element: "AdwViewStackPage",
        parent: "AdwViewStack",
        add: "add",
        remove: "remove",
        aliases: { id: "name" },
    },
    {
        kind: "companion",
        element: "GtkNotebookPage",
        parent: "GtkNotebook",
        add: { method: "appendPage", args: ["child", { literal: null }] },
        insert: { method: "insertPage", args: ["child", { literal: null }, "index"] },
        remove: "detachTab",
        companion: "getPage",
        setters: { tabLabel: "setTabLabel" },
    },
    {
        kind: "companion",
        element: "GtkOverlayChild",
        parent: "GtkOverlay",
        add: "addOverlay",
        remove: "removeOverlay",
        setters: { measure: "setMeasureOverlay", clipOverlay: "setClipOverlay" },
        multi: true,
    },
    { kind: "layout-child", element: "GtkGridChild", parent: "GtkWidget", layout: "GtkGridLayout" },
    { kind: "layout-child", element: "GtkFixedChild", parent: "GtkWidget", layout: "GtkFixedLayout" },
    { kind: "skip", child: "GtkWindow" },
    { kind: "skip", child: "AdwDialog" },
];

export const SYNTHETIC_PROP_RULES: SyntheticPropRule[] = [
    {
        kind: "list",
        type: "GtkScale",
        prop: "marks",
        clear: "clearMarks",
        add: {
            method: "addMark",
            args: [{ field: "value" }, { field: "position", or: 3 }, { field: "label", or: null }],
        },
    },
    { kind: "list", type: "GtkCalendar", prop: "markedDays", clear: "clearMarks", add: "markDay" },
    {
        kind: "keyed-list",
        type: "GtkLevelBar",
        prop: "offsets",
        add: { method: "addOffsetValue", args: [{ field: "id" }, { field: "value" }] },
        remove: { method: "removeOffsetValue", args: [{ field: "id" }] },
    },
    {
        kind: "keyed-list",
        type: "GtkApplication",
        prop: "actionAccels",
        add: { method: "setAccelsForAction", args: [{ field: "action" }, { field: "accels" }] },
        remove: { method: "setAccelsForAction", args: [{ field: "action" }, { literal: [] }] },
    },
    { kind: "keyed-list", type: "GtkSizeGroup", prop: "widgets", add: "addWidget", remove: "removeWidget" },
    {
        kind: "keyed-list",
        type: "AdwAlertDialog",
        prop: "responses",
        key: "id",
        add: { method: "addResponse", args: [{ field: "id" }, { field: "label" }] },
        remove: { method: "removeResponse", args: [{ field: "id" }] },
        setters: { appearance: "setResponseAppearance", enabled: "setResponseEnabled" },
    },
    { kind: "value", type: "GtkDropTarget", prop: "types", call: "setGtypes", or: [] },
    { kind: "value", type: "GtkDrawingArea", prop: "drawFunc", call: "setDrawFunc", or: null, after: "queueDraw" },
    {
        kind: "value",
        type: "GtkDragSource",
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
    {
        kind: "write-once-list",
        type: "GtkAboutDialog",
        prop: "creditSections",
        add: { method: "addCreditSection", args: [{ field: "name" }, { field: "people" }] },
    },
    { kind: "controlled-text", type: "GtkEditable", prop: "text", get: "getText", set: "text" },
    {
        kind: "selection",
        type: "GtkStack",
        prop: "visibleChildName",
        get: "getVisibleChildName",
        set: "setVisibleChildName",
        lookup: "getChildByName",
    },
    {
        kind: "selection",
        type: "AdwViewStack",
        prop: "visibleChildName",
        get: "getVisibleChildName",
        set: "setVisibleChildName",
        lookup: "getChildByName",
    },
    {
        kind: "selection",
        type: "AdwToggleGroup",
        prop: "activeName",
        get: "getActiveName",
        set: "setActiveName",
        lookup: "getToggleByName",
    },
    { kind: "selection", type: "AdwToggleGroup", prop: "active", get: "getActive", set: "setActive" },
    { kind: "reassert", type: "GtkTextTag", prop: "priority", set: "setPriority" },
    { kind: "reassert", type: "GtkTextTag", prop: "foreground", set: "foreground" },
    { kind: "reassert", type: "GtkTextTag", prop: "background", set: "background" },
    { kind: "reassert", type: "GtkTextTag", prop: "paragraphBackground", set: "paragraphBackground" },
];

type AccessibleAttributeKind = "property" | "state" | "relation";

type AccessibleAttributeValue = "string" | "boolean" | "int" | "double" | "object" | "ref-list";

export type AccessibleAttribute = {
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
