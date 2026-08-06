const DEFAULT_USER_EVENT_SIGNALS: Record<string, string[]> = {
    AdwAlertDialog: ["response"],
    AdwCarousel: ["page-changed"],
    AdwDialog: ["closed"],
    AdwNavigationView: ["pushed"],
    AdwTabView: ["close-page", "page-attached", "page-detached", "page-reordered"],
    GObject: ["notify"],
    GtkAdjustment: ["changed", "value-changed"],
    GtkCalendar: ["day-selected"],
    GtkCheckButton: ["toggled"],
    GtkEditable: ["changed", "delete-text", "insert-text"],
    GtkEntryBuffer: ["deleted-text", "inserted-text"],
    GtkFlowBox: ["selected-children-changed"],
    GtkListBox: ["row-selected", "selected-rows-changed"],
    GtkNotebook: ["page-added", "page-removed", "page-reordered", "switch-page"],
    GtkPopover: ["closed"],
    GtkRange: ["value-changed"],
    GtkScaleButton: ["value-changed"],
    GtkScrolledWindow: ["edge-reached"],
    GtkSearchEntry: ["search-changed"],
    GtkSelectionModel: ["selection-changed"],
    GtkSpinButton: ["value-changed"],
    GtkSwitch: ["state-set"],
    GtkTextBuffer: [
        "apply-tag",
        "changed",
        "delete-range",
        "insert-child-anchor",
        "insert-paintable",
        "insert-text",
        "mark-deleted",
        "mark-set",
        "modified-changed",
        "remove-tag",
    ],
    GtkToggleButton: ["toggled"],
    GtkWidget: ["state-flags-changed"],
};

const resolveUserEventSignals = (overrides: Record<string, string[]> | undefined): Record<string, string[]> => {
    const resolved: Record<string, string[]> = { ...DEFAULT_USER_EVENT_SIGNALS };
    const overrideEntries = Object.entries(overrides ?? {});

    for (const [typeName, signals] of overrideEntries) {
        resolved[typeName] = [...new Set([...(resolved[typeName] ?? []), ...signals])];
    }

    return resolved;
};

export { DEFAULT_USER_EVENT_SIGNALS, resolveUserEventSignals };
