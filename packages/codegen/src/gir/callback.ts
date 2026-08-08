import type { GirFunction } from "./function.js";
import type { RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";
import { type GirCallable, parseCallable } from "./parameter.js";

/** The signature of a function pointer type GIR declares, whether named or anonymous. */
type GirCallback = GirCallable;

const callbackFromNode = (node: RawNode, context: ParseContext): GirCallback => parseCallable(node, context);

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
