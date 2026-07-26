/**
 * Returns the items sorted by a string key using locale-aware comparison.
 *
 * @template T - The type of items being sorted.
 * @param items - The items to sort.
 * @param key - Maps an item to the string its order is decided by.
 * @returns A new array of the items in ascending locale order of their keys.
 *
 * @example
 * sortStringsBy([{ name: "b" }, { name: "a" }], (item) => item.name);
 * // [{ name: "a" }, { name: "b" }]
 */
function sortStringsBy<T>(items: Iterable<T>, key: (item: T) => string): T[] {
    return [...items].toSorted((a, b) => key(a).localeCompare(key(b)));
}

export { sortStringsBy };
