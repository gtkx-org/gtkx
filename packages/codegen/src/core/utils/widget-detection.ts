/**
 * Widget Detection Utilities
 *
 * Functions for detecting widget types and container capabilities.
 */

import type { GirRepository, QualifiedName } from "@gtkx/gir";

/**
 * Method names that indicate a widget is a container.
 * If a widget has any of these methods, it can contain children.
 */
const CONTAINER_METHODS = new Set([
    "append",
    "set_child",
    "insert",
    "insert_child_after",
    "reorder_child_after",
    "add_named",
    "append_page",
    "add_prefix",
    "add_suffix",
    "pack_start",
    "pack_end",
    "set_content",
    "add_overlay",
    "put",
    "attach",
    "add_child",
    "add",
    "push",
]);

/**
 * Checks if a method name indicates container capability.
 */
export const isContainerMethod = (methodName: string): boolean => CONTAINER_METHODS.has(methodName);

/**
 * Checks if a type name refers to a widget type (Gtk.Widget or subclass).
 *
 * @param typeName - The type name to check (string or QualifiedName)
 * @param repository - The GIR repository for type resolution
 * @param widgetQualifiedName - The qualified name for Gtk.Widget
 * @returns true if the type is a widget type
 */
export const isWidgetType = (
    typeName: string | QualifiedName,
    repository: GirRepository,
    widgetQualifiedName: QualifiedName,
): boolean => {
    if (typeof typeName !== "string") return false;

    if (typeName === "Gtk.Widget" || typeName === widgetQualifiedName) {
        return true;
    }

    if (!typeName.includes(".")) return false;

    const cls = repository.resolveClass(typeName as QualifiedName);
    if (!cls) return false;

    return cls.isSubclassOf(widgetQualifiedName);
};
