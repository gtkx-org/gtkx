import { isPlainObject } from "../predicate/is-plain-object.js";

/**
 * Recursively copies arrays and plain objects, sharing every other value by reference. The result
 * mirrors exactly the structure `isDeepEqual` traverses, so comparing a value against its earlier
 * clone detects in-place mutations of the original. Unlike the global of the same name, class
 * instances such as `Date` and `Map` are shared rather than copied, and no value is ever rejected.
 *
 * @template T - The type of the value.
 * @param value - The value to clone.
 * @returns A clone whose arrays and plain objects are fresh and whose other values are shared.
 *
 * @example
 * const source = { a: [{ b: 1 }] };
 * const copy = structuredClone(source);
 * source.a[0].b = 2;
 * copy.a[0].b; // 1
 */
function structuredClone<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item: unknown) => structuredClone(item)) as T;
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, structuredClone(entry)])) as T;
    }

    return value;
}

export { structuredClone };
