import type { AnyClass } from "./any-class.ts";

/**
 * Returns the direct superclass of `cls`, or `null` when it has no class ancestor.
 *
 * @param cls - The class whose prototype parent to inspect.
 * @returns The parent class, or `null` when there is none.
 */
function getParentClass(cls: AnyClass): AnyClass | null {
    const parent: unknown = Object.getPrototypeOf(cls);

    return typeof parent === "function" && parent !== Function.prototype ? (parent as AnyClass) : null;
}

export { getParentClass };
