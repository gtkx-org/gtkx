import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";
import type { TypeId } from "../../gir/type-id.js";
import { inputParameters } from "../../analysis/param-structure.js";
import { primitiveCategoryFor } from "../../analysis/type-shape.js";

const matchAsyncFinish = (
    library: Library,
    fn: GirFunction,
    siblings: GirFunction[],
): GirFunction | undefined => {
    if (!hasPromisifiableCallbacks(library, fn)) {
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

const isCallbackParameter = (library: Library, ref: TypeId | undefined): boolean =>
    ref !== undefined && library.typeFor(ref)?.kind === "callback";

const isAsyncReadyCallback = (library: Library, ref: TypeId | undefined): boolean => {
    const name = ref === undefined ? undefined : library.nameFor(ref);

    return isCallbackParameter(library, ref) && name?.namespaceName === "Gio" && name.typeName === "AsyncReadyCallback";
};

const isVoidCallback = (library: Library, ref: TypeId | undefined): boolean => {
    const resolved = ref === undefined ? undefined : library.typeFor(ref);

    return resolved?.kind === "callback" &&
        primitiveCategoryFor(library, resolved.value.returnValue.type) === "void";
};

const hasPromisifiableCallbacks = (library: Library, fn: GirFunction): boolean => {
    const callbackParameters = fn.parameters.filter((parameter) =>
        isCallbackParameter(library, parameter.type));
    const readyCallbacks = callbackParameters.filter((parameter) =>
        isAsyncReadyCallback(library, parameter.type));
    const sideCallbacks = callbackParameters.filter((parameter) =>
        !isAsyncReadyCallback(library, parameter.type));

    return readyCallbacks.length === 1 && sideCallbacks.every((parameter) => isVoidCallback(library, parameter.type));
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
