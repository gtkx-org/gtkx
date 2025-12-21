import { typeFromName, typeName, typeParent } from "./generated/gobject/functions.js";
import type { NativeClass } from "./native/object.js";

const registry = new Map<string, NativeClass>();

/**
 * Registers a class in the global GObject type registry.
 * Called by generated code at module load time.
 * @param cls - The class to register
 */
export function registerNativeClass(cls: NativeClass): void {
    registry.set(cls.glibTypeName, cls);
}

/**
 * Looks up a class by its GLib type name.
 * @param glibTypeName - The GLib type name (e.g., "GtkButton")
 * @returns The class constructor, or undefined if not found
 */
export function getNativeClass(glibTypeName: string): NativeClass | undefined {
    return registry.get(glibTypeName);
}

/**
 * Finds the nearest registered class by walking up the type hierarchy.
 * @param glibTypeName - The GLib type name to start from
 * @returns The registered class, or undefined if none found
 */
export const findNativeClass = (glibTypeName: string) => {
    let currentTypeName: string | null = glibTypeName;

    while (currentTypeName) {
        const cls = getNativeClass(currentTypeName);
        if (cls) return cls;

        const gtype = typeFromName(currentTypeName);
        if (gtype === 0) break;

        const parentGtype = typeParent(gtype);
        if (parentGtype === 0) break;

        currentTypeName = typeName(parentGtype);
    }
};
