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

const getAccessibleMetadata = (widget: object, name: string): unknown => {
    const value = metadataStore.get(widget)?.get(name);

    return value === undefined ? null : value;
};

export { setAccessibleMetadata, deleteAccessibleMetadata, getAccessibleMetadata };
