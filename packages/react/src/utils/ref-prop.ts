import type { RefObject } from "react";

/**
 * A way to reach a GObject: the object itself, a ref object whose `current` is the object or null,
 * or null or undefined when the target is absent.
 */
type RefProp<T extends object> = T | RefObject<T | null> | null | undefined;

const isRefObject = <T extends object>(value: T | RefObject<T | null>): value is RefObject<T | null> =>
    typeof value === "object" && "current" in value;

/**
 * Resolves a {@link RefProp} to the concrete object it points at, or null when it is absent or unresolved.
 *
 * @param prop The target object, a ref to one, or null/undefined.
 * @returns The resolved object, or null.
 */
const resolveRefProp = <T extends object>(prop: RefProp<T>): T | null => {
    if (prop === null || prop === undefined) {
        return null;
    }

    if (isRefObject(prop)) {
        return prop.current;
    }

    return prop;
};

export { resolveRefProp, type RefProp };
