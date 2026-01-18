export const LIST_WIDGET_NAMES: ReadonlySet<string> = new Set(["ListView", "GridView"]);
export const DROP_DOWN_WIDGET_NAMES: ReadonlySet<string> = new Set(["DropDown", "ComboRow"]);
export const COLUMN_VIEW_WIDGET_NAMES: ReadonlySet<string> = new Set(["ColumnView"]);
export const NAVIGATION_VIEW_WIDGET_NAMES: ReadonlySet<string> = new Set(["NavigationView"]);
export const STACK_WIDGET_NAMES: ReadonlySet<string> = new Set(["Stack", "ViewStack"]);
export const WINDOW_WIDGET_NAMES: ReadonlySet<string> = new Set(["Window"]);
export const SCROLLED_WINDOW_WIDGET_NAMES: ReadonlySet<string> = new Set(["ScrolledWindow"]);
export const DRAWING_AREA_WIDGET_NAMES: ReadonlySet<string> = new Set(["DrawingArea"]);

const AUTOWRAP_WIDGET_NAMES: ReadonlySet<string> = new Set(["ListBox", "FlowBox"]);
export const NOTEBOOK_WIDGET_NAMES: ReadonlySet<string> = new Set(["Notebook"]);
const POPOVER_MENU_WIDGET_NAMES: ReadonlySet<string> = new Set(["PopoverMenu", "PopoverMenuBar", "MenuButton"]);

export type WidgetClassificationType =
    | "list"
    | "dropdown"
    | "columnview"
    | "stack"
    | "notebook"
    | "autowrap"
    | "popovermenu";

type WidgetClassification = {
    readonly type: WidgetClassificationType;
    readonly name: string;
    readonly classNames: ReadonlySet<string>;
    readonly doc: string;
};

export const WIDGET_CLASSIFICATIONS: readonly WidgetClassification[] = [
    {
        type: "list",
        name: "LIST_WIDGET_CLASSES",
        classNames: LIST_WIDGET_NAMES,
        doc: "List widgets that require renderItem prop.",
    },
    {
        type: "dropdown",
        name: "DROP_DOWN_CLASSES",
        classNames: DROP_DOWN_WIDGET_NAMES,
        doc: "Dropdown widgets with special item handling.",
    },
    {
        type: "columnview",
        name: "COLUMN_VIEW_CLASSES",
        classNames: COLUMN_VIEW_WIDGET_NAMES,
        doc: "Column view widgets with column-based layout.",
    },
    {
        type: "autowrap",
        name: "AUTOWRAP_CLASSES",
        classNames: AUTOWRAP_WIDGET_NAMES,
        doc: "Widgets that auto-wrap children (ListBox wraps in ListBoxRow, FlowBox wraps in FlowBoxChild).",
    },
    {
        type: "stack",
        name: "STACK_CLASSES",
        classNames: STACK_WIDGET_NAMES,
        doc: "Stack widgets that show one child at a time.",
    },
    {
        type: "notebook",
        name: "NOTEBOOK_CLASSES",
        classNames: NOTEBOOK_WIDGET_NAMES,
        doc: "Notebook widgets with tabbed interface.",
    },
    {
        type: "popovermenu",
        name: "POPOVER_MENU_CLASSES",
        classNames: POPOVER_MENU_WIDGET_NAMES,
        doc: "Widgets that support popover menu children.",
    },
];

export const PACK_INTERFACE_METHODS = ["packStart", "packEnd", "remove"] as const;

export const PREFIX_SUFFIX_INTERFACE_METHODS = ["addPrefix", "addSuffix", "remove"] as const;

export const getClassification = (className: string): WidgetClassificationType | null => {
    for (const c of WIDGET_CLASSIFICATIONS) {
        if (c.classNames.has(className)) {
            return c.type;
        }
    }
    return null;
};
