import * as GObject from "@gtkx/gi/gobject";
import { containerMapping } from "./container-attach.js";
import { type ElementMapping, type Node, stateOf } from "./state.js";
import { containerChildMapping, containerSlotMapping, lazyElementMapping, widgetPropMapping } from "./wrapper-apply.js";
import { isWrapperNode } from "./wrapper-node.js";

const ELEMENT_MAP: ElementMapping[] = [
    widgetPropMapping,
    containerSlotMapping,
    lazyElementMapping,
    containerChildMapping,
    containerMapping,
];

const resolveMapping = (child: Node, parent: Node): ElementMapping | undefined =>
    ELEMENT_MAP.find((mapping) => mapping.matches(child, parent));

const attachToParent = (child: Node, parent: Node, anchor?: GObject.Object | null, fresh?: boolean): void => {
    resolveMapping(child, parent)?.attach(child, parent, anchor, fresh);
};

export const detachFromParent = (child: Node, parent: Node): void => {
    resolveMapping(child, parent)?.detach(child, parent);
};

export const resyncWrapperNode = (node: Node): void => {
    const parent = stateOf(node).parent;
    if (isWrapperNode(node) && parent) attachToParent(node, parent);
};

const anchorWrapper = (before: Node): GObject.Object | null => {
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
        attachToParent(child, parent, anchorWrapper(before));
    }
    if (isWrapperNode(parent)) resyncWrapperNode(parent);
};

export const detachNode = (parent: Node, child: Node): void => {
    if (isWrapperNode(child) || !isWrapperNode(parent)) detachFromParent(child, parent);
    if (isWrapperNode(parent)) resyncWrapperNode(parent);
};
