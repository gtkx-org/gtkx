import { areObjectKeysEqual } from "./are-object-keys-equal.js";
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
const isStrictEqual = (a: unknown, b: unknown): boolean => a === b;

function isShallowEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }

    if (isPlainObject(a) && isPlainObject(b)) {
        return areObjectKeysEqual(a, b, isStrictEqual);
    }

    return false;
}

export { isShallowEqual };
