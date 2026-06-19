/**
 * Construction helpers for reconciler element nodes.
 *
 * A real element's reconciler node is its freshly constructed (or portal-supplied)
 * backing GObject; a metadata wrapper or text run is a {@link createWrapperElement}
 * token. Each created node is seeded into the reconciler state map by
 * {@link registerState}. Attach/detach behavior lives in
 * {@link "./element-map".ELEMENT_MAP}, array-prop behavior in
 * {@link "./array-props".ARRAY_PROPS}, and generic prop diffing in `apply-props`.
 */
import { WRAPPER_NODE_ELEMENT } from "@gtkx/config";
import { getWrapperClass, typeFromName } from "@gtkx/ffi";
import type * as GObject from "@gtkx/gi/gobject";
import { omit } from "@gtkx/utils";
import { collectConstructableProps } from "../utils/gtype.js";
import { createContainerWithProperties } from "./construct.js";
import { type Node, registerState } from "./state.js";
import type { ContainerInfo, Props } from "./types.js";
import { createWrapperElement } from "./wrapper-element.js";

export { WRAPPER_NODE_ELEMENT };

/**
 * Props withheld from a widget's constructor and applied by a prop descriptor
 * after construction instead — either because their JSX form is not the
 * GObject property's value type, or because the property is only valid once
 * children are attached (`visibleChildName` names a page the stack does not
 * hold yet at construction). Keyed by GLib type name.
 */
export const CONSTRUCTION_SKIP_PROPS: Readonly<Record<string, readonly string[]>> = {
    GtkStack: ["visibleChildName"],
    AdwViewStack: ["visibleChildName"],
    AdwToggleGroup: ["activeName", "active"],
};

/**
 * Resolves the FFI backing class for a JSX intrinsic element name, or `null`
 * when none is registered (the wrapper sentinel and root have no backing class).
 *
 * @param type - JSX intrinsic element name, e.g. `"GtkButton"`.
 */
export const resolveContainerClass = (type: string): typeof GObject.Object | null =>
    getWrapperClass(typeFromName(type)) as typeof GObject.Object | null;

/**
 * Narrows a JSX prop bag to the construct-time GObject properties
 * `g_object_new_with_properties` accepts: it keeps only the props codegen marks
 * constructable for the type, dropping everything the reconciler applies through
 * another path — children, the element's `ref`/`key`, signal handlers,
 * accessible metadata, array props, and framework-only props such as a slot's
 * `prefix`. What remains is exactly the set the generated constructor marshals,
 * so construction never receives a non-property.
 *
 * @param gtype - The GLib type being constructed.
 * @param props - The JSX prop bag, after construction-skip removal.
 */
const pickConstructProps = (gtype: GObject.GType, props: Props): Props => {
    const constructable = collectConstructableProps(gtype);
    const result: Props = {};
    for (const name in props) {
        if (constructable.has(name)) result[name] = props[name];
    }
    return result;
};

const constructBacking = (type: string, props: Props): GObject.Object => {
    const gtype = typeFromName(type);
    const skip = CONSTRUCTION_SKIP_PROPS[type];
    return createContainerWithProperties(type, pickConstructProps(gtype, skip ? omit(props, skip) : props));
};

/**
 * Builds the node for a real GObject element — an existing GObject when one is
 * supplied (the portal case), otherwise a freshly constructed instance of the
 * element's FFI class — and seeds its reconciler state.
 *
 * @param type - JSX intrinsic element name, e.g. `"GtkButton"`.
 * @param props - React prop bag; construct-time properties are applied.
 * @param rootContainer - The reconciler root container.
 * @param existing - A pre-existing GObject to wrap, or `undefined`.
 */
export const createElementInstance = (
    type: string,
    props: Props,
    rootContainer: ContainerInfo,
    existing?: GObject.Object,
): Node => {
    const node = existing ?? constructBacking(type, props);
    registerState(node, { name: type, props, rootContainer });
    return node;
};

/**
 * Builds a metadata-wrapper node carrying its kind and props but no backing
 * GObject, and seeds its reconciler state.
 *
 * @param kind - The wrapper kind (`"slot"`, `"meta-object"`, …).
 * @param props - The wrapper props carrying attachment metadata.
 * @param rootContainer - The reconciler root container.
 */
export const createWrapperInstance = (kind: string, props: Props, rootContainer: ContainerInfo): Node => {
    const node = createWrapperElement();
    registerState(node, { kind, props, rootContainer });
    return node;
};
