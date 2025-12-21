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
export const STACK_WIDGETS = new Set(["GtkStack", "AdwViewStack"]);
export const COLUMN_VIEW_WIDGET = "GtkColumnView";
