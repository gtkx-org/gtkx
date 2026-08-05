/** Any class constructor, abstract ones included, whose instances are `T`. */
type AnyClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    /** Object the class's instances inherit from. */
    prototype: T;
};

export { type AnyClass };
