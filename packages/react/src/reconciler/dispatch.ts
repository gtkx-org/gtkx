import * as GObject from "@gtkx/gi/gobject";
import { isRelationshipNode } from "./relationship-node.js";
import { type Node, stateOf } from "./state.js";

export type ElementMapping = {
    matches(child: Node, parent: Node): boolean;
    attach(child: Node, parent: Node, anchor?: GObject.Object | null, fresh?: boolean): void;
    detach(child: Node, parent: Node): void;
};

let elementMap: ElementMapping[] = [];

export const setElementMap = (mappings: ElementMapping[]): void => {
    elementMap = mappings;
};

const resolveMapping = (child: Node, parent: Node): ElementMapping | undefined =>
    elementMap.find((mapping) => mapping.matches(child, parent));

export const attachToParent = (child: Node, parent: Node, anchor?: GObject.Object | null, fresh?: boolean): void => {
    resolveMapping(child, parent)?.attach(child, parent, anchor, fresh);
};

export const detachFromParent = (child: Node, parent: Node): void => {
    resolveMapping(child, parent)?.detach(child, parent);
};

export const resyncRelationshipNode = (node: Node): void => {
    const parent = stateOf(node).parent;
    if (isRelationshipNode(node) && parent) attachToParent(node, parent);
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
        if (isRelationshipNode(child) || !isRelationshipNode(parent)) attachToParent(child, parent, null, fresh);
    } else if (isRelationshipNode(child)) {
        attachToParent(child, parent);
    } else if (!isRelationshipNode(parent)) {
        attachToParent(child, parent, anchorWrapper(before));
    }
    if (isRelationshipNode(parent)) resyncRelationshipNode(parent);
};

export const detachNode = (parent: Node, child: Node): void => {
    if (isRelationshipNode(child) || !isRelationshipNode(parent)) detachFromParent(child, parent);
    if (isRelationshipNode(parent)) resyncRelationshipNode(parent);
};
