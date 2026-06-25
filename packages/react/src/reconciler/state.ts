import * as GObject from "@gtkx/gi/gobject";
import { isRelationshipNode, type RelationshipNode } from "./relationship-node.js";
import { isRootElement, type RootElement } from "./root-element.js";
import { getSignalStore, type SignalStore } from "./signal-store.js";
import type { Container, Props } from "./types.js";

export type Node = GObject.Object | RelationshipNode | RootElement;

export interface State {
    name?: string | undefined;
    kind?: string | undefined;
    props: Props;
    parent: Node | null;
    children: Node[];
    rootContainer: Container;
    signalStore: SignalStore;
}

const stateMap = new WeakMap<Node, State>();

export type StateSeed = {
    name?: string;
    kind?: string;
    props: Props;
    rootContainer: Container;
};

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

export const ensureState = (container: Container): State =>
    stateMap.get(container) ?? registerState(container, { props: {}, rootContainer: container });

export const stateOf = (node: Node): State => {
    const state = stateMap.get(node);
    if (state) return state;
    if (node instanceof GObject.Object || isRootElement(node)) return ensureState(node);
    throw new Error("reconciler node has no registered state");
};

export const isRelationshipKind = (node: Node, kind: string): boolean =>
    isRelationshipNode(node) && stateOf(node).kind === kind;

export const closestInstance = (node: Node, matches: (node: Node) => boolean): Node | null => {
    let current: Node | null = node;
    while (current !== null && !matches(current)) {
        current = stateOf(current).parent;
    }
    return current;
};
