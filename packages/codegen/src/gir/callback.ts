import { type GirParameter, type GirReturnValue, parseCallable } from "./parameter.js";
import { attr, type RawNode } from "./parse.js";

/** A `<callback>` declaration (top-level inside a namespace or nested in a field). */
export type GirCallback = {
    readonly name: string;
    readonly parameters: readonly GirParameter[];
    readonly returnValue: GirReturnValue;
    readonly introspectable: boolean;
};

/**
 * Builds a {@link GirCallback} from a `<callback>` element.
 */
export const callbackFromNode = (node: RawNode): GirCallback => ({
    ...parseCallable(node),
    introspectable: attr(node, "introspectable") !== "0",
});
