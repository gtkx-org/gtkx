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
 * Compares two arrays of primitives for element-wise strict equality.
 *
 * Returns `true` when both arguments are the same reference (including both
 * being `null` or `undefined`), or when they have equal length and every
 * element is strictly equal (`===`) at the same index. A `null`/`undefined`
 * argument is equal only to another `null`/`undefined` argument.
 *
 * @typeParam T - The primitive element type.
 * @param a - The first array, or `null`/`undefined`.
 * @param b - The second array, or `null`/`undefined`.
 * @returns Whether the two arrays are shallowly equal.
 */
export const isShallowEqual = <T extends string | number | boolean>(
    a: readonly T[] | null | undefined,
    b: readonly T[] | null | undefined,
): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

/**
 * Compares two arrays of records by shallow per-element equality.
 *
 * Returns `true` when both arrays have equal length and, at every index, the
 * two records expose the same set of keys with strictly equal (`===`) values.
 * Values are compared one level deep only; nested objects are compared by
 * reference.
 *
 * @typeParam T - The record element type.
 * @param a - The first array of records.
 * @param b - The second array of records.
 * @returns Whether the two arrays are element-wise shallowly equal.
 */
export const isShallowArrayEqual = <T extends Record<string, unknown>>(a: readonly T[], b: readonly T[]): boolean => {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        const itemA = a[i];
        const itemB = b[i];
        if (!itemA || !itemB) return false;

        const keysA = Object.keys(itemA);
        const keysB = Object.keys(itemB);
        if (keysA.length !== keysB.length) return false;

        for (const key of keysA) {
            if (itemA[key] !== itemB[key]) return false;
        }
    }

    return true;
};
