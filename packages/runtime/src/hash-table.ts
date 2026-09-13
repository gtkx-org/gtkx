const normalizeHashTableEntries = (value: unknown): [unknown, unknown][] | null => {
    if (value == null) {
        return null;
    }

    if (typeof (value as Partial<Iterable<unknown>>)[Symbol.iterator] !== "function") {
        throw new TypeError("A hash table argument must be a Map or an iterable of [key, value] pairs");
    }

    return [...(value as Iterable<[unknown, unknown]>)];
};

export { normalizeHashTableEntries };
