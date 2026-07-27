import { indexBeforeOrEnd, remove } from "@gtkx/utils";
import type { AnyNode, ContentChild, ElementNode, LazyNode, ParentNode, PlaceableNode, PropNode } from "./node.js";
import { DEFAULT_SLOT, ELEMENT_KIND, LAZY_KIND, nodeObject, PROP_KIND, TEXT_KIND } from "./node.js";
import { placeChild, unplaceChild } from "./placement.js";
import { addContent, canAcceptText, removeContent, textRestrictionError } from "./text.js";

const asPlaceable = (node: AnyNode | null): PlaceableNode | null =>
    node !== null && (node.kind === ELEMENT_KIND || node.kind === LAZY_KIND) ? node : null;

const attachPropToElement = (parent: ElementNode, node: PropNode, before: AnyNode | null): void => {
    node.parent = parent;

    for (const child of node.children) {
        placeChild(parent, node.slot, child, asPlaceable(before));
    }
};

const detachPropFromElement = (parent: ElementNode, node: PropNode): void => {
    for (const child of node.children) {
        unplaceChild(parent, node.slot, child);
    }
};

const asContentChild = (node: AnyNode | null): ContentChild | null =>
    node !== null && (node.kind === TEXT_KIND || node.kind === ELEMENT_KIND) ? node : null;

const attachToContentHost = (parent: ElementNode, child: AnyNode, before: AnyNode | null): void => {
    if (child.kind === TEXT_KIND && !canAcceptText(parent)) {
        throw textRestrictionError(child.text);
    }

    if (child.kind === TEXT_KIND || child.kind === ELEMENT_KIND) {
        addContent(parent, child, asContentChild(before));
    }
};

const attachToElement = (parent: ElementNode, child: AnyNode, before: AnyNode | null): void => {
    if (child.kind === PROP_KIND) {
        attachPropToElement(parent, child, before);

        return;
    }

    if (parent.contentKind !== null) {
        attachToContentHost(parent, child, before);

        return;
    }

    if (child.kind === TEXT_KIND) {
        throw textRestrictionError(child.text);
    }

    if (child.kind === LAZY_KIND) {
        child.parent = parent;
    }

    placeChild(parent, DEFAULT_SLOT, child, asPlaceable(before));
};

const insertPlaceable = (list: PlaceableNode[], node: PlaceableNode, before: AnyNode | null): void => {
    const beforeNode = asPlaceable(before);

    list.splice(
        indexBeforeOrEnd(list, beforeNode, (item, target) => item === target),
        0,
        node,
    );
};

const insertChild = (parent: PropNode | LazyNode, child: AnyNode, before: AnyNode | null): PlaceableNode | null => {
    const placeable = asPlaceable(child);

    if (placeable === null) {
        return null;
    }

    insertPlaceable(parent.children, placeable, before);

    return placeable;
};

const attachToProp = (parent: PropNode, child: AnyNode, before: AnyNode | null): void => {
    const placeable = insertChild(parent, child, before);

    if (placeable === null) {
        return;
    }

    const owner = parent.parent;

    if (owner === null) {
        return;
    }

    placeChild(owner, parent.slot, placeable, asPlaceable(before));
};

const placeLazy = (owner: ElementNode, node: LazyNode, hasObject: boolean): void => {
    if (hasObject) {
        placeChild(owner, DEFAULT_SLOT, node, null);
    }
};

const syncLazy = (node: LazyNode): void => {
    const owner = node.parent;

    if (owner === null) {
        return;
    }

    const entry = owner.placements.get(DEFAULT_SLOT)?.find((entry) => entry.node === node);
    const object = nodeObject(node);

    if (entry === undefined) {
        placeLazy(owner, node, object !== null);
    } else if (entry.object !== object) {
        unplaceChild(owner, DEFAULT_SLOT, node);
        placeLazy(owner, node, object !== null);
    }
};

const attachToLazy = (parent: LazyNode, child: AnyNode, before: AnyNode | null): void => {
    if (insertChild(parent, child, before) === null) {
        return;
    }

    syncLazy(parent);
};

const attachChild = (parent: ParentNode, child: AnyNode, before: AnyNode | null): void => {
    if (parent.kind === ELEMENT_KIND) {
        attachToElement(parent, child, before);
    } else if (parent.kind === PROP_KIND) {
        attachToProp(parent, child, before);
    } else {
        attachToLazy(parent, child, before);
    }
};

const removeContentChild = (parent: ElementNode, child: AnyNode): void => {
    if (child.kind === TEXT_KIND || child.kind === ELEMENT_KIND) {
        removeContent(parent, child);
    }
};

const unplaceChildNode = (parent: ElementNode, child: AnyNode): void => {
    const placeable = asPlaceable(child);

    if (placeable !== null) {
        unplaceChild(parent, DEFAULT_SLOT, placeable);
    }
};

const detachFromElement = (parent: ElementNode, child: AnyNode): void => {
    if (child.kind === PROP_KIND) {
        detachPropFromElement(parent, child);
    } else if (parent.contentKind === null) {
        unplaceChildNode(parent, child);
    } else {
        removeContentChild(parent, child);
    }
};

const detachFromProp = (parent: PropNode, child: AnyNode): void => {
    const placeable = asPlaceable(child);

    if (placeable === null) {
        return;
    }

    remove(parent.children, placeable);
    const owner = parent.parent;

    if (owner === null) {
        return;
    }

    unplaceChild(owner, parent.slot, placeable);
};

const detachFromLazy = (parent: LazyNode, child: AnyNode): void => {
    const placeable = asPlaceable(child);

    if (placeable !== null) {
        remove(parent.children, placeable);
    }

    syncLazy(parent);
};

const detachChild = (parent: ParentNode, child: AnyNode): void => {
    if (parent.kind === ELEMENT_KIND) {
        detachFromElement(parent, child);
    } else if (parent.kind === PROP_KIND) {
        detachFromProp(parent, child);
    } else {
        detachFromLazy(parent, child);
    }
};

export { attachChild, detachChild };
