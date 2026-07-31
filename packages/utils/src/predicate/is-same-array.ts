import { isSameArrayBy } from "./is-same-array-by.ts";

/**
 * Checks whether two arrays have the same length and strictly equal (`===`) elements in order.
 *
 * @template T - The type of the array elements.
 * @param a - The first array.
 * @param b - The second array.
 * @returns `true` when the arrays are element-wise strictly equal.
 *
 * @example
 * isSameArray([1, 2], [1, 2]); // true
 * isSameArray([1, 2], [2, 1]); // false
 */
function isSameArray<T>(a: T[], b: T[]): boolean {
    return isSameArrayBy(a, b, (x, y) => x === y);
}

export { isSameArray };
