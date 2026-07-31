import { isPlainObject } from "../predicate/is-plain-object.ts";

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
