import * as GObject from "@gtkx/gi/gobject";
import { isRootElement, type RootElement } from "./root-element.js";
import { ensureSignalStore, type SignalStore } from "./signal-store.js";
import type { Container, Props } from "./types.js";
import type { WrapperKind } from "./wrapper-kinds.js";
import { isWrapperNode, type WrapperNode } from "./wrapper-node.js";

export type Node = GObject.Object | WrapperNode | RootElement;

export type ElementHandler = {
    attach(anchor?: GObject.Object | null, fresh?: boolean): void;
    detach(): void;
};

export type ElementMapping = (child: Node, parent: Node) => ElementHandler | null;

export type State = {
    kind?: WrapperKind | undefined;
    props: Props;
    parent: Node | null;
    children: Node[];
    rootContainer: Container;
    signalStore: SignalStore;
    adoptedInstance?: GObject.Object | undefined;
    hidden?: boolean | undefined;
    visibleWhenShown?: boolean | undefined;
};

const stateMap = new WeakMap<Node, State>();

type StateSeed = {
    kind?: WrapperKind;
    props: Props;
    rootContainer: Container;
};

export const registerState = (node: Node, { kind, props, rootContainer }: StateSeed): State => {
    const state: State = {
        kind,
        props,
        parent: null,
        children: [],
        rootContainer,
        signalStore: ensureSignalStore(rootContainer),
    };
    stateMap.set(node, state);
    return state;
};

export const ensureState = (container: Container): State =>
    stateMap.get(container) ?? registerState(container, { props: {}, rootContainer: container });

export const registeredStateOf = (node: Node): State | undefined => stateMap.get(node);

export const stateOf = (node: Node): State => {
    const state = stateMap.get(node);
    if (state) return state;
    if (node instanceof GObject.Object || isRootElement(node)) return ensureState(node);
    throw new Error("reconciler node has no registered state");
};

export const hasWrapperKind = (node: Node, kind: WrapperKind): boolean =>
    isWrapperNode(node) && stateOf(node).kind === kind;

export const findClosest = <T extends Node>(node: Node, matches: (node: Node) => node is T): T | null => {
    let current: Node | null = node;
    while (current !== null) {
        if (matches(current)) return current;
        current = stateOf(current).parent;
    }
    return null;
};
