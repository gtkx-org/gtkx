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

/**
 * Widget names that are list widgets (require renderItem prop).
 * These are hardcoded business decisions, not derived from AST.
 */
export const LIST_WIDGET_NAMES = new Set(["ListView", "GridView"]);

/**
 * Widget names that are dropdown widgets (special item handling).
 * These are hardcoded business decisions, not derived from AST.
 */
export const DROP_DOWN_WIDGET_NAMES = new Set(["DropDown", "ComboRow"]);

/**
 * Widget names that are column view widgets (column-based layout).
 * These are hardcoded business decisions, not derived from AST.
 */
export const COLUMN_VIEW_WIDGET_NAMES = new Set(["ColumnView"]);

/**
 * Widget names that auto-wrap children (ListBox wraps in ListBoxRow, FlowBox wraps in FlowBoxChild).
 */
export const AUTOWRAP_WIDGET_NAMES = new Set(["ListBox", "FlowBox"]);

/**
 * Widget names that are stack containers (show one child at a time).
 */
export const STACK_WIDGET_NAMES = new Set(["Stack", "ViewStack"]);

/**
 * Widget names that are notebook containers (tabbed interface).
 */
export const NOTEBOOK_WIDGET_NAMES = new Set(["Notebook"]);

/**
 * Widget names that support popover menu children.
 */
export const POPOVER_MENU_WIDGET_NAMES = new Set(["PopoverMenu", "PopoverMenuBar", "MenuButton"]);

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
