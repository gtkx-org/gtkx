import type * as Gtk from "@gtkx/gi/gtk";

type AccessibleMetadata = Map<string, unknown>;

const widgetMetadata = new WeakMap<Gtk.Widget, AccessibleMetadata>();

const getOrCreateMetadata = (widget: Gtk.Widget): AccessibleMetadata => {
    let entry = widgetMetadata.get(widget);
    if (!entry) {
        entry = new Map();
        widgetMetadata.set(widget, entry);
    }
    return entry;
};

export const setAccessibleMetadata = (widget: Gtk.Widget, propName: string, value: unknown): void => {
    getOrCreateMetadata(widget).set(propName, value);
};

export const deleteAccessibleMetadata = (widget: Gtk.Widget, propName: string): void => {
    const entry = widgetMetadata.get(widget);
    if (entry) entry.delete(propName);
};

export const getAccessibleMetadata = <T = unknown>(widget: Gtk.Widget, propName: string): T | null => {
    const entry = widgetMetadata.get(widget);
    if (!entry) return null;
    const value = entry.get(propName);
    return (value as T) ?? null;
};
