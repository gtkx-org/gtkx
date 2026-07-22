import { isPlainObject } from "./is-plain-object.js";

/**
 * Checks whether two values are shallowly equal: identical, or plain objects with the same own
 * enumerable keys and strictly equal (`===`) values. Values that are not both plain objects are
 * equal only when identical.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns `true` when the values are shallowly equal.
 *
 * @example
 * isShallowEqual({ a: 1 }, { a: 1 }); // true
 * isShallowEqual({ a: 1 }, { a: 2 }); // false
 * isShallowEqual(3, 3); // true
 */
export function isShallowEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (!isPlainObject(a) || !isPlainObject(b)) return false;

    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) return false;

    for (const key of keysA) {
        if (!Object.hasOwn(b, key) || a[key] !== b[key]) return false;
    }

    return true;
}
