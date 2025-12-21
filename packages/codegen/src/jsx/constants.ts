export const HIDDEN_PROPS: Record<string, readonly string[]> = {
    GtkListView: ["factory", "model"],
    GtkGridView: ["factory", "model"],
    GtkColumnView: ["model"],
    GtkDropDown: ["model"],
    AdwComboRow: ["model"],
    GtkWindow: ["application"],
    GtkApplicationWindow: ["application"],
    AdwWindow: ["application"],
    AdwApplicationWindow: ["application"],
};

export const LIST_WIDGETS = new Set(["GtkListView", "GtkGridView"]);
export const DROPDOWN_WIDGETS = new Set(["GtkDropDown"]);
export const GRID_WIDGETS = new Set(["GtkGrid"]);
export const STACK_WIDGETS = new Set(["GtkStack", "AdwViewStack"]);
export const COLUMN_VIEW_WIDGET = "GtkColumnView";
export const NOTEBOOK_WIDGET = "GtkNotebook";
export const POPOVER_MENU_WIDGET = "GtkPopoverMenu";
export const TOOLBAR_VIEW_WIDGET = "AdwToolbarView";
export const WIDGET_REFERENCE_PROPERTIES = new Set(["mnemonic-widget"]);
