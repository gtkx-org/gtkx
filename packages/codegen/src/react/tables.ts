import type { AddMethodRule, OrderedInsertSpec, PageMetaSetter } from "@gtkx/config";

export type AncestryWrapperName =
    | "withWindowPresentation"
    | "withApplicationLifecycle"
    | "withApplicationWindowPresentation";

export type AncestryWrapperRule = { ancestors: string[]; hoc: AncestryWrapperName };

export const BUILT_IN_ANCESTRY_WRAPPERS: AncestryWrapperRule[] = [
    { ancestors: ["GtkApplication"], hoc: "withApplicationLifecycle" },
    { ancestors: ["GtkApplicationWindow"], hoc: "withApplicationWindowPresentation" },
    { ancestors: ["GtkWindow", "AdwDialog"], hoc: "withWindowPresentation" },
];

export const TOP_LEVEL_TYPES: string[] = ["GtkWindow", "AdwDialog"];

export const DEFAULT_BLOCKABLE_TYPES: string[] = ["GtkTextBuffer"];

export const META_OBJECT_ADD_METHODS: Record<string, AddMethodRule[]> = {
    AdwViewStack: [
        { method: "addTitledWithIcon", args: ["widget", "id", "title", "iconName"], requires: ["title", "iconName"] },
        { method: "addTitled", args: ["widget", "id", "title"], requires: ["title"] },
        { method: "addNamed", args: ["widget", "id"], requires: ["id"] },
        { method: "add", args: ["widget"], requires: [] },
    ],
    GtkStack: [
        { method: "addTitled", args: ["widget", "id", "title"], requires: ["title"] },
        { method: "addNamed", args: ["widget", "id"], requires: ["id"] },
        { method: "addChild", args: ["widget"], requires: [] },
    ],
};

export const PAGE_META_SETTERS: PageMetaSetter[] = [
    { setter: "setTitle", prop: "title", whenPresent: true },
    { setter: "setIconName", prop: "iconName", whenPresent: true },
    { setter: "setNeedsAttention", prop: "needsAttention", fallback: false },
    { setter: "setVisible", prop: "visible", fallback: true },
    { setter: "setUseUnderline", prop: "useUnderline", fallback: false },
    { setter: "setBadgeNumber", prop: "badgeNumber", whenPresent: true },
];

export const ORDERED_INSERT: Record<string, OrderedInsertSpec> = {
    GtkColumnView: { collection: "getColumns", attach: "insertColumn", detach: "removeColumn" },
};

/**
 * Per-host container-slot prop names whose values are wrapped as slot children
 * and routed to the parent rule set by `slotTag`. Used by codegen to type these
 * props as `ReactNode` and by the runtime split between slot and scalar props.
 */
export const SLOT_PROPS_BY_TYPE: Record<string, string[]> = {
    GtkWidget: ["controllers", "actionGroups"],
    GtkShortcutController: ["shortcuts"],
    GtkApplicationWindow: ["actions"],
    AdwActionRow: ["prefix", "suffix"],
    AdwEntryRow: ["prefix", "suffix"],
    AdwExpanderRow: ["prefix", "suffix", "rows", "actions"],
    AdwHeaderBar: ["start", "end"],
    AdwToolbarView: ["topBar", "bottomBar"],
    GtkActionBar: ["start", "end"],
    GtkHeaderBar: ["start", "end"],
};

export type AccessibleAttributeKind = "property" | "state" | "relation";

export type AccessibleAttributeValue = "string" | "boolean" | "int" | "double" | "object" | "ref-list";

export type AccessibleAttribute = {
    kind: AccessibleAttributeKind;
    member: string;
    value: AccessibleAttributeValue;
    type: string;
};

/**
 * The single source of truth for the accessibility attributes shared by every
 * GTK Accessible implementor. Each entry pairs the public JSX type (`type`)
 * consumed by the jsx emitter with the runtime application data (`kind`,
 * `member`, `value`) emitted into `@gtkx/jsx/metadata` and consumed by the
 * `@gtkx/react` reconciler. `kind` selects the GTK accessible enum family,
 * `member` is the SCREAMING_SNAKE enum member name, and `value` selects the
 * `GObject.Value` coercion. Grouped by `kind` for readability.
 */
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
