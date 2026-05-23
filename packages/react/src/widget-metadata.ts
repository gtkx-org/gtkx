import type * as Gtk from "@gtkx/ffi/gtk";

/**
 * Per-widget metadata maintained by the reconciler for accessible properties
 * that are written through {@link Gtk.Accessible.updateProperty} (e.g.
 * `accessibleLabel`, `accessibleDescription`). GTK 4 stores those values in
 * the AT context and provides no public reader, so we mirror the write into a
 * JS-side `WeakMap` to keep the values introspectable from testing utilities
 * and other consumers that need to read what the reconciler has written.
 *
 * Keys are JSX prop names (e.g. `"accessibleLabel"`). Values are whatever the
 * caller most recently set; the entry is cleared when the prop is removed.
 */
type AccessibleMetadata = Map<string, unknown>;

const widgetMetadata = new WeakMap<Gtk.Widget, AccessibleMetadata>();

const getOrCreate = (widget: Gtk.Widget): AccessibleMetadata => {
    let entry = widgetMetadata.get(widget);
    if (!entry) {
        entry = new Map();
        widgetMetadata.set(widget, entry);
    }
    return entry;
};

/**
 * Records the value of an accessible JSX prop applied to `widget`. Called by
 * the reconciler whenever it writes one of the `accessible*` props.
 */
export const setAccessibleMetadata = (widget: Gtk.Widget, propName: string, value: unknown): void => {
    getOrCreate(widget).set(propName, value);
};

/**
 * Removes a previously-recorded accessible JSX prop value. Called by the
 * reconciler when the prop is unset.
 */
export const deleteAccessibleMetadata = (widget: Gtk.Widget, propName: string): void => {
    const entry = widgetMetadata.get(widget);
    if (entry) entry.delete(propName);
};

/**
 * Reads the most recent value of an accessible JSX prop applied to `widget`,
 * or `null` if none was recorded. Returns the typed value if it matches the
 * caller's expected shape; otherwise returns `null`.
 */
export const getAccessibleMetadata = <T = unknown>(widget: Gtk.Widget, propName: string): T | null => {
    const entry = widgetMetadata.get(widget);
    if (!entry) return null;
    const value = entry.get(propName);
    return (value as T) ?? null;
};
