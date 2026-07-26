import type { GirFunction } from "./function.js";
import type { ParseContext } from "./type-id.js";
import { type GirCallable, parseCallable } from "./parameter.js";
import { attrBool, type RawNode } from "./parse.js";

type GirCallback = GirCallable & {
    introspectable: boolean;
};

const callbackFromNode = (node: RawNode, context: ParseContext): GirCallback => ({
    ...parseCallable(node, context),
    introspectable: attrBool(node, "introspectable", true),
});

const callbackAsFunction = (callback: GirCallback): GirFunction => ({
    name: callback.name,
    doc: callback.doc,
    cIdentifier: undefined,
    throws: false,
    introspectable: callback.introspectable,
    shadowedBy: undefined,
    finishFunc: undefined,
    instance: undefined,
    parameters: callback.parameters,
    returnValue: callback.returnValue,
});

export { callbackFromNode, callbackAsFunction, type GirCallback };
