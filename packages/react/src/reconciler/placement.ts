import { placeChild, unplaceChild } from "./container.js";
import { ELEMENT_KIND, LAZY_ELEMENT, PROP_KIND, TEXT_KIND } from "./kinds.js";
import type { AnyNode, ContentChild, ElementNode, LazyNode, ParentNode, PlaceableNode, PropNode } from "./node.js";
import { nodeWidget } from "./node.js";
import { acceptsText, addContent, removeContent, textRestrictionError } from "./text.js";

const asPlaceable = (node: AnyNode | null): PlaceableNode | null =>
    node !== null && (node.kind === ELEMENT_KIND || node.kind === LAZY_ELEMENT) ? node : null;

const attachPropToElement = (parent: ElementNode, node: PropNode, before: AnyNode | null): void => {
    node.parent = parent;
    for (const child of node.children) placeChild(parent, node.propName, child, asPlaceable(before));
};

const detachPropFromElement = (parent: ElementNode, node: PropNode): void => {
    for (const child of node.children) unplaceChild(parent, node.propName, child);
};

const asContentChild = (node: AnyNode | null): ContentChild | null =>
    node !== null && (node.kind === TEXT_KIND || node.kind === ELEMENT_KIND) ? node : null;

const attachToContentHost = (parent: ElementNode, child: AnyNode, before: AnyNode | null): void => {
    if (child.kind === TEXT_KIND && !acceptsText(parent)) throw textRestrictionError(child.text);
    if (child.kind === TEXT_KIND || child.kind === ELEMENT_KIND) {
        addContent(parent, child, asContentChild(before));
    }
};

const attachToElement = (parent: ElementNode, child: AnyNode, before: AnyNode | null): void => {
    if (child.kind === PROP_KIND) {
        attachPropToElement(parent, child, before);
        return;
    }
    if (parent.content !== null) {
        attachToContentHost(parent, child, before);
        return;
    }
    if (child.kind === TEXT_KIND) throw textRestrictionError(child.text);
    if (child.kind === LAZY_ELEMENT) child.parent = parent;
    placeChild(parent, "children", child, asPlaceable(before));
};

const insertPlaceable = (list: PlaceableNode[], node: PlaceableNode, before: AnyNode | null): void => {
    const beforeNode = asPlaceable(before);
    const at = beforeNode === null ? -1 : list.indexOf(beforeNode);
    list.splice(at < 0 ? list.length : at, 0, node);
};

const insertChild = (parent: PropNode | LazyNode, child: AnyNode, before: AnyNode | null): PlaceableNode | null => {
    const placeable = asPlaceable(child);
    if (placeable === null) return null;
    insertPlaceable(parent.children, placeable, before);
    return placeable;
};

const attachToProp = (parent: PropNode, child: AnyNode, before: AnyNode | null): void => {
    const placeable = insertChild(parent, child, before);
    if (placeable === null) return;
    const owner = parent.parent;
    if (owner === null) return;
    placeChild(owner, parent.propName, placeable, asPlaceable(before));
};

const syncLazy = (node: LazyNode): void => {
    const owner = node.parent;
    if (owner === null) return;
    const entry = owner.placements.get("children")?.find((placed) => placed.node === node);
    const widget = nodeWidget(node);
    if (entry === undefined) {
        if (widget !== null) placeChild(owner, "children", node, null);
    } else if (entry.widget !== widget) {
        unplaceChild(owner, "children", node);
        if (widget !== null) placeChild(owner, "children", node, null);
    }
};

const attachToLazy = (parent: LazyNode, child: AnyNode, before: AnyNode | null): void => {
    if (insertChild(parent, child, before) === null) return;
    syncLazy(parent);
};

export const attachChild = (parent: ParentNode, child: AnyNode, before: AnyNode | null): void => {
    if (parent.kind === ELEMENT_KIND) attachToElement(parent, child, before);
    else if (parent.kind === PROP_KIND) attachToProp(parent, child, before);
    else attachToLazy(parent, child, before);
};

const detachFromProp = (parent: PropNode, child: AnyNode): void => {
    const placeable = asPlaceable(child);
    if (placeable === null) return;
    parent.children = parent.children.filter((entry) => entry !== placeable);
    const owner = parent.parent;
    if (owner === null) return;
    unplaceChild(owner, parent.propName, placeable);
};

export const detachChild = (parent: ParentNode, child: AnyNode): void => {
    if (parent.kind === PROP_KIND) {
        detachFromProp(parent, child);
        return;
    }
    if (parent.kind === LAZY_ELEMENT) {
        parent.children = parent.children.filter((entry) => entry !== child);
        syncLazy(parent);
        return;
    }
    if (child.kind === PROP_KIND) {
        detachPropFromElement(parent, child);
    } else if (parent.content !== null) {
        if (child.kind === TEXT_KIND || child.kind === ELEMENT_KIND) removeContent(parent, child);
    } else if (child.kind === ELEMENT_KIND || child.kind === LAZY_ELEMENT) {
        unplaceChild(parent, "children", child);
    }
};
