/**
 * Returns a shallow copy of `record` with the listed keys removed.
 *
 * Keys absent from the record are ignored, and the source record is never
 * mutated. The return type drops the omitted keys so the type system no longer
 * believes they are present.
 *
 * @param record - the source record to copy from
 * @param keys - the keys to exclude from the copy
 * @returns a new record containing every key of `record` except those in `keys`
 */
export const omit = <T extends Record<string, unknown>, K extends keyof T>(record: T, keys: K[]): Omit<T, K> => {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
        if (!keys.includes(key as K)) {
            result[key] = record[key];
        }
    }
    return result as Omit<T, K>;
};

/**
 * Removes duplicate items, keeping the first occurrence of each distinct key.
 *
 * Items are compared by the string identity returned from `key`; the relative
 * order of the kept items matches their first-seen order in `items`. The source
 * array is never mutated.
 *
 * @param items - the items to deduplicate
 * @param key - derives the string identity each item is deduplicated by
 * @returns a new array with later duplicates of each identity removed
 */
export const dedupeBy = <T>(items: T[], key: (item: T) => string): T[] => {
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

/**
 * Compares two strings using locale-aware ordering.
 *
 * @param a - the first string
 * @param b - the second string
 * @returns a negative number when `a` sorts before `b`, positive when after, `0` when equal
 */
export const compareAlpha = (a: string, b: string): number => a.localeCompare(b);

/**
 * Returns the values sorted into a new array using {@link compareAlpha}.
 *
 * @param values - the strings to sort
 * @returns a new, locale-sorted array of the values
 */
export const sortedAlpha = (values: Iterable<string>): string[] => [...values].sort(compareAlpha);

/**
 * Returns the items sorted into a new array by the string each `key` derives,
 * using {@link compareAlpha}.
 *
 * @param items - the items to sort
 * @param key - derives the string each item is sorted by
 * @returns a new, locale-sorted array of the items
 */
export const sortedAlphaBy = <T>(items: Iterable<T>, key: (item: T) => string): T[] =>
    [...items].sort((a, b) => compareAlpha(key(a), key(b)));

/**
 * Shallowly compare two records for equality.
 *
 * Two records are equal when they are the same reference, or when they share the
 * same set of keys and every key maps to a strictly equal value. A missing record
 * is only equal to another missing record.
 *
 * @param a - The first record to compare.
 * @param b - The second record to compare.
 * @returns `true` when the records are shallowly equal.
 */
export const shallowEqual = <T extends Record<string, unknown>>(a?: T, b?: T): boolean => {
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

/**
 * Builds a value-to-name lookup from a numeric-enum object.
 *
 * TypeScript numeric enums are reverse-mapped objects holding both name->value
 * and value->name entries; this keeps only the value->name direction, dropping
 * the string-keyed reverse entries, and returns it as a `Map`.
 *
 * @param enumObject - the enum object (or plain object of numeric values) to invert
 * @returns a `Map` from each numeric value to its member name
 */
export const reverseNumericEnum = (enumObject: Record<string, string | number>): Map<number, string> =>
    new Map<number, string>(
        Object.entries(enumObject)
            .filter((entry): entry is [string, number] => typeof entry[1] === "number")
            .map(([name, value]) => [value, name]),
    );
