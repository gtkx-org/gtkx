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

/**
 * Attaches a freshly linked child to its parent, deciding between
 * wrapper-resync and backing-widget attachment and resyncing the parent wrapper
 * when the parent is itself a marker node.
 *
 * The child must already be linked into the parent's child list. Pass `before`
 * as `null` to append, or as the sibling the child was linked ahead of to
 * insert; `fresh` indicates the child had no previous parent.
 */
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

/**
 * Detaches an unlinked child from its parent, mirroring {@link attachNode}: it
 * runs the backing detachment when applicable and resyncs the parent wrapper
 * when the parent is itself a marker node.
 *
 * The child must already be unlinked from the parent's child list before this
 * call so the parent-wrapper resync observes the post-removal tree.
 */
export const detachNode = (parent: Node, child: Node): void => {
    if (isWrapperElement(child) || !isWrapperElement(parent)) detachFromParent(child, parent);
    if (isWrapperElement(parent)) resyncWrapper(parent);
};
