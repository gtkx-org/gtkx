import { getNativeClassByName } from "@gtkx/ffi";
import type { Node } from "./node.js";
import { ElementNode } from "./nodes/element.js";
import { WRAPPER_NODE_ELEMENT, WrapperNode } from "./nodes/wrapper.js";
import type { BackingInstance, BackingInstanceClass, ContainerInfo, Props } from "./types.js";

/**
 * Resolves the FFI widget class backing a JSX intrinsic element name.
 *
 * Returns `null` for the metadata-wrapper sentinel element, which has no
 * backing GLib type.
 *
 * @param type - JSX intrinsic element name, e.g. `"GtkButton"`
 */
export const resolveContainerClass = (type: string): BackingInstanceClass | null =>
    getNativeClassByName(type) as BackingInstanceClass | null;

/**
 * Resolves the backing GObject for an element: the pre-existing container in the
 * root-container case, otherwise a freshly constructed instance of the element's
 * FFI class.
 *
 * @param elementType - JSX intrinsic element name, e.g. `"GtkButton"`
 * @param props - React prop bag; construct-time properties are applied
 * @param existingContainer - Pre-existing container to wrap, or `undefined`
 * @param rootContainer - The reconciler root container
 * @throws When the element has no resolvable backing class
 */
const resolveBackingInstance = (
    elementType: string,
    props: Props,
    existingContainer: BackingInstance | undefined,
    rootContainer: ContainerInfo,
): BackingInstance => {
    if (existingContainer) return existingContainer;
    const containerClass = resolveContainerClass(elementType);
    if (!containerClass) {
        throw new Error(`Unable to resolve a backing class for element '${elementType}'`);
    }
    const container = ElementNode.createContainer(elementType, props, containerClass, rootContainer);
    if (!container) {
        throw new Error(`Unable to construct a backing instance for element '${elementType}'`);
    }
    return container;
};

/**
 * Builds the reconciler {@link Node} for a JSX intrinsic element.
 *
 * The metadata-wrapper sentinel element becomes a {@link WrapperNode} carrying
 * its kind; every other element backs a real GObject and becomes an
 * {@link ElementNode}.
 *
 * @param elementType - JSX intrinsic element name, e.g. `"GtkButton"`
 * @param props - React prop bag for the element
 * @param existingContainer - Pre-existing container to wrap (root container
 *   case); when supplied, no new container is constructed
 * @param rootContainer - The reconciler root container
 */
export const createNode = (
    elementType: string,
    props: Props,
    existingContainer: BackingInstance | undefined,
    rootContainer: ContainerInfo,
): Node => {
    if (elementType === WRAPPER_NODE_ELEMENT) {
        return new WrapperNode(props.kind as string, props, undefined, rootContainer);
    }
    const container = resolveBackingInstance(elementType, props, existingContainer, rootContainer);
    return new ElementNode(elementType, props, container, rootContainer);
};
