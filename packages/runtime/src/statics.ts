/**
 * Adds functions to a generated enum or error domain object as non-enumerable members, like the
 * statics of a class, so iterating the object still yields only its members.
 *
 * @param target The enum or error domain object.
 * @param statics Functions keyed by their member name.
 * @returns `target`, typed with the added functions.
 */
function defineStatics<T extends object, S extends Record<string, (...args: never[]) => unknown>>(
    target: T,
    statics: S,
): T & S {
    for (const [name, value] of Object.entries(statics)) {
        Object.defineProperty(target, name, { value, writable: true, configurable: true });
    }

    return target as T & S;
}

export { defineStatics };
