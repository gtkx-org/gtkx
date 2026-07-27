const metadataStore: WeakMap<object, Map<string, unknown>> = new WeakMap();

const setAccessibleMetadata = (widget: object, name: string, value: unknown): void => {
    let entries = metadataStore.get(widget);

    if (entries === undefined) {
        entries = new Map();
        metadataStore.set(widget, entries);
    }

    entries.set(name, value);
};

const deleteAccessibleMetadata = (widget: object, name: string): void => {
    metadataStore.get(widget)?.delete(name);
};

/**
 * Returns the last value applied for an accessible prop on a widget, or null when none was applied.
 *
 * @param widget The widget to read from.
 * @param name The accessible prop name.
 * @returns The last applied value, or null.
 */
const getAccessibleMetadata = (widget: object, name: string): unknown => {
    const value = metadataStore.get(widget)?.get(name);

    return value === undefined ? null : value;
};

export { setAccessibleMetadata, deleteAccessibleMetadata, getAccessibleMetadata };
