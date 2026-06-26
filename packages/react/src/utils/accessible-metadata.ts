import type * as Gtk from "@gtkx/gi/gtk";

type AccessibleMetadata = Map<string, unknown>;

const accessibleMetadata = new WeakMap<Gtk.Accessible, AccessibleMetadata>();

const getOrCreateMetadata = (widget: Gtk.Accessible): AccessibleMetadata => {
    let entry = accessibleMetadata.get(widget);
    if (!entry) {
        entry = new Map();
        accessibleMetadata.set(widget, entry);
    }
    return entry;
};

export const setAccessibleMetadata = (widget: Gtk.Accessible, propName: string, value: unknown): void => {
    getOrCreateMetadata(widget).set(propName, value);
};

export const deleteAccessibleMetadata = (widget: Gtk.Accessible, propName: string): void => {
    const entry = accessibleMetadata.get(widget);
    if (entry) entry.delete(propName);
};

export const getAccessibleMetadata = <T = unknown>(widget: Gtk.Accessible, propName: string): T | null => {
    const entry = accessibleMetadata.get(widget);
    if (!entry) return null;
    const value = entry.get(propName);
    return (value as T) ?? null;
};
