import { isPlainObject } from "../predicate/is-plain-object.js";

/**
 * Recursively copies arrays and plain objects, sharing every other value by reference. The result
 * mirrors exactly the structure `isDeepEqual` traverses, so comparing a value against its earlier
 * clone detects in-place mutations of the original.
 *
 * @template T - The type of the value.
 * @param value - The value to clone.
 * @returns A clone whose arrays and plain objects are fresh and whose other values are shared.
 *
 * @example
 * const source = { a: [{ b: 1 }] };
 * const copy = structuralClone(source);
 * source.a[0].b = 2;
 * copy.a[0].b; // 1
 */
export function structuralClone<T>(value: T): T {
    if (Array.isArray(value)) return value.map(structuralClone) as T;
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, structuralClone(entry)])) as T;
    }
    return value;
}
