/**
 * Checks whether a value is a non-null object (including arrays and class instances, excluding `null`).
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a non-null object.
 *
 * @example
 * isRecord({ a: 1 }); // true
 * isRecord(null); // false
 * isRecord("x"); // false
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export { isRecord };
