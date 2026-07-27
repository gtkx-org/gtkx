import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";
import type { TypeId } from "../../gir/type-id.js";
import { inputParameters } from "../../analysis/param-structure.js";

const matchAsyncFinish = (
    library: Library,
    fn: GirFunction,
    siblings: GirFunction[],
): GirFunction | undefined => {
    if (!hasCanonicalAsyncCallback(library, fn)) {
        return undefined;
    }

    const finishFn = findFinishSibling(fn, siblings);

    if (finishFn === undefined || !isPromisifiableFinish(library, finishFn)) {
        return undefined;
    }

    return finishFn;
};

const findFinishSibling = (fn: GirFunction, siblings: GirFunction[]): GirFunction | undefined => {
    const annotated = fn.finishFunc;

    if (annotated !== undefined) {
        return siblings.find((sibling) => sibling.name === annotated || sibling.cIdentifier === annotated);
    }

    if (fn.name.endsWith("_finish")) {
        return undefined;
    }

    const root = fn.name.endsWith("_async") ? fn.name.slice(0, -"_async".length) : fn.name;
    const finishName = `${root}_finish`;

    return siblings.find((sibling) => sibling.name === finishName);
};

const callbackParameterName = (library: Library, ref: TypeId | undefined): string | undefined => {
    if (ref === undefined || library.typeFor(ref)?.kind !== "callback") {
        return undefined;
    }

    return library.nameFor(ref)?.typeName;
};

const hasCanonicalAsyncCallback = (library: Library, fn: GirFunction): boolean => {
    const callbackNames = fn.parameters
        .map((parameter) => callbackParameterName(library, parameter.type))
        .filter((name): name is string => name !== undefined);

    return callbackNames.length === 1 && callbackNames[0] === "AsyncReadyCallback";
};

const isPromisifiableFinish = (library: Library, finishFn: GirFunction): boolean => {
    const inputs = inputParameters(library, finishFn);

    if (inputs.length !== 1) {
        return false;
    }

    const only = inputs[0];

    return only?.parameter.type !== undefined && library.nameFor(only.parameter.type)?.typeName === "AsyncResult";
};

export { matchAsyncFinish };
