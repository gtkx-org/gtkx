/**
 * Pure, runtime-agnostic collection helpers shared across GTKX packages.
 */

/**
 * Returns a shallow copy of `record` with the given `keys` removed.
 *
 * Keys absent from `record` are ignored, and `record` is not mutated. The
 * result is typed as the input shape because callers treat the excluded keys
 * as runtime-only concerns absent from the static type.
 *
 * @typeParam T - The record shape.
 * @param record - The source object.
 * @param keys - The keys to exclude from the copy.
 * @returns A new object holding every own enumerable key of `record` except
 *   those listed in `keys`.
 */
export const omit = <T extends Record<string, unknown>>(record: T, keys: readonly string[]): T => {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
        if (!keys.includes(key)) {
            result[key] = record[key];
        }
    }
    return result as T;
};

/**
 * Returns the items of `items` in order, keeping only the first occurrence of
 * each distinct key.
 *
 * The key projection collapses duplicates: items whose `key` was already seen
 * are dropped, so `dedupeBy(props, (p) => p.name)` yields one item per name in
 * first-seen order. The input is not mutated.
 *
 * @typeParam T - The item type.
 * @param items - The items to deduplicate.
 * @param key - Projects each item to the string key identity is compared on.
 * @returns A new array holding the first item seen for each distinct key.
 */
export const dedupeBy = <T>(items: readonly T[], key: (item: T) => string): T[] => {
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
 * Builds a reverse lookup from a numeric enum's values to their member names.
 *
 * A TypeScript numeric enum's runtime object carries both name-to-value and
 * value-to-name entries; this keeps only the name-to-value direction and
 * inverts it, yielding a `Map` from each numeric value to the name that
 * declared it.
 *
 * @param enumObject - A numeric enum's runtime object.
 * @returns A map from each numeric enum value to its declared member name.
 */
export const reverseNumericEnum = (enumObject: Record<string, string | number>): Map<number, string> =>
    new Map<number, string>(
        Object.entries(enumObject)
            .filter((entry): entry is [string, number] => typeof entry[1] === "number")
            .map(([name, value]) => [value, name]),
    );
