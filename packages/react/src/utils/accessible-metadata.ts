const metadataStore = new WeakMap<object, Map<string, unknown>>();

export const setAccessibleMetadata = (widget: object, name: string, value: unknown): void => {
    let entries = metadataStore.get(widget);
    if (entries === undefined) {
        entries = new Map();
        metadataStore.set(widget, entries);
    }
    entries.set(name, value);
};

export const deleteAccessibleMetadata = (widget: object, name: string): void => {
    metadataStore.get(widget)?.delete(name);
};

/**
 * Returns the last value applied for an accessible prop on a widget, or null when none was applied.
 *
 * @param widget The widget to read from.
 * @param name The accessible prop name.
 * @returns The last applied value, or null.
 */
export const getAccessibleMetadata = <T>(widget: object, name: string): T | null => {
    const value = metadataStore.get(widget)?.get(name);
    return value === undefined ? null : (value as T);
};
