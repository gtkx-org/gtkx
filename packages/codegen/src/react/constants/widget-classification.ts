/**
 * Widget Classification Constants
 *
 * Business-level widget classification for React generation.
 * These are hardcoded decisions about which widgets have special behaviors,
 * not derived from GIR metadata.
 *
 * SINGLE SOURCE OF TRUTH for widget classification.
 * Used by both InternalGenerator and JsxTypesGenerator.
 */

export const LIST_WIDGET_NAMES: ReadonlySet<string> = new Set(["ListView", "GridView"]);
export const DROP_DOWN_WIDGET_NAMES: ReadonlySet<string> = new Set(["DropDown", "ComboRow"]);
export const COLUMN_VIEW_WIDGET_NAMES: ReadonlySet<string> = new Set(["ColumnView"]);
export const VIRTUAL_CHILDREN_WIDGET_NAMES: ReadonlySet<string> = new Set(["Scale", "Calendar", "LevelBar"]);
export const NAVIGATION_VIEW_WIDGET_NAMES: ReadonlySet<string> = new Set(["NavigationView"]);
export const STACK_WIDGET_NAMES: ReadonlySet<string> = new Set(["Stack", "ViewStack"]);
export const WINDOW_WIDGET_NAMES: ReadonlySet<string> = new Set(["Window"]);
export const SCROLLED_WINDOW_WIDGET_NAMES: ReadonlySet<string> = new Set(["ScrolledWindow"]);
export const DRAWING_AREA_WIDGET_NAMES: ReadonlySet<string> = new Set(["DrawingArea"]);

const AUTOWRAP_WIDGET_NAMES: ReadonlySet<string> = new Set(["ListBox", "FlowBox"]);
export const NOTEBOOK_WIDGET_NAMES: ReadonlySet<string> = new Set(["Notebook"]);
const POPOVER_MENU_WIDGET_NAMES: ReadonlySet<string> = new Set(["PopoverMenu", "PopoverMenuBar", "MenuButton"]);

type WidgetClassification = {
    readonly name: string;
    readonly classNames: ReadonlySet<string>;
    readonly doc: string;
};

export const WIDGET_CLASSIFICATIONS: readonly WidgetClassification[] = [
    { name: "LIST_WIDGET_CLASSES", classNames: LIST_WIDGET_NAMES, doc: "List widgets that require renderItem prop." },
    {
        name: "DROP_DOWN_CLASSES",
        classNames: DROP_DOWN_WIDGET_NAMES,
        doc: "Dropdown widgets with special item handling.",
    },
    {
        name: "COLUMN_VIEW_CLASSES",
        classNames: COLUMN_VIEW_WIDGET_NAMES,
        doc: "Column view widgets with column-based layout.",
    },
    {
        name: "AUTOWRAP_CLASSES",
        classNames: AUTOWRAP_WIDGET_NAMES,
        doc: "Widgets that auto-wrap children (ListBox wraps in ListBoxRow, FlowBox wraps in FlowBoxChild).",
    },
    { name: "STACK_CLASSES", classNames: STACK_WIDGET_NAMES, doc: "Stack widgets that show one child at a time." },
    { name: "NOTEBOOK_CLASSES", classNames: NOTEBOOK_WIDGET_NAMES, doc: "Notebook widgets with tabbed interface." },
    {
        name: "POPOVER_MENU_CLASSES",
        classNames: POPOVER_MENU_WIDGET_NAMES,
        doc: "Widgets that support popover menu children.",
    },
];

/**
 * Methods that define the "packable" interface (pack start/end positioning).
 * Used for duck-typing in node matching.
 */
export const PACK_INTERFACE_METHODS = ["packStart", "packEnd", "remove"] as const;

/**
 * Methods that define the "prefix/suffix" interface (Adwaita action rows).
 * Used for duck-typing in node matching.
 */
export const PREFIX_SUFFIX_INTERFACE_METHODS = ["addPrefix", "addSuffix", "remove"] as const;
