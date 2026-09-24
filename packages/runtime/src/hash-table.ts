const normalizeHashTableEntries = (value: unknown): [unknown, unknown][] | null => {
    if (value == null) {
        return null;
    }

    return [...(value as Iterable<[unknown, unknown]>)];
};

export { normalizeHashTableEntries };
