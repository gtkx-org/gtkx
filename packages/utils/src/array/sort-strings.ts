/** Sorts strings by locale, leaving the given iterable untouched. */
function sortStrings(values: Iterable<string>): string[] {
    return [...values].toSorted((a, b) => a.localeCompare(b));
}

export { sortStrings };
