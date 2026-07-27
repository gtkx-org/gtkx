/**
 * Creates a new object of the entries of `obj` that satisfy the predicate.
 *
 * @template T - The type of the source object.
 * @param obj - The object to pick entries from.
 * @param shouldPick - Called with each value and key; return `true` to keep the entry.
 * @returns A new object holding only the entries the predicate kept.
 *
 * @example
 * pickBy({ a: 1, b: 2 }, (value) => value > 1); // { b: 2 }
 * pickBy({ a: 1, b: 2 }, (_value, key) => key !== "a"); // { b: 2 }
 */
function pickBy<T extends Record<string, unknown>>(
    obj: T,
    shouldPick: (value: T[keyof T], key: keyof T) => boolean,
): Partial<T> {
    const result: Partial<T> = {};

    for (const key of Object.keys(obj) as (keyof T)[]) {
        const value = obj[key];

        if (shouldPick(value, key)) {
            result[key] = value;
        }
    }

    return result;
}

export { pickBy };
