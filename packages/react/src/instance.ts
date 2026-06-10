/**
 * The single reconciler instance record and its construction helpers.
 *
 * The renderer has no node class hierarchy: every JSX element — a real GObject,
 * a metadata wrapper, or the inert render root — is the same plain {@link Instance}
 * record. All attach/detach behavior lives in {@link "./element-map".ELEMENT_MAP},
 * all array-prop behavior in {@link "./array-props".ARRAY_PROPS}, and all generic
 * prop diffing in `apply-props`; the reconciler ({@link "./host-config"}) only
 * manages the children array and routes commits to those tables.
 */
import { getNativeClassByName } from "@gtkx/ffi";
import { omit } from "@gtkx/utils";
import { createContainerWithProperties } from "./nodes/internal/construct.js";
import { getSignalStore, type SignalStore } from "./nodes/internal/signal-store.js";
import type { BackingInstance, BackingInstanceClass, ContainerInfo, Props } from "./types.js";

/**
 * The single JSX element name every metadata wrapper renders. A wrapper carries
 * its concrete kind (`"slot"`, `"meta-object"`, …) through the `kind` prop, which
 * the host config forwards to {@link Instance.kind}.
 */
export const WRAPPER_NODE_ELEMENT = "__GTKX_WRAPPER_NODE__";

/** The synthetic element type of the inert top-level render root. */
export const ROOT_TYPE = "__GTKX_ROOT__";

/**
 * Props withheld from a widget's constructor because their JSX form is not the
 * GObject property's value type (a prop descriptor sets the real value after
 * construction). Keyed by GLib type name.
 */
export const CONSTRUCTION_SKIP_PROPS: Readonly<Record<string, readonly string[]>> = {};

/**
 * One reconciler instance. A real element has a `backingInstance` and no `kind`;
 * a metadata wrapper has a `kind` and no `backingInstance`; the render root has
 * neither.
 */
export interface Instance {
    /** JSX element name, the wrapper sentinel, or the root sentinel. */
    readonly type: string;
    /** The wrapper kind for a metadata wrapper, else `undefined`. */
    readonly kind: string | undefined;
    /** The backing GObject, or `undefined` for wrappers and the root. */
    readonly backingInstance: BackingInstance | undefined;
    /** The element's current props, replaced on each commit. */
    props: Props;
    /** The reconciler parent, or `null` when unattached or the root. */
    parent: Instance | null;
    /** The ordered child instances. */
    readonly children: Instance[];
    /** The reconciler root container (the per-root sentinel or a portal target). */
    readonly rootContainer: ContainerInfo;
    /** The signal store keyed on the root container. */
    readonly signalStore: SignalStore;
    /** Opaque per-instance attachment bookkeeping owned by the matched mapping. */
    attachState: unknown;
}

/**
 * Resolves the FFI backing class for a JSX intrinsic element name, or `null`
 * when none is registered (the wrapper sentinel and root have no backing class).
 *
 * @param type - JSX intrinsic element name, e.g. `"GtkButton"`.
 */
export const resolveContainerClass = (type: string): BackingInstanceClass | null =>
    getNativeClassByName(type) as BackingInstanceClass | null;

const constructBacking = (type: string, props: Props): BackingInstance => {
    const skip = CONSTRUCTION_SKIP_PROPS[type];
    return createContainerWithProperties(type, skip ? omit(props, skip) : props);
};

type InstanceSeed = {
    type: string;
    kind: string | undefined;
    backingInstance: BackingInstance | undefined;
    props: Props;
    rootContainer: ContainerInfo;
};

const baseInstance = ({ type, kind, backingInstance, props, rootContainer }: InstanceSeed): Instance => ({
    type,
    kind,
    backingInstance,
    props,
    parent: null,
    children: [],
    rootContainer,
    signalStore: getSignalStore(rootContainer),
    attachState: undefined,
});

/**
 * Builds an instance for a real GObject element: an existing GObject when one is
 * supplied (the portal/root-container case), otherwise a freshly constructed
 * instance of the element's FFI class.
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
    existing?: BackingInstance,
): Instance =>
    baseInstance({
        type,
        kind: undefined,
        backingInstance: existing ?? constructBacking(type, props),
        props,
        rootContainer,
    });

/**
 * Builds a metadata-wrapper instance carrying its kind and props but no backing
 * GObject.
 *
 * @param kind - The wrapper kind (`"slot"`, `"meta-object"`, …).
 * @param props - The wrapper props carrying attachment metadata.
 * @param rootContainer - The reconciler root container.
 */
export const createWrapperInstance = (kind: string, props: Props, rootContainer: ContainerInfo): Instance =>
    baseInstance({ type: WRAPPER_NODE_ELEMENT, kind, backingInstance: undefined, props, rootContainer });

/**
 * Builds the inert instance backing a top-level render root.
 *
 * @param sentinel - The per-root container sentinel.
 */
export const createRootInstance = (sentinel: ContainerInfo): Instance =>
    baseInstance({ type: ROOT_TYPE, kind: undefined, backingInstance: undefined, props: {}, rootContainer: sentinel });

/** Whether `instance` is a metadata wrapper (vs. a real GObject or the root). */
export const isWrapperInstance = (instance: Instance): boolean => instance.type === WRAPPER_NODE_ELEMENT;

/**
 * Returns the nearest instance, starting at `node` itself and walking the
 * parent chain, that satisfies `matches` — or `null` when none does.
 *
 * @param node - The instance to start the walk from.
 * @param matches - The predicate an ancestor must satisfy.
 */
export const closestInstance = (node: Instance, matches: (instance: Instance) => boolean): Instance | null => {
    let current: Instance | null = node;
    while (current !== null && !matches(current)) current = current.parent;
    return current;
};

/** Whether `instance` is a metadata wrapper of the given `kind`. */
export const isWrapperKind = (instance: Instance, kind: string): boolean =>
    instance.type === WRAPPER_NODE_ELEMENT && instance.kind === kind;
