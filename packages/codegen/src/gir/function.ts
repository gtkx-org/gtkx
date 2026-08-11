import type { GirAnnotations } from "./annotations.js";
import type { ParseContext } from "./type-id.js";
import { type CursorParameterNames, PARAMETERS_MISSING_ARRAY_EXTENT } from "./cursor-overrides.js";
import { PARAMETERS_MISSING_NULLABLE_ANNOTATION } from "./nullable-overrides.js";
import { type GirParameter, type GirReturnValue, parameterFromNode, parseCallable } from "./parameter.js";
import { attr, getChild, type RawNode } from "./parse.js";

/** A callable declared by a GIR namespace, class, or record: a function, a method, or a constructor. */
type GirFunction = {
    /** Local name within its owner, taken from the `shadows` annotation when the callable has one. */
    name: string;
    /** Documentation text carried by the GIR node. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the callable. */
    annotations: GirAnnotations;
    /** C symbol the callable is invoked through. */
    cIdentifier: string | undefined;
    /** Whether the C function takes a trailing `GError` out parameter and can fail. */
    throws: boolean;
    /** Whether the GIR marks the callable as introspectable, and so bindable. */
    introspectable: boolean;
    /** Qualified `Type.member` the GIR redirects the callable to, from its `moved-to` annotation. */
    movedTo: string | undefined;
    /** Name of the callable that shadows this one, from the GIR's `shadowed-by` annotation. */
    shadowedBy: string | undefined;
    /** Name of the callable that completes this asynchronous one, from the GIR's `glib:finish-func`. */
    finishFunc: string | undefined;
    /** The instance the callable is invoked on, absent for constructors and namespace-level functions. */
    instance: GirParameter | undefined;
    /** Parameters other than the instance one, in declaration order. */
    parameters: GirParameter[];
    /** What the callable returns, with its transfer and nullability. */
    returnValue: GirReturnValue;
};

const relaxParameters = (parameters: GirParameter[], names: string[]): void => {
    for (const parameter of parameters) {
        if (names.includes(parameter.name)) {
            parameter.nullable = true;
        }
    }
};

const relaxMissingNullable = (fn: GirFunction): GirFunction => {
    const names = fn.cIdentifier === undefined ? undefined : PARAMETERS_MISSING_NULLABLE_ANNOTATION.get(fn.cIdentifier);

    if (names !== undefined) {
        relaxParameters(fn.parameters, names);
    }

    return fn;
};

const parameterIndexFor = (parameters: GirParameter[], name: string): number => {
    const index = parameters.findIndex((parameter) => parameter.name === name);

    if (index === -1) {
        throw new Error(`A cursor correction names a parameter the GIR does not declare: ${name}`);
    }

    return index;
};

const bindCursorParameters = (parameters: GirParameter[], corrections: CursorParameterNames[]): void => {
    for (const names of corrections) {
        const parameter = parameters[parameterIndexFor(parameters, names.cursor)];

        if (parameter !== undefined) {
            parameter.cursor = {
                baseIndex: parameterIndexFor(parameters, names.base),
                lengthIndex: parameterIndexFor(parameters, names.length),
            };
        }
    }
};

const bindMissingArrayExtent = (fn: GirFunction): GirFunction => {
    const corrections = fn.cIdentifier === undefined ? undefined : PARAMETERS_MISSING_ARRAY_EXTENT.get(fn.cIdentifier);

    if (corrections !== undefined) {
        bindCursorParameters(fn.parameters, corrections);
    }

    return fn;
};

const functionFromNode = (node: RawNode, context: ParseContext): GirFunction => {
    const instanceNode = getChild(getChild(node, "parameters"), "instance-parameter");

    return bindMissingArrayExtent(
        relaxMissingNullable({
            ...parseCallable(node, context),
            name: attr(node, "shadows") ?? attr(node, "name") ?? "",
            cIdentifier: attr(node, "c:identifier"),
            movedTo: attr(node, "moved-to"),
            shadowedBy: attr(node, "shadowed-by"),
            finishFunc: attr(node, "glib:finish-func"),
            instance: instanceNode === undefined ? undefined : parameterFromNode(instanceNode, context),
        }),
    );
};

export { functionFromNode, type GirFunction };
