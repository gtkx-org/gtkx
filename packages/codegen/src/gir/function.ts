import { type GirParameter, type GirReturnValue, parameterFromNode, parseCallable } from "./parameter.js";
import { attr, attrBool, childOf, type RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

export type FunctionKind = "function" | "method" | "constructor";

export type GirFunction = {
    kind: FunctionKind;
    name: string;
    cIdentifier: string | undefined;
    throws: boolean;
    introspectable: boolean;
    shadowedBy: string | undefined;
    instance: GirParameter | undefined;
    parameters: GirParameter[];
    returnValue: GirReturnValue;
};

export const functionFromNode = (node: RawNode, kind: FunctionKind, context: ParseContext): GirFunction => {
    const instanceNode = childOf(childOf(node, "parameters"), "instance-parameter");
    return {
        ...parseCallable(node, context),
        kind,
        name: attr(node, "shadows") ?? attr(node, "name") ?? "",
        cIdentifier: attr(node, "c:identifier"),
        throws: attrBool(node, "throws"),
        introspectable: attrBool(node, "introspectable", true),
        shadowedBy: attr(node, "shadowed-by"),
        instance: instanceNode === undefined ? undefined : parameterFromNode(instanceNode, context),
    };
};
