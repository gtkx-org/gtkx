/**
 * Returns the values sorted as strings using locale-aware comparison.
 *
 * @param values - The strings to sort.
 * @returns A new array of the values in ascending locale order.
 *
 * @example
 * sortStrings(["b", "a", "c"]); // ["a", "b", "c"]
 */
function sortStrings(values: Iterable<string>): string[] {
    return [...values].toSorted((a, b) => a.localeCompare(b));
}

export { sortStrings };
