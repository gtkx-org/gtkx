import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";

export const matchAsyncFinishName = (
    library: Library,
    fn: GirFunction,
    siblings: GirFunction[],
): string | undefined => {
    if (fn.name.endsWith("_async")) {
        const root = fn.name.slice(0, -"_async".length);
        const finishName = `${root}_finish`;
        const match = siblings.find((sibling) => sibling.name === finishName);
        return match === undefined ? undefined : finishName;
    }
    if (fn.name.endsWith("_finish")) return undefined;
    const finishName = `${fn.name}_finish`;
    const match = siblings.find((sibling) => sibling.name === finishName);
    if (match === undefined) return undefined;
    if (!hasAsyncReadyCallbackParameter(library, fn)) return undefined;
    return finishName;
};

const hasAsyncReadyCallbackParameter = (library: Library, fn: GirFunction): boolean => {
    for (const parameter of fn.parameters) {
        if (parameter.scope !== undefined) return true;
        if (parameter.type === undefined) continue;
        if (library.nameOf(parameter.type)?.typeName === "AsyncReadyCallback") return true;
    }
    return false;
};
