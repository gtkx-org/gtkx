/**
 * A constructor value of any (possibly abstract) class producing instances of `T`.
 */
export type AnyClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    prototype: T;
};
