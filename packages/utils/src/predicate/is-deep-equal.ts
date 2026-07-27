import { areObjectKeysEqual } from "./are-object-keys-equal.js";
import { isPlainObject } from "./is-plain-object.js";

/**
 * Checks whether two values are deeply equal: identical, arrays of the same length whose elements
 * are deeply equal in order, or plain objects with the same own enumerable keys and deeply equal
 * values. Values that are neither both arrays nor both plain objects are equal only when identical.
 *
 * @param a - The first value.
 * @param b - The second value.
 * @returns `true` when the values are deeply equal.
 *
 * @example
 * isDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }); // true
 * isDeepEqual({ a: [1] }, { a: [2] }); // false
 */
const isDeepArrayEqual = (a: unknown, b: unknown): boolean => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }

    return a.every((item, index) => isDeepEqual(item, b[index]));
};

function isDeepEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }

    if (Array.isArray(a) || Array.isArray(b)) {
        return isDeepArrayEqual(a, b);
    }

    if (isPlainObject(a) && isPlainObject(b)) {
        return areObjectKeysEqual(a, b, isDeepEqual);
    }

    return false;
}

export { isDeepEqual };
