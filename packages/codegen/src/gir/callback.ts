import type { GirFunction } from "./function.js";
import type { ParseContext } from "./type-id.js";
import { relaxMissingNullable } from "./nullable-overrides.js";
import { type GirCallable, parseCallable } from "./parameter.js";
import { attr, type RawNode } from "./parse.js";

type GirCallback = GirCallable;

const callbackFromNode = (node: RawNode, context: ParseContext): GirCallback => {
    const callback = parseCallable(node, context);
    relaxMissingNullable(callback, attr(node, "c:type"));

    return callback;
};

const callbackAsFunction = (callback: GirCallback): GirFunction => ({
    name: callback.name,
    doc: callback.doc,
    annotations: callback.annotations,
    cIdentifier: undefined,
    movedTo: undefined,
    throws: callback.throws,
    introspectable: callback.introspectable,
    shadowedBy: undefined,
    finishFunc: undefined,
    instance: undefined,
    parameters: callback.parameters,
    returnValue: callback.returnValue,
});

export { callbackFromNode, callbackAsFunction, type GirCallback };
