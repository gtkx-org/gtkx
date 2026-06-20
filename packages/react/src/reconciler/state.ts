/**
 * The reconciler node model.
 *
 * A real element's reconciler node IS its backing GObject; a metadata wrapper or
 * a text run is a {@link WrapperElement} brand token, and the render root is a
 * {@link RootElement} brand token. The three are told apart by brand — a real
 * element is `instanceof GObject.Object`, the others by {@link isWrapperElement}
 * and {@link isRootElement} — never by a stored type string. Per-node bookkeeping
 * lives in {@link State}, held in one module-level {@link WeakMap} keyed by the
 * node, never stamped onto the GObject. {@link stateOf} resolves a node to its
 * record; container nodes (the render-root token and foreign portal targets) are
 * seeded lazily by {@link ensureState} the first time they are touched.
 */
import * as GObject from "@gtkx/gi/gobject";
import { isRootElement, type RootElement } from "./root-element.js";
import { getSignalStore, type SignalStore } from "./signal-store.js";
import type { ContainerInfo, Props } from "./types.js";
import { isWrapperElement, type WrapperElement } from "./wrapper-element.js";

/**
 * A reconciler node: a real element's backing GObject, a {@link WrapperElement}
 * (wrapper/text run), or the {@link RootElement} root token. `createInstance`
 * only ever produces the first two; the root token enters as a container.
 */
export type Node = GObject.Object | WrapperElement | RootElement;

/** The per-node reconciler record, keyed by the node in the module's state map. */
export interface State {
    /** The JSX element name of a real element; `undefined` for wrappers, the root, and foreign portal targets. */
    readonly name?: string;
    /** The wrapper kind for a metadata wrapper or text run, else `undefined`. */
    readonly kind?: string;
    /** The node's current props, replaced on each commit. */
    props: Props;
    /** The reconciler parent, or `null` when unattached or the root. */
    parent: Node | null;
    /** The ordered child nodes. */
    readonly children: Node[];
    /** The reconciler root container (the per-root token or a portal target). */
    readonly rootContainer: ContainerInfo;
    /** The signal store keyed on the root container. */
    readonly signalStore: SignalStore;
}

const stateMap = new WeakMap<Node, State>();

/** The fields {@link registerState} needs to seed a node's {@link State}. */
export type StateSeed = {
    /** The JSX element name of a real element, else `undefined`. */
    readonly name?: string;
    /** The wrapper kind of a metadata wrapper or text run, else `undefined`. */
    readonly kind?: string;
    /** The node's initial props. */
    readonly props: Props;
    /** The reconciler root container. */
    readonly rootContainer: ContainerInfo;
};

/** Seeds and stores a fresh {@link State} for `node`, returning it. */
export const registerState = (node: Node, { name, kind, props, rootContainer }: StateSeed): State => {
    const state: State = {
        name,
        kind,
        props,
        parent: null,
        children: [],
        rootContainer,
        signalStore: getSignalStore(rootContainer),
    };
    stateMap.set(node, state);
    return state;
};

/**
 * Returns the {@link State} for a container, seeding it on first touch over the
 * foreign portal-target GObject or the per-render root token. Idempotent. A
 * container carries no JSX name; its identity is its brand.
 */
export const ensureState = (container: ContainerInfo): State =>
    stateMap.get(container) ?? registerState(container, { props: {}, rootContainer: container });

/** The {@link State} for `node`, seeding container State on first touch. */
export const stateOf = (node: Node): State => {
    const state = stateMap.get(node);
    if (state) return state;
    if (node instanceof GObject.Object || isRootElement(node)) return ensureState(node);
    throw new Error("reconciler node has no registered state");
};

/** Whether `node` is a metadata wrapper of the given `kind`. */
export const isWrapperKind = (node: Node, kind: string): boolean =>
    isWrapperElement(node) && stateOf(node).kind === kind;

/**
 * The nearest node, starting at `node` and walking parents, that satisfies
 * `matches` — or `null` when none does.
 */
export const closestInstance = (node: Node, matches: (node: Node) => boolean): Node | null => {
    let current: Node | null = node;
    while (current !== null && !matches(current)) {
        current = stateOf(current).parent;
    }
    return current;
};
