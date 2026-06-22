import * as GObject from "@gtkx/gi/gobject";
import type { ElementMapping } from "../element-mapping.js";
import { type Node, stateOf } from "../state.js";
import { isWrapperElement } from "../wrapper-element.js";

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

export const resyncWrapper = (marker: Node): void => {
    const parent = stateOf(marker).parent;
    if (isWrapperElement(marker) && parent) attachToParent(marker, parent);
};

const anchorBacking = (before: Node): GObject.Object | null => {
    if (before instanceof GObject.Object) return before;
    for (const grandchild of stateOf(before).children) {
        if (grandchild instanceof GObject.Object) return grandchild;
    }
    return null;
};

export const attachNode = (parent: Node, child: Node, before: Node | null, fresh: boolean): void => {
    if (before === null) {
        if (isWrapperElement(child) || !isWrapperElement(parent)) attachToParent(child, parent, null, fresh);
    } else if (isWrapperElement(child)) {
        attachToParent(child, parent);
    } else if (!isWrapperElement(parent)) {
        attachToParent(child, parent, anchorBacking(before));
    }
    if (isWrapperElement(parent)) resyncWrapper(parent);
};

export const detachNode = (parent: Node, child: Node): void => {
    if (isWrapperElement(child) || !isWrapperElement(parent)) detachFromParent(child, parent);
    if (isWrapperElement(parent)) resyncWrapper(parent);
};
