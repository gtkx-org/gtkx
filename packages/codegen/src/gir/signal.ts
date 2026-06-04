import { type GirParameter, type GirReturnValue, parameterFromNode, returnValueFromNode } from "./parameter.js";
import { attr, childOf, childrenOf, type RawNode } from "./parse.js";

/** A GObject `<glib:signal>` declaration. */
export type GirSignal = {
    /** GIR signal name, kebab-case (e.g. `"activate-link"`). */
    readonly name: string;
    readonly parameters: readonly GirParameter[];
    readonly returnValue: GirReturnValue;
};

/**
 * Builds a {@link GirSignal} from a `<glib:signal>` element.
 */
export const signalFromNode = (node: RawNode): GirSignal => {
    const parametersNode = childOf(node, "parameters");
    const parameterNodes = childrenOf(parametersNode, "parameter");
    return {
        name: attr(node, "name") ?? "",
        parameters: parameterNodes.map((parameter) => parameterFromNode(parameter, false)),
        returnValue: returnValueFromNode(childOf(node, "return-value")),
    };
};
