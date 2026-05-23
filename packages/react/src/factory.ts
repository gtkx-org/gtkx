import { getNativeClassByName } from "@gtkx/ffi";
import { type GType, typeFromName } from "@gtkx/ffi/gobject";
import { collectTypeNameChain } from "./metadata.js";
import type { Node } from "./node.js";
import { NODE_REGISTRY, type NodeClass } from "./registry.js";
import type { Container, ContainerClass, Props } from "./types.js";

/**
 * Resolves the FFI widget class backing a JSX intrinsic element name.
 *
 * Returns `null` for virtual reconciler elements such as `"Slot"` or
 * `"TextTag"` that have no backing GLib type.
 *
 * @param type - JSX intrinsic element name, e.g. `"GtkButton"`
 */
export const resolveContainerClass = (type: string): ContainerClass | null =>
    getNativeClassByName(type) as ContainerClass | null;

const resolveNodeClass = (elementType: string, gtype: GType): NodeClass | null => {
    if (gtype === 0) {
        return NODE_REGISTRY.get(elementType) ?? null;
    }
    for (const ancestorName of collectTypeNameChain(gtype)) {
        const nodeClass = NODE_REGISTRY.get(ancestorName);
        if (nodeClass) {
            return nodeClass;
        }
    }
    return null;
};

/**
 * Builds the reconciler {@link Node} for a JSX intrinsic element.
 *
 * The backing node class is resolved by walking the element's GLib type
 * ancestry against {@link NODE_REGISTRY}: the most-derived registered ancestor
 * wins, falling back to the `"GtkWidget"` catch-all. Virtual elements with no
 * GLib type are matched by their literal name.
 *
 * @param elementType - JSX intrinsic element name, e.g. `"GtkButton"`
 * @param props - React prop bag for the element
 * @param existingContainer - Pre-existing container to wrap (root container
 *   case); when supplied, no new container is constructed
 * @param rootContainer - The reconciler root container
 * @throws When no node class matches the element
 */
export const createNode = (
    elementType: string,
    props: Props,
    existingContainer: Container | undefined,
    rootContainer: Container,
): Node => {
    const gtype: GType = existingContainer ? existingContainer.__gtype__ : typeFromName(elementType);

    const NodeClass = resolveNodeClass(elementType, gtype);
    if (!NodeClass) {
        throw new Error(`Unable to find node class for type '${elementType}'`);
    }

    const containerClass = existingContainer ? null : resolveContainerClass(elementType);
    const container =
        existingContainer ??
        (containerClass && NodeClass.createContainer(elementType, props, containerClass, rootContainer));
    return new NodeClass(elementType, props, container, rootContainer);
};
