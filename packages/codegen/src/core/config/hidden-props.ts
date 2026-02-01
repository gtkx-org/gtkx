const HIDDEN_PROPS: Readonly<Record<string, readonly string[]>> = {
    ListView: ["factory", "model"],
    GridView: ["factory", "model"],
    ColumnView: ["model"],
    DropDown: ["model", "selected", "factory", "listFactory", "expression"],
    ComboRow: ["model", "selected", "factory", "listFactory", "expression"],
    Window: ["onCloseRequest", "onClose"],
    Assistant: ["onClose"],
    Dialog: ["onClose"],
    ShortcutsWindow: ["onClose"],
    ApplicationWindow: ["application"],
    Stack: ["visibleChild", "visibleChildName"],
    ViewStack: ["visibleChild", "visibleChildName"],
    Range: ["adjustment", "onValueChanged"],
    ScaleButton: ["adjustment", "onValueChanged"],
    VolumeButton: ["adjustment"],
    SpinButton: ["adjustment", "onValueChanged"],
    SpinRow: ["adjustment", "onValueChanged"],
    TextView: ["buffer"],
    ColorDialogButton: ["dialog"],
    FontDialogButton: ["dialog"],
    PopoverMenu: ["menuModel"],
    PopoverMenuBar: ["menuModel"],
    MenuButton: ["menuModel", "popover"]
};

export const getHiddenPropNames = (widgetName: string): readonly string[] => {
    return HIDDEN_PROPS[widgetName] ?? [];
};
