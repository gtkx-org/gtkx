/**
 * Structural type matching any class — abstract or concrete — whose instances
 * have type `T`.
 *
 * A class value carries a construct signature plus a `prototype`, but a bare
 * construct signature types `prototype` as `any`. The `& { prototype: T }`
 * intersection recovers the precise instance type so callers can read
 * `cls.prototype` as `T`, and the `abstract new` form accepts both abstract and
 * concrete classes, making this the widest supertype of every class value. The
 * `never[]` constructor parameters admit any class while documenting that the
 * type is used as an identity token, not to construct instances.
 */
export type AnyClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    readonly prototype: T;
};
