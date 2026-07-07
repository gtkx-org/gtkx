import { type GirParameter, type GirReturnValue, parameterFromNode, parseCallable } from "./parameter.js";
import { attr, attrBool, childOf, type RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

export type GirFunction = {
    name: string;
    cIdentifier: string | undefined;
    throws: boolean;
    introspectable: boolean;
    shadowedBy: string | undefined;
    instance: GirParameter | undefined;
    parameters: GirParameter[];
    returnValue: GirReturnValue;
};

export const functionFromNode = (node: RawNode, context: ParseContext): GirFunction => {
    const instanceNode = childOf(childOf(node, "parameters"), "instance-parameter");
    return {
        ...parseCallable(node, context),
        name: attr(node, "shadows") ?? attr(node, "name") ?? "",
        cIdentifier: attr(node, "c:identifier"),
        throws: attrBool(node, "throws"),
        introspectable: attrBool(node, "introspectable", true),
        shadowedBy: attr(node, "shadowed-by"),
        instance: instanceNode === undefined ? undefined : parameterFromNode(instanceNode, context),
    };
};
