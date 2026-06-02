import { getNativeClassByName } from "@gtkx/ffi";
import type { BackingInstance, Props } from "../../types.js";

/**
 * Instantiates a container widget from the React reconciler.
 *
 * Resolves the registered wrapper class for the GLib type and constructs it
 * with the camelCase JSX prop bag. The generated constructor translates each
 * known property into a `GValue` and ignores everything else (signal
 * handlers, children, refs), so the bag can be passed through verbatim.
 *
 * @param typeName - GLib type name (e.g. `"GtkLabel"`)
 * @param props - React prop bag; only construct-time properties are picked
 *   up, all others are ignored at construction
 */
export function createContainerWithProperties(typeName: string, props: Props): BackingInstance {
    const cls = getNativeClassByName(typeName);
    if (!cls) {
        throw new Error(`createContainerWithProperties: no registered class for GLib type '${typeName}'`);
    }
    return new (cls as new (props: Record<string, unknown>) => BackingInstance)(props as Record<string, unknown>);
}
