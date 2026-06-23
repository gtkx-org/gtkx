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

/**
 * Accessible prop names mapped to their TypeScript type, mirroring the runtime
 * `ACCESSIBLE_PROP_MAP` in `@gtkx/react`. Codegen inlines these directly into
 * the base `WidgetProps` interface.
 */
export const ACCESSIBLE_PROP_TYPES: Record<string, string> = {
    accessibleAutocomplete: "Gtk.AccessibleAutocomplete",
    accessibleDescription: "string",
    accessibleHasPopup: "boolean",
    accessibleKeyShortcuts: "string",
    accessibleLabel: "string",
    accessibleLevel: "number",
    accessibleModal: "boolean",
    accessibleMultiLine: "boolean",
    accessibleMultiSelectable: "boolean",
    accessibleOrientation: "Gtk.Orientation",
    accessiblePlaceholder: "string",
    accessibleReadOnly: "boolean",
    accessibleRequired: "boolean",
    accessibleRoleDescription: "string",
    accessibleSort: "Gtk.AccessibleSort",
    accessibleValueMax: "number",
    accessibleValueMin: "number",
    accessibleValueNow: "number",
    accessibleValueText: "string",
    accessibleHelpText: "string",
    accessibleBusy: "boolean",
    accessibleChecked: "Gtk.AccessibleTristate",
    accessibleDisabled: "boolean",
    accessibleExpanded: "boolean",
    accessibleHidden: "boolean",
    accessibleInvalid: "Gtk.AccessibleInvalidState",
    accessiblePressed: "Gtk.AccessibleTristate",
    accessibleSelected: "boolean",
    accessibleVisited: "boolean",
    accessibleActiveDescendant: "Gtk.Widget",
    accessibleColCount: "number",
    accessibleColIndex: "number",
    accessibleColIndexText: "string",
    accessibleColSpan: "number",
    accessibleControls: "Gtk.Widget[]",
    accessibleDescribedBy: "Gtk.Widget[]",
    accessibleDetails: "Gtk.Widget[]",
    accessibleErrorMessage: "Gtk.Widget[]",
    accessibleFlowTo: "Gtk.Widget[]",
    accessibleLabelledBy: "Gtk.Widget[]",
    accessibleOwns: "Gtk.Widget[]",
    accessiblePosInSet: "number",
    accessibleRowCount: "number",
    accessibleRowIndex: "number",
    accessibleRowIndexText: "string",
    accessibleRowSpan: "number",
    accessibleSetSize: "number",
};
