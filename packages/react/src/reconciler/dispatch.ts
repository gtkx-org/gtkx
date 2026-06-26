import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { attachOrderedInsert, detachOrderedInsert, resolveOrderedInsert } from "./ordered-insert.js";
import { isRelationshipNode } from "./relationship-node.js";
import { resolveAppendRuleSet, ruleNodeOf } from "./rule-registry.js";
import { type Node, stateOf } from "./state.js";

export interface ElementMapping {
    matches(child: Node, parent: Node): boolean;
    attach(child: Node, parent: Node, anchor?: GObject.Object | null, fresh?: boolean): void;
    detach(child: Node, parent: Node): void;
}

let elementMap: ElementMapping[] = [];

export const setElementMap = (mappings: ElementMapping[]): void => {
    elementMap = mappings;
};

const isSelfAttachingChild = (child: Node, parent: Node): boolean =>
    child instanceof GObject.Object &&
    !(child instanceof Gtk.Widget) &&
    parent instanceof GObject.Object &&
    resolveAppendRuleSet(child.__gtype__) !== null;

export const orderedInsertMapping: ElementMapping = {
    matches: (child, parent) =>
        child instanceof GObject.Object && parent instanceof GObject.Object && resolveOrderedInsert(parent) !== null,
    attach: (child, parent, anchor) => {
        const spec = resolveOrderedInsert(parent);
        if (spec) attachOrderedInsert(spec, child, parent, anchor);
    },
    detach: (child, parent) => {
        const spec = resolveOrderedInsert(parent);
        if (spec) detachOrderedInsert(spec, child, parent);
    },
};

export const childRuleSetMapping: ElementMapping = {
    matches: isSelfAttachingChild,
    attach: (child, parent) => {
        const parentNode = ruleNodeOf(parent);
        const childNode = ruleNodeOf(child);
        if (!parentNode || !childNode || !(child instanceof GObject.Object)) return;
        resolveAppendRuleSet(child.__gtype__)?.appendChild?.(parentNode, childNode);
    },
    detach: (child, parent) => {
        const parentNode = ruleNodeOf(parent);
        const childNode = ruleNodeOf(child);
        if (!parentNode || !childNode || !(child instanceof GObject.Object)) return;
        resolveAppendRuleSet(child.__gtype__)?.removeChild?.(parentNode, childNode);
    },
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
