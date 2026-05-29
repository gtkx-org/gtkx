import { type GirParameter, type GirReturnValue, parameterFromNode, returnValueFromNode } from "./parameter.js";
import { attr, childOf, childrenOf, type RawNode } from "./parse.js";

/** A `<callback>` declaration (top-level inside a namespace or nested in a field). */
export type GirCallback = {
    readonly name: string;
    readonly cType: string | undefined;
    readonly parameters: readonly GirParameter[];
    readonly returnValue: GirReturnValue;
    readonly introspectable: boolean;
};

/**
 * Builds a {@link GirCallback} from a `<callback>` element.
 */
export const callbackFromNode = (node: RawNode): GirCallback => {
    const parametersNode = childOf(node, "parameters");
    const parameterNodes = childrenOf(parametersNode, "parameter");
    return {
        name: attr(node, "name") ?? "",
        cType: attr(node, "c:type"),
        parameters: parameterNodes.map((parameter) => parameterFromNode(parameter, false)),
        returnValue: returnValueFromNode(childOf(node, "return-value")),
        introspectable: attr(node, "introspectable") !== "0",
    };
};
