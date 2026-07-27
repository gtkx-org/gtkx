import type { AnyClass } from "./any-class.js";
import { getParentClass } from "./get-parent-class.js";

/**
 * Walks the class chain from `cls` up through its ancestors, calling `visit` on each and returning
 * the first result that is not `undefined`.
 *
 * @template T - The type produced by the visitor.
 * @param cls - The class to start from, or `null` to visit nothing.
 * @param visit - Called with each class in the chain; a defined return value stops the walk.
 * @returns The first defined result from `visit`, or `undefined` when none was produced.
 */
function walkClassChain<T>(cls: AnyClass | null, visit: (ancestor: AnyClass) => T | undefined): T | undefined {
    let current = cls;

    while (current !== null) {
        const result = visit(current);

        if (result !== undefined) {
            return result;
        }

        current = getParentClass(current);
    }

    return undefined;
}

export { walkClassChain };
