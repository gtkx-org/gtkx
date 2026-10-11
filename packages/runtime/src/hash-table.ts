const normalizeHashTableEntries = (value: unknown): [unknown, unknown][] | null => {
    if (value == null) {
        return null;
    }

    return [...(value as Iterable<unknown>)].map((entry): [unknown, unknown] => {
        if (!Array.isArray(entry) || entry.length !== 2) {
            throw new TypeError("Expected [key, value] tuple in GHashTable");
        }
        return [entry[0], entry[1]];
    });
};

export { normalizeHashTableEntries };
