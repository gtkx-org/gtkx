/**
 * Callback and Parameter Constants
 *
 * Registry of callback trampolines and special parameter handling.
 * Trampoline names are implementation-specific (defined in the Rust native module),
 * while TypeScript signatures are derived from GIR.
 */

/**
 * Parameter name for the application instance in constructors.
 * This parameter is handled specially by React (passed via context),
 * so it's excluded from constructor parameter analysis.
 */
export const APPLICATION_PARAM_NAME = "application";

/**
 * Trampoline names that are implemented in the native module.
 */
export type TrampolineName =
    | "asyncReady"
    | "closure"
    | "destroy"
    | "drawFunc"
    | "scaleFormatValueFunc"
    | "shortcutFunc"
    | "treeListModelCreateFunc";

/**
 * Maps callback qualified names to their Rust trampoline names.
 * These trampolines are implemented in the native module.
 *
 * Key: Qualified callback name (e.g., "Gio.AsyncReadyCallback")
 * Value: Trampoline function name in native module
 */
const CALLBACK_TRAMPOLINES: Record<string, TrampolineName> = {
    "Gio.AsyncReadyCallback": "asyncReady",
    "GLib.DestroyNotify": "destroy",
    "Gtk.DrawingAreaDrawFunc": "drawFunc",
    "Gtk.ShortcutFunc": "shortcutFunc",
    "Gtk.TreeListModelCreateModelFunc": "treeListModelCreateFunc",
};

/**
 * Gets the trampoline name for a callback type.
 * @param qualifiedName - The qualified callback name (e.g., "Gio.AsyncReadyCallback")
 * @returns The trampoline name if supported, null otherwise
 */
export const getTrampolineName = (qualifiedName: string): TrampolineName | null => {
    return CALLBACK_TRAMPOLINES[qualifiedName] ?? null;
};

/**
 * Checks if a callback type is supported (has a trampoline implementation).
 */
export const isSupportedCallback = (typeName: string): boolean => {
    return typeName in CALLBACK_TRAMPOLINES;
};
