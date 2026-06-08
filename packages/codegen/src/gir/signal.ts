import { type GirParameter, type GirReturnValue, parseCallable } from "./parameter.js";
import type { RawNode } from "./parse.js";

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
export const signalFromNode = (node: RawNode): GirSignal => parseCallable(node);
