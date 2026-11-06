import { enumTypeTag, type TypedEnum } from "./type.js";

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

/**
 * Gives a generated enum, flags or error domain object the `__type__` GType field generated classes
 * carry, so the object can be passed wherever a GType is taken. The GType is resolved on first read,
 * which registers the type, and the field is non-enumerable so iterating the object still yields only
 * its members.
 *
 * @param target The enum, flags or error domain object.
 * @param resolveGType Returns the GType, typically by calling the type's `get_type` function.
 * @returns `target`, typed with its GType field.
 */
function defineEnumType<T extends object>(target: T, resolveGType: () => bigint): T & TypedEnum {
    Object.defineProperty(target, "__type__", { get: resolveGType, configurable: true });
    Object.defineProperty(target, enumTypeTag, { value: true });

    return target as T & TypedEnum;
}

export { defineEnumType, defineStatics };
