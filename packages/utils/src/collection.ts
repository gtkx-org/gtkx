/**
 * Returns the items with duplicates removed, keeping the first item for each distinct key.
 *
 * @param items The items to deduplicate.
 * @param key Computes the identity string used to detect duplicates.
 */
export const uniqBy = <T>(items: T[], key: (item: T) => string): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];
    for (const item of items) {
        const identity = key(item);
        if (seen.has(identity)) continue;
        seen.add(identity);
        result.push(item);
    }
    return result;
};

const compareStrings = (a: string, b: string): number => a.localeCompare(b);

/**
 * Returns a new array of the given strings sorted with locale-aware comparison.
 *
 * @param values The strings to sort.
 */
export const sortStrings = (values: Iterable<string>): string[] => [...values].sort(compareStrings);

/**
 * Returns a new array of the given items sorted by a locale-aware comparison of their keys.
 *
 * @param items The items to sort.
 * @param key Computes the string to sort each item by.
 */
export const sortStringsBy = <T>(items: Iterable<T>, key: (item: T) => string): T[] =>
    [...items].sort((a, b) => compareStrings(key(a), key(b)));

/**
 * Determines whether two records have the same keys and strictly equal values.
 *
 * @param a The first record, or `undefined`.
 * @param b The second record, or `undefined`.
 * @returns `true` when both are the same reference, or both are defined with identical own keys and values.
 */
export const isShallowEqual = <T extends Record<string, unknown>>(a?: T, b?: T): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }

    return true;
};
