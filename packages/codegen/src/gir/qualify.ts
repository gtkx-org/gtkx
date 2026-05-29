import type { GirFunction } from "./function.js";
import type { GirParameter } from "./parameter.js";
import type { GirTypeRef } from "./type-ref.js";

/**
 * Stamps a default namespace onto an unqualified `named` reference and
 * recurses into composite (`array`, `list`, `hashtable`) references.
 *
 * GIR omits the namespace when a reference points to a sibling in the same
 * file. When writers walk a class hierarchy across namespaces, the parent's
 * references must be qualified with the parent's namespace before they can be
 * resolved against the repository.
 *
 * Returns `undefined` for an `undefined` input so callers can pass through
 * void return types unchanged.
 *
 * @param ref - The reference to qualify, or `undefined`
 * @param defaultNamespace - The namespace to stamp on unqualified refs
 */
export const qualifyTypeRef = (ref: GirTypeRef | undefined, defaultNamespace: string): GirTypeRef | undefined => {
    if (ref === undefined) return undefined;
    switch (ref.kind) {
        case "named":
            return { ...ref, namespaceName: ref.namespaceName ?? defaultNamespace };
        case "array":
            return { ...ref, element: qualifyTypeRef(ref.element, defaultNamespace) ?? ref.element };
        case "list":
            return { ...ref, element: qualifyTypeRef(ref.element, defaultNamespace) ?? ref.element };
        case "hashtable":
            return {
                ...ref,
                key: qualifyTypeRef(ref.key, defaultNamespace) ?? ref.key,
                value: qualifyTypeRef(ref.value, defaultNamespace) ?? ref.value,
            };
        case "primitive":
        case "callback":
        case "varargs":
            return ref;
    }
};

const qualifyParameter = (parameter: GirParameter, defaultNamespace: string): GirParameter => ({
    ...parameter,
    type: qualifyTypeRef(parameter.type, defaultNamespace),
});

/**
 * Re-roots every type reference of a callable to `defaultNamespace`.
 *
 * Interface methods are flattened onto each implementing class, but their
 * GIR type references are unqualified relative to the interface's own
 * namespace. Stamping the interface namespace onto the instance parameter,
 * each regular parameter, and the return value lets the class writer resolve
 * and import those references as if the method had been authored on the class.
 *
 * @param fn - The callable whose references to qualify
 * @param defaultNamespace - The namespace the callable's references belong to
 */
export const qualifyFunction = (fn: GirFunction, defaultNamespace: string): GirFunction => ({
    ...fn,
    instance: fn.instance === undefined ? undefined : qualifyParameter(fn.instance, defaultNamespace),
    parameters: fn.parameters.map((parameter) => qualifyParameter(parameter, defaultNamespace)),
    returnValue: { ...fn.returnValue, type: qualifyTypeRef(fn.returnValue.type, defaultNamespace) },
});
