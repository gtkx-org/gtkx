import type { ParseContext } from "./type-id.js";
import { PARAMETERS_MISSING_NULLABLE_ANNOTATION } from "./nullable-overrides.js";
import { type GirParameter, type GirReturnValue, parameterFromNode, parseCallable } from "./parameter.js";
import { attr, getChild, type RawNode } from "./parse.js";

type GirFunction = {
    name: string;
    doc: string | undefined;
    cIdentifier: string | undefined;
    throws: boolean;
    introspectable: boolean;
    movedTo: string | undefined;
    shadowedBy: string | undefined;
    finishFunc: string | undefined;
    instance: GirParameter | undefined;
    parameters: GirParameter[];
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

const functionFromNode = (node: RawNode, context: ParseContext): GirFunction => {
    const instanceNode = getChild(getChild(node, "parameters"), "instance-parameter");

    return relaxMissingNullable({
        ...parseCallable(node, context),
        name: attr(node, "shadows") ?? attr(node, "name") ?? "",
        cIdentifier: attr(node, "c:identifier"),
        movedTo: attr(node, "moved-to"),
        shadowedBy: attr(node, "shadowed-by"),
        finishFunc: attr(node, "glib:finish-func"),
        instance: instanceNode === undefined ? undefined : parameterFromNode(instanceNode, context),
    });
};

export { functionFromNode, type GirFunction };
