import { type GirParameter, type GirReturnValue, parseCallable } from "./parameter.js";
import type { RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

export type GirSignal = {
    name: string;
    parameters: GirParameter[];
    returnValue: GirReturnValue;
};

export const signalFromNode = (node: RawNode, context: ParseContext): GirSignal => parseCallable(node, context);
