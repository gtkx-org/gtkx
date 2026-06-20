import { type GirParameter, type GirReturnValue, parseCallable } from "./parameter.js";
import type { RawNode } from "./parse.js";
import type { ParseContext } from "./type-id.js";

/** A GObject `<glib:signal>` declaration. */
export type GirSignal = {
    /** GIR signal name, kebab-case (e.g. `"activate-link"`). */
    readonly name: string;
    readonly parameters: readonly GirParameter[];
    readonly returnValue: GirReturnValue;
};

/**
 * Builds a {@link GirSignal} from a `<glib:signal>` element.
 *
 * @param node - The `<glib:signal>` element
 * @param context - The per-namespace interning seam
 */
export const signalFromNode = (node: RawNode, context: ParseContext): GirSignal => parseCallable(node, context);
