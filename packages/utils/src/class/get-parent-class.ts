import type { AnyClass } from "./any-class.ts";

function getParentClass(cls: AnyClass): AnyClass | null {
    const parent: unknown = Object.getPrototypeOf(cls);

    return typeof parent === "function" && parent !== Function.prototype ? (parent as AnyClass) : null;
}

export { getParentClass };
