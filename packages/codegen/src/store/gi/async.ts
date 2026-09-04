import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { TypeId } from "../../gir/type-id.js";
import { inputParameters } from "../../analysis/param-structure.js";
import { primitiveCategoryFor } from "../../analysis/type-shape.js";

const ASYNC_SUFFIX = "_async";
const FINISH_SUFFIX = "_finish";

const matchAsyncFinish = (
    library: Library,
    fn: GirFunction,
    siblings: GirFunction[],
): GirFunction | undefined => {
    if (!hasPromisifiableCallbacks(library, fn)) {
        return undefined;
    }

    const finishFn = findFinishSibling(library, fn, siblings);

    if (finishFn === undefined || !isPromisifiableFinish(library, finishFn)) {
        return undefined;
    }

    return finishFn;
};

const findFinishSibling = (library: Library, fn: GirFunction, siblings: GirFunction[]): GirFunction | undefined => {
    if (fn.finishFunc === undefined) {
        return derivedFinishSibling(fn, siblings);
    }

    const annotated = annotatedFinishSibling(fn, siblings);

    if (annotated !== undefined || externalFinishOwner(library, fn) === undefined) {
        return annotated;
    }

    return derivedFinishSibling(fn, siblings) ?? genericFinishSibling(library, fn, siblings);
};

const annotatedFinishSibling = (fn: GirFunction, siblings: GirFunction[]): GirFunction | undefined => {
    const annotated = fn.finishFunc;

    return annotated === undefined
        ? undefined
        : siblings.find((sibling) => sibling.name === annotated || sibling.cIdentifier === annotated);
};

const derivedFinishSibling = (fn: GirFunction, siblings: GirFunction[]): GirFunction | undefined => {
    if (fn.name.endsWith(FINISH_SUFFIX)) {
        return undefined;
    }

    const root = fn.name.endsWith(ASYNC_SUFFIX) ? fn.name.slice(0, -ASYNC_SUFFIX.length) : fn.name;
    const finishName = `${root}${FINISH_SUFFIX}`;

    return siblings.find((sibling) => sibling.name === finishName);
};

const claimedFinishSiblings = (fn: GirFunction, siblings: GirFunction[]): Set<GirFunction> => {
    const claimed: Set<GirFunction> = new Set();

    for (const sibling of siblings) {
        const finishFn = sibling === fn
            ? undefined
            : annotatedFinishSibling(sibling, siblings) ?? derivedFinishSibling(sibling, siblings);

        if (finishFn !== undefined) {
            claimed.add(finishFn);
        }
    }

    return claimed;
};

const genericFinishSibling = (library: Library, fn: GirFunction, siblings: GirFunction[]): GirFunction | undefined => {
    const claimed = claimedFinishSiblings(fn, siblings);

    const candidates = siblings.filter((sibling) =>
        sibling.name.endsWith(FINISH_SUFFIX) && !claimed.has(sibling) && isPromisifiableFinish(library, sibling));

    return candidates.length === 1 ? candidates[0] : undefined;
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

type ExternalFinishOwner = { member: GirFunction; namespaceName: string; typeName: string };

const externalFinishOwnerIn = (namespace: GirNamespace, finishFunc: string): ExternalFinishOwner | undefined => {
    const types = [...namespace.classes, ...namespace.interfaces, ...namespace.records];

    for (const type of types) {
        const member = [...type.methods, ...type.functions].find((candidate) => candidate.cIdentifier === finishFunc);

        if (member !== undefined) {
            return { member, namespaceName: namespace.name, typeName: type.name };
        }
    }

    return undefined;
};

const externalFinishOwner = (
    library: Library,
    fn: GirFunction,
): ExternalFinishOwner | undefined => {
    const finishFunc = fn.finishFunc;

    if (finishFunc === undefined) {
        return undefined;
    }

    for (const namespace of library.namespaces.values()) {
        const owner = externalFinishOwnerIn(namespace, finishFunc);

        if (owner !== undefined) {
            return owner;
        }
    }

    return undefined;
};

export { externalFinishOwner, matchAsyncFinish };
