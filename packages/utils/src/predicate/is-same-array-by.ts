/**
 * Checks whether two arrays have the same length and elements the comparator treats as equal, in order.
 *
 * @template T - The type of the array elements.
 * @param a - The first array.
 * @param b - The second array.
 * @param isEqual - Compares elements at the same index; return `true` when they are equal.
 * @returns `true` when the arrays are element-wise equal under `isEqual`.
 *
 * @example
 * isSameArrayBy([{ id: 1 }], [{ id: 1 }], (x, y) => x.id === y.id); // true
 */
function isSameArrayBy<T>(a: T[], b: T[], isEqual: (x: T, y: T) => boolean): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((item, index) => isEqual(item, b[index] as T));
}

export { isSameArrayBy };
