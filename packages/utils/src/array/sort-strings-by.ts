function sortStringsBy<T>(items: Iterable<T>, key: (item: T) => string): T[] {
    return [...items].toSorted((a, b) => key(a).localeCompare(key(b)));
}

export { sortStringsBy };
