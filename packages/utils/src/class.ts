/**
 * A constructor value of any (possibly abstract) class producing instances of `T`.
 */
export type AnyClass<T extends object = object> = (abstract new (
    ...args: never[]
) => T) & {
    prototype: T;
};

/**
 * Returns the direct superclass of `cls`, or `null` when it has no class ancestor.
 *
 * @param cls The class whose prototype parent to inspect.
 */
export function getParentClass(cls: AnyClass): AnyClass | null {
    const parent: unknown = Object.getPrototypeOf(cls);
    return typeof parent === "function" && parent !== Function.prototype ? (parent as AnyClass) : null;
}

/**
 * Walks the class chain from `cls` up through its ancestors, calling `visit` on each and
 * returning the first result that is not `undefined`.
 *
 * @param cls The class to start from, or `null` to visit nothing.
 * @param visit Called with each class in the chain; a defined return value stops the walk.
 * @returns The first defined result from `visit`, or `undefined` if none was produced.
 */
export function walkClassChain<T>(cls: AnyClass | null, visit: (ancestor: AnyClass) => T | undefined): T | undefined {
    let current = cls;
    while (current !== null) {
        const result = visit(current);
        if (result !== undefined) return result;
        current = getParentClass(current);
    }
    return undefined;
}
