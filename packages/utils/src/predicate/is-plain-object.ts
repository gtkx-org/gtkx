/**
 * Checks whether a value is a plain object, i.e. one whose prototype is `Object.prototype` or `null`.
 *
 * Class instances, arrays, and other exotic objects return `false`.
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a plain object.
 *
 * @example
 * isPlainObject({ a: 1 }); // true
 * isPlainObject(Object.create(null)); // true
 * isPlainObject([1, 2]); // false
 * isPlainObject(new Date()); // false
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const proto: unknown = Object.getPrototypeOf(value);

    return proto === Object.prototype || proto === null;
}

export { isPlainObject };
