import type { ContainerProp, ManyContainerProp, RejectRule, RelationshipRule, SyntheticPropRule } from "@gtkx/config";
import { containerPropToAttach, containerPropToCompanion } from "@gtkx/config";

export type AncestryWrapperName =
    | "withWindowPresentation"
    | "withApplicationLifecycle"
    | "withApplicationWindowPresentation";

export type AncestryWrapperRule = { ancestors: string[]; wrapper: AncestryWrapperName };

export const BUILT_IN_ANCESTRY_WRAPPERS: AncestryWrapperRule[] = [
    { ancestors: ["GtkApplication"], wrapper: "withApplicationLifecycle" },
    { ancestors: ["GtkApplicationWindow"], wrapper: "withApplicationWindowPresentation" },
    { ancestors: ["GtkWindow"], wrapper: "withWindowPresentation" },
];

export const DEFAULT_BLOCKABLE_TYPES: string[] = ["GtkTextBuffer"];

type ManyMethods = Pick<ManyContainerProp, "append" | "remove">;

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

const prefixSuffixProps = (): ContainerProp[] => [
    { arity: "many", prop: "prefix", child: "GtkWidget", append: "addPrefix" },
    { arity: "many", prop: "suffix", child: "GtkWidget", append: "addSuffix" },
];

const packProps = (): ContainerProp[] => [
    { arity: "many", prop: "start", child: "GtkWidget", append: "packStart" },
    { arity: "many", prop: "end", child: "GtkWidget", append: "packEnd" },
];

const autowrapProp = (wrapper: string): ContainerProp => ({
    arity: "many",
    prop: "children",
    child: "GtkWidget",
    append: "append",
    remove: "remove",
    insert: { method: "insert", args: ["child", "index"] },
    autowrap: wrapper,
});

export const CONTAINER_PROPS: Record<string, ContainerProp[]> = {
    GtkWidget: [
        { arity: "many", prop: "children", child: "GtkEventController", ...CONTROLLER_METHODS },
        { arity: "many", prop: "controllers", child: "GtkEventController", ...CONTROLLER_METHODS },
        {
            arity: "one",
            prop: "children",
            child: "GtkLayoutManager",
            set: "setLayoutManager",
            unset: { method: "setLayoutManager", args: [{ literal: null }] },
        },
        { arity: "many", prop: "children", child: "GActionGroup", ...ACTION_GROUP_METHODS },
        { arity: "many", prop: "actionGroups", child: "GActionGroup", ...ACTION_GROUP_METHODS },
    ],
    GtkShortcutController: [
        { arity: "many", prop: "children", child: "GtkShortcut", ...SHORTCUT_METHODS },
        { arity: "many", prop: "shortcuts", child: "GtkShortcut", ...SHORTCUT_METHODS },
    ],
    GtkTextView: [
        {
            arity: "one",
            prop: "children",
            child: "GtkTextBuffer",
            set: "setBuffer",
            unset: { method: "setBuffer", args: [{ literal: null }] },
        },
    ],
    GActionMap: [{ arity: "many", prop: "children", child: "GAction", ...ACTION_METHODS }],
    GtkApplicationWindow: [{ arity: "many", prop: "actions", child: "GAction", ...ACTION_METHODS }],
    GtkColumnView: [
        {
            arity: "many",
            prop: "children",
            child: "GtkColumnViewColumn",
            append: "appendColumn",
            remove: "removeColumn",
            insert: { method: "insertColumn", args: ["index", "child"] },
        },
    ],
    AdwToggleGroup: [{ arity: "many", prop: "children", child: "AdwToggle", append: "add", remove: "remove" }],
    AdwShortcutsDialog: [{ arity: "many", prop: "children", child: "AdwShortcutsSection", append: "add" }],
    AdwShortcutsSection: [{ arity: "many", prop: "children", child: "AdwShortcutsItem", append: "add" }],
    AdwActionRow: prefixSuffixProps(),
    AdwEntryRow: prefixSuffixProps(),
    AdwExpanderRow: [
        ...prefixSuffixProps(),
        { arity: "many", prop: "rows", child: "GtkWidget", append: "addRow" },
        { arity: "many", prop: "actions", child: "GtkWidget", append: "addAction" },
    ],
    AdwHeaderBar: packProps(),
    GtkHeaderBar: packProps(),
    GtkActionBar: packProps(),
    AdwToolbarView: [
        { arity: "many", prop: "topBar", child: "GtkWidget", append: "addTopBar" },
        { arity: "many", prop: "bottomBar", child: "GtkWidget", append: "addBottomBar" },
    ],
    GtkListBox: [autowrapProp("GtkListBoxRow")],
    GtkFlowBox: [autowrapProp("GtkFlowBoxChild")],
    GtkStack: [
        {
            arity: "many",
            prop: "children",
            child: "GtkWidget",
            append: "addChild",
            remove: "remove",
            adopt: { element: "GtkStackPage" },
        },
    ],
    AdwViewStack: [
        {
            arity: "many",
            prop: "children",
            child: "GtkWidget",
            append: "add",
            remove: "remove",
            adopt: { element: "AdwViewStackPage" },
        },
    ],
    GtkNotebook: [
        {
            arity: "many",
            prop: "children",
            child: "GtkWidget",
            append: { method: "appendPage", args: ["child", { literal: null }] },
            insert: { method: "insertPage", args: ["child", { literal: null }, "index"] },
            remove: "detachTab",
            adopt: { element: "GtkNotebookPage", accessor: "getPage", setters: { tabLabel: "setTabLabel" } },
        },
    ],
};

const REJECT_RULES: RejectRule[] = [
    { kind: "reject", parent: "GObject", child: "GtkEventController", prop: "controllers" },
    { kind: "reject", parent: "GObject", child: "GtkLayoutManager", prop: "layoutManager" },
    { kind: "reject", parent: "GObject", child: "GtkShortcut", prop: "shortcuts" },
    { kind: "reject", parent: "GObject", child: "GtkTextBuffer", prop: "buffer" },
];

export const containerPropsToRelationships = (containerProps: Record<string, ContainerProp[]>): RelationshipRule[] => {
    const rules: RelationshipRule[] = [];
    for (const [parent, props] of Object.entries(containerProps)) {
        for (const cp of props) {
            rules.push(containerPropToCompanion(parent, cp) ?? containerPropToAttach(parent, cp));
        }
    }
    return rules;
};

export const RELATIONSHIP_RULES: RelationshipRule[] = [
    ...containerPropsToRelationships(CONTAINER_PROPS),
    ...REJECT_RULES,
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
