/**
 * Creates a new object holding every entry of `obj` except the named keys.
 *
 * @template T - The type of the source object.
 * @template K - The keys to leave out.
 * @param obj - The object to copy entries from.
 * @param keys - The keys to leave out of the result.
 * @returns A new object without the named keys.
 *
 * @example
 * omit({ a: 1, b: 2 }, ["a"]); // { b: 2 }
 */
function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const excluded: Set<PropertyKey> = new Set(keys);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (!excluded.has(key)) {
            result[key] = value;
        }
    }

    return result as Omit<T, K>;
}

export { omit };
