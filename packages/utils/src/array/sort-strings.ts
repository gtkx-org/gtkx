function sortStrings(values: Iterable<string>): string[] {
    return [...values].toSorted((a, b) => a.localeCompare(b));
}

export { sortStrings };
