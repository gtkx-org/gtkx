import type * as Gtk from "@gtkx/gi/gtk";

type AccessibleMetadata = Map<string, unknown>;

const accessibleMetadata = new WeakMap<Gtk.Accessible, AccessibleMetadata>();

const getOrCreateMetadata = (accessible: Gtk.Accessible): AccessibleMetadata => {
    let entry = accessibleMetadata.get(accessible);
    if (!entry) {
        entry = new Map();
        accessibleMetadata.set(accessible, entry);
    }
    return entry;
};

export const setAccessibleMetadata = (accessible: Gtk.Accessible, propName: string, value: unknown): void => {
    getOrCreateMetadata(accessible).set(propName, value);
};

export const deleteAccessibleMetadata = (accessible: Gtk.Accessible, propName: string): void => {
    const entry = accessibleMetadata.get(accessible);
    if (entry) entry.delete(propName);
};

/**
 * Returns the stored value of an accessible prop previously applied to a widget, or `null` if none is set.
 *
 * @param accessible The widget whose accessible metadata to read.
 * @param propName The accessible prop name to look up.
 */
export const getAccessibleMetadata = <T = unknown>(accessible: Gtk.Accessible, propName: string): T | null => {
    const entry = accessibleMetadata.get(accessible);
    if (!entry) return null;
    const value = entry.get(propName);
    return (value as T) ?? null;
};
