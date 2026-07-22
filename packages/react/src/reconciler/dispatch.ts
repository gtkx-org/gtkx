import * as GObject from "@gtkx/gi/gobject";
import { containerMapping } from "./container-attach.js";
import { lazyElementMapping } from "./lazy-element.js";
import { type ElementHandler, type ElementMapping, type Node, stateOf } from "./state.js";
import { containerChildMapping, containerPropMapping, objectPropMapping } from "./wrapper-attach.js";
import { isWrapperNode } from "./wrapper-node.js";

const ELEMENT_MAP: ElementMapping[] = [
    objectPropMapping,
    containerPropMapping,
    lazyElementMapping,
    containerChildMapping,
    containerMapping,
];

const resolveHandler = (child: Node, parent: Node): ElementHandler | null => {
    for (const mapping of ELEMENT_MAP) {
        const handler = mapping(child, parent);
        if (handler !== null) return handler;
    }
    return null;
};

const attachToParent = (child: Node, parent: Node, anchor?: GObject.Object | null, fresh?: boolean): void => {
    resolveHandler(child, parent)?.attach(anchor, fresh);
};

export const detachFromParent = (child: Node, parent: Node): void => {
    resolveHandler(child, parent)?.detach();
};

export const resyncWrapperNode = (node: Node): void => {
    const parent = stateOf(node).parent;
    if (isWrapperNode(node) && parent) attachToParent(node, parent);
};

const resolveAnchor = (before: Node): GObject.Object | null => {
    if (before instanceof GObject.Object) return before;
    for (const grandchild of stateOf(before).children) {
        if (grandchild instanceof GObject.Object) return grandchild;
    }
    return null;
};

export const attachNode = (parent: Node, child: Node, before: Node | null, fresh: boolean): void => {
    if (before === null) {
        if (isWrapperNode(child) || !isWrapperNode(parent)) attachToParent(child, parent, null, fresh);
    } else if (isWrapperNode(child)) {
        attachToParent(child, parent);
    } else if (!isWrapperNode(parent)) {
        attachToParent(child, parent, resolveAnchor(before));
    }
    if (isWrapperNode(parent)) resyncWrapperNode(parent);
};

export const detachNode = (parent: Node, child: Node): void => {
    if (isWrapperNode(child) || !isWrapperNode(parent)) detachFromParent(child, parent);
    if (isWrapperNode(parent)) resyncWrapperNode(parent);
};
