import { getWrapperClass, typeFromName } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import type { Props } from "./types.js";

/**
 * Instantiates the backing GObject of a reconciler element, widget or not.
 *
 * Resolves the registered wrapper class for the GLib type and constructs it
 * with `props`, which the caller has already narrowed to the construct-time
 * GObject properties — children, signal handlers, accessible metadata, array
 * props, and descriptor-driven props removed. The generated constructor
 * marshals each into a `GValue` for `g_object_new_with_properties`.
 *
 * @param typeName - GLib type name (e.g. `"GtkLabel"`)
 * @param props - The construct-time GObject properties to set.
 */
export function createContainerWithProperties(typeName: string, props: Props): GObject.Object {
    const cls = getWrapperClass(typeFromName(typeName));
    if (!cls) {
        throw new Error(`createContainerWithProperties: no registered class for GLib type '${typeName}'`);
    }
    return new (cls as new (props: Record<string, unknown>) => GObject.Object)(props as Record<string, unknown>);
}
