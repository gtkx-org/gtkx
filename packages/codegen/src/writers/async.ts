import type { GirFunction } from "../gir/function.js";
import type { GirRepository } from "../gir/repository.js";

export const matchAsyncFinishName = (
    repository: GirRepository,
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
    if (!hasAsyncReadyCallbackParameter(repository, fn)) return undefined;
    return finishName;
};

const hasAsyncReadyCallbackParameter = (repository: GirRepository, fn: GirFunction): boolean => {
    for (const parameter of fn.parameters) {
        if (parameter.scope !== undefined) return true;
        if (parameter.type === undefined) continue;
        if (repository.nameOf(parameter.type)?.typeName === "AsyncReadyCallback") return true;
    }
    return false;
};
