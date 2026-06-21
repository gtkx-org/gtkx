/**
 * Structural type for any class constructor, abstract or concrete.
 *
 * @public
 */
export type AnyClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    prototype: T;
};
