import { inputParameters } from "../../analysis/param-structure.js";
import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";

export const matchAsyncFinish = (
    library: Library,
    fn: GirFunction,
    siblings: GirFunction[],
): GirFunction | undefined => {
    if (!hasCanonicalAsyncCallback(library, fn)) return undefined;
    const finishFn = findFinishSibling(fn, siblings);
    if (finishFn === undefined || !isPromisifiableFinish(library, finishFn)) return undefined;
    return finishFn;
};

const findFinishSibling = (fn: GirFunction, siblings: GirFunction[]): GirFunction | undefined => {
    const annotated = fn.finishFunc;
    if (annotated !== undefined) {
        return siblings.find((sibling) => sibling.name === annotated || sibling.cIdentifier === annotated);
    }
    if (fn.name.endsWith("_finish")) return undefined;
    const root = fn.name.endsWith("_async") ? fn.name.slice(0, -"_async".length) : fn.name;
    const finishName = `${root}_finish`;
    return siblings.find((sibling) => sibling.name === finishName);
};

const hasCanonicalAsyncCallback = (library: Library, fn: GirFunction): boolean => {
    let asyncReadyCallbacks = 0;
    let otherCallbacks = 0;
    for (const parameter of fn.parameters) {
        const ref = parameter.type;
        if (ref === undefined || library.typeOf(ref)?.kind !== "callback") continue;
        if (library.nameOf(ref)?.typeName === "AsyncReadyCallback") asyncReadyCallbacks += 1;
        else otherCallbacks += 1;
    }
    return asyncReadyCallbacks === 1 && otherCallbacks === 0;
};

const isPromisifiableFinish = (library: Library, finishFn: GirFunction): boolean => {
    const inputs = inputParameters(library, finishFn);
    if (inputs.length !== 1) return false;
    const only = inputs[0];
    return only?.parameter.type !== undefined && library.nameOf(only.parameter.type)?.typeName === "AsyncResult";
};
