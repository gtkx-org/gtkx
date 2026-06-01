import { type GirParameter, type GirReturnValue, parameterFromNode, returnValueFromNode } from "./parameter.js";
import { attr, attrBool, childOf, childrenOf, type RawNode } from "./parse.js";

/** Emission stage (`<glib:signal when="…">`). */
type SignalWhen = "first" | "last" | "cleanup";

/** A GObject `<glib:signal>` declaration. */
export type GirSignal = {
    /** GIR signal name, kebab-case (e.g. `"activate-link"`). */
    readonly name: string;
    readonly parameters: readonly GirParameter[];
    readonly returnValue: GirReturnValue;
    readonly when: SignalWhen;
    readonly detailed: boolean;
    readonly action: boolean;
    readonly noRecurse: boolean;
    readonly noHooks: boolean;
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
        when: (attr(node, "when") ?? "last") as SignalWhen,
        detailed: attrBool(node, "detailed"),
        action: attrBool(node, "action"),
        noRecurse: attrBool(node, "no-recurse"),
        noHooks: attrBool(node, "no-hooks"),
    };
};
