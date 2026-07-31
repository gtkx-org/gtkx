import type { AnyClass } from "./any-class.ts";
import { getParentClass } from "./get-parent-class.ts";

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
