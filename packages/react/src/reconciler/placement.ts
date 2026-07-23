import * as Gtk from "@gtkx/gi/gtk";
import { placeChild, unplaceChild } from "./container.js";
import { ELEMENT_KIND, PROP_KIND, TEXT_KIND, WRAPPER_ELEMENT } from "./kinds.js";
import { typeInfoOf } from "./metadata.js";
import type { AnyNode, ContentChild, ElementNode, ParentNode, PlaceableNode, PropNode, WrapperNode } from "./node.js";
import { nodeWidget } from "./node.js";
import { acceptsText, addContent, markTextDirty, removeContent, textRestrictionError } from "./text.js";

const asPlaceable = (node: AnyNode | null): PlaceableNode | null =>
    node !== null && (node.kind === ELEMENT_KIND || node.kind === WRAPPER_ELEMENT) ? node : null;

const isContainerProp = (parent: ElementNode, prop: string): boolean =>
    typeInfoOf(parent.typeName).containerProps.has(prop);

const setObjectSlot = (parent: ElementNode, prop: string, node: PlaceableNode | undefined): void => {
    const widget = node === undefined ? null : nodeWidget(node);
    Reflect.set(parent.object, prop, widget);
    parent.objectSlots.add(prop);
    if (node?.kind === ELEMENT_KIND && node.contentKind === "buffer" && parent.object instanceof Gtk.TextView) {
        node.bufferView = parent.object;
        markTextDirty(node);
    }
};

const clearObjectSlot = (parent: ElementNode, prop: string): void => {
    Reflect.set(parent.object, prop, null);
    parent.objectSlots.delete(prop);
};

const attachPropToElement = (parent: ElementNode, node: PropNode, before: AnyNode | null): void => {
    node.parent = parent;
    if (isContainerProp(parent, node.propName)) {
        for (const child of node.children) placeChild(parent, node.propName, child, asPlaceable(before));
    } else {
        setObjectSlot(parent, node.propName, node.children[0]);
    }
};

const detachPropFromElement = (parent: ElementNode, node: PropNode): void => {
    if (isContainerProp(parent, node.propName)) {
        for (const child of node.children) unplaceChild(parent, node.propName, child);
    } else {
        clearObjectSlot(parent, node.propName);
    }
};

const attachToContentHost = (parent: ElementNode, child: AnyNode, before: AnyNode | null): void => {
    if (child.kind === TEXT_KIND && !acceptsText(parent)) throw textRestrictionError(child.text);
    if (child.kind === TEXT_KIND || child.kind === ELEMENT_KIND) {
        addContent(parent, child, before as ContentChild | null);
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
    if (child.kind === WRAPPER_ELEMENT) child.parent = parent;
    placeChild(parent, "children", child, asPlaceable(before));
};

const insertPlaceable = (list: PlaceableNode[], node: PlaceableNode, before: AnyNode | null): void => {
    const beforeNode = asPlaceable(before);
    const at = beforeNode === null ? -1 : list.indexOf(beforeNode);
    list.splice(at < 0 ? list.length : at, 0, node);
};

const insertChild = (parent: PropNode | WrapperNode, child: AnyNode, before: AnyNode | null): PlaceableNode | null => {
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
    if (isContainerProp(owner, parent.propName)) placeChild(owner, parent.propName, placeable, asPlaceable(before));
    else setObjectSlot(owner, parent.propName, parent.children[0]);
};

const syncWrapper = (wrapper: WrapperNode): void => {
    const owner = wrapper.parent;
    if (owner === null) return;
    const entry = owner.placements.get("children")?.find((placed) => placed.node === wrapper);
    const widget = nodeWidget(wrapper);
    if (entry === undefined) {
        if (widget !== null) placeChild(owner, "children", wrapper, null);
    } else if (entry.widget !== widget) {
        unplaceChild(owner, "children", wrapper);
        if (widget !== null) placeChild(owner, "children", wrapper, null);
    }
};

const attachToWrapper = (parent: WrapperNode, child: AnyNode, before: AnyNode | null): void => {
    if (insertChild(parent, child, before) === null) return;
    syncWrapper(parent);
};

export const attachChild = (parent: ParentNode, child: AnyNode, before: AnyNode | null): void => {
    if (parent.kind === ELEMENT_KIND) attachToElement(parent, child, before);
    else if (parent.kind === PROP_KIND) attachToProp(parent, child, before);
    else attachToWrapper(parent, child, before);
};

const detachFromProp = (parent: PropNode, child: AnyNode): void => {
    const placeable = asPlaceable(child);
    if (placeable === null) return;
    parent.children = parent.children.filter((entry) => entry !== placeable);
    const owner = parent.parent;
    if (owner === null) return;
    if (isContainerProp(owner, parent.propName)) unplaceChild(owner, parent.propName, placeable);
    else setObjectSlot(owner, parent.propName, parent.children[0]);
};

export const detachChild = (parent: ParentNode, child: AnyNode): void => {
    if (parent.kind === PROP_KIND) {
        detachFromProp(parent, child);
        return;
    }
    if (parent.kind === WRAPPER_ELEMENT) {
        parent.children = parent.children.filter((entry) => entry !== child);
        syncWrapper(parent);
        return;
    }
    if (child.kind === PROP_KIND) {
        detachPropFromElement(parent, child);
    } else if (parent.content !== null) {
        if (child.kind === TEXT_KIND || child.kind === ELEMENT_KIND) removeContent(parent, child);
    } else if (child.kind === ELEMENT_KIND || child.kind === WRAPPER_ELEMENT) {
        unplaceChild(parent, "children", child);
    }
};
