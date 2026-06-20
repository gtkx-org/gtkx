import { type GirParameter, type GirReturnValue, parseCallable } from "./parameter.js";
import { attrBool, type RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

/** A `<callback>` declaration (top-level inside a namespace or nested in a field). */
export type GirCallback = {
    readonly name: string;
    readonly parameters: readonly GirParameter[];
    readonly returnValue: GirReturnValue;
    readonly introspectable: boolean;
};

/**
 * Builds a {@link GirCallback} from a `<callback>` element.
 *
 * @param node - The `<callback>` element
 * @param context - The per-namespace interning seam
 */
export const callbackFromNode = (node: RawNode, context: ParseContext): GirCallback => ({
    ...parseCallable(node, context),
    introspectable: attrBool(node, "introspectable", true),
});
