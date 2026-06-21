/**
 * Structural upper bound for any class constructor.
 *
 * The `...args: never[]` constructor signature makes this a type-level brand for
 * class registries rather than something directly newable: it accepts any
 * constructor (including abstract ones) while still exposing the instance type
 * `T` through `prototype`.
 *
 * @typeParam T - the instance type the constructor produces
 */
export type AnyClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    prototype: T;
};
