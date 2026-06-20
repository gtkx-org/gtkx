import { type GirParameter, type GirReturnValue, parseCallable } from "./parameter.js";
import { attrBool, type RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

export type GirCallback = {
    name: string;
    parameters: GirParameter[];
    returnValue: GirReturnValue;
    introspectable: boolean;
};

export const callbackFromNode = (node: RawNode, context: ParseContext): GirCallback => ({
    ...parseCallable(node, context),
    introspectable: attrBool(node, "introspectable", true),
});
