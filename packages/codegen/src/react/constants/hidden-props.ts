/**
 * Hidden Props Configuration
 *
 * Props that are managed internally and shouldn't appear in public JSX interfaces.
 * These are props like "factory" and "model" that have specialized handling.
 */

/**
 * Props hidden from JSX interfaces for specific widgets.
 * These are managed internally or have specialized handling.
 */
const HIDDEN_PROPS: Readonly<Record<string, readonly string[]>> = {
    ListView: ["factory", "model"],
    GridView: ["factory", "model"],
    ColumnView: ["model"],
    DropDown: ["model"],
    ComboRow: ["model"],
    Window: ["application"],
    ApplicationWindow: ["application"],
    NavigationPage: ["child"],
    GraphicsOffload: ["child"],
};

/**
 * Gets hidden props for a widget class name.
 */
export function getHiddenProps(widgetName: string): Set<string> {
    return new Set(HIDDEN_PROPS[widgetName] ?? []);
}
