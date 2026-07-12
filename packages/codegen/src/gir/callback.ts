import type { GirFunction } from "./function.js";
import { type GirParameter, type GirReturnValue, parseCallable } from "./parameter.js";
import { attrBool, type RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

export type GirCallback = {
    name: string;
    doc: string | undefined;
    parameters: GirParameter[];
    returnValue: GirReturnValue;
    introspectable: boolean;
};

export const callbackFromNode = (node: RawNode, context: ParseContext): GirCallback => ({
    ...parseCallable(node, context),
    introspectable: attrBool(node, "introspectable", true),
});

export const callbackAsFunction = (callback: GirCallback): GirFunction => ({
    name: callback.name,
    doc: callback.doc,
    cIdentifier: undefined,
    throws: false,
    introspectable: callback.introspectable,
    shadowedBy: undefined,
    instance: undefined,
    parameters: callback.parameters,
    returnValue: callback.returnValue,
});
