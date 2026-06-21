export const omit = <T extends Record<string, unknown>>(record: T, keys: string[]): T => {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
        if (!keys.includes(key)) {
            result[key] = record[key];
        }
    }
    return result as T;
};

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

export const compareAlpha = (a: string, b: string): number => a.localeCompare(b);

export const sortedAlpha = (values: Iterable<string>): string[] => [...values].sort(compareAlpha);

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

export const reverseNumericEnum = (enumObject: Record<string, string | number>): Map<number, string> =>
    new Map<number, string>(
        Object.entries(enumObject)
            .filter((entry): entry is [string, number] => typeof entry[1] === "number")
            .map(([name, value]) => [value, name]),
    );
