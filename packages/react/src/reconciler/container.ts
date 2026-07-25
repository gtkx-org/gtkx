import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { applyAdoptedProps, markFlush } from "./apply-props.js";
import { contextFor } from "./behavior-context.js";
import type { ElementBehavior, PlaceInfo } from "./behaviors.js";
import { ELEMENT_KIND, LAZY_ELEMENT } from "./kinds.js";
import { typeInfoOf } from "./metadata.js";
import { type ElementNode, nodeWidget, type PlaceableNode, type PlacedChild, type SignalTarget } from "./node.js";
import { markTextDirty } from "./text.js";

const isObject = (value: unknown): value is GObject.Object => typeof value === "object" && value !== null;

const createEntry = (slot: string, node: PlaceableNode): PlacedChild | null => {
    const widget = nodeWidget(node);
    if (widget === null) return null;
    return { node, widget, adopted: null, slot, behavior: null, attached: false };
};

const siblingAt = (list: PlacedChild[], index: number): GObject.Object | null =>
    index > 0 ? (list[index - 1]?.widget ?? null) : null;

const placeInfo = (entry: PlacedChild, index: number, sibling: GObject.Object | null, context: unknown): PlaceInfo => ({
    slot: entry.slot,
    index,
    sibling,
    adopted: entry.adopted,
    props: entry.node.props,
    context,
});

const adoptedFrom = (parent: ElementNode, entry: PlacedChild, behavior: ElementBehavior, claim: unknown): void => {
    if (behavior.resolve !== undefined) entry.adopted = behavior.resolve(parent.object, entry.widget);
    else entry.adopted = isObject(claim) ? claim : null;
};

const applyLazyProps = (entry: PlacedChild): void => {
    if (entry.node.kind !== LAZY_ELEMENT || entry.adopted === null) return;
    const target: SignalTarget = {
        object: entry.adopted,
        handlers: entry.node.handlers,
        typeName: entry.node.typeName,
    };
    applyAdoptedProps(target, {}, entry.node.props);
    entry.node.adopted = entry.adopted;
};

const setObjectSlot = (parent: ElementNode, entry: PlacedChild): void => {
    Reflect.set(parent.object, entry.slot, entry.widget);
    const node = entry.node;
    if (node.kind === ELEMENT_KIND && node.contentKind === "buffer" && parent.object instanceof Gtk.TextView) {
        node.bufferView = parent.object;
        markTextDirty(node);
    }
    entry.behavior = null;
    entry.attached = true;
};

const attachEntry = (parent: ElementNode, entry: PlacedChild, index: number, sibling: GObject.Object | null): void => {
    for (const behavior of typeInfoOf(parent.typeName).behaviors) {
        const attach = behavior.attach;
        if (attach === undefined) continue;
        const context = contextFor(parent, behavior);
        const claim = attach(parent.object, entry.widget, placeInfo(entry, index, sibling, context));
        if (claim === undefined) continue;
        entry.behavior = behavior;
        adoptedFrom(parent, entry, behavior, claim);
        entry.attached = true;
        applyLazyProps(entry);
        return;
    }
    if (entry.slot !== "children") setObjectSlot(parent, entry);
};

const detachEntry = (parent: ElementNode, entry: PlacedChild): void => {
    if (!entry.attached) return;
    entry.attached = false;
    const behavior = entry.behavior;
    if (behavior === null) {
        if (entry.slot !== "children") Reflect.set(parent.object, entry.slot, null);
        return;
    }
    const context = contextFor(parent, behavior);
    behavior.detach?.(parent.object, entry.widget, {
        slot: entry.slot,
        adopted: entry.adopted,
        props: entry.node.props,
        context,
    });
};

const rebuild = (parent: ElementNode, list: PlacedChild[]): void => {
    for (const entry of list) detachEntry(parent, entry);
    list.forEach((entry, index) => {
        entry.behavior = null;
        attachEntry(parent, entry, index, siblingAt(list, index));
    });
};

const reorderEntry = (parent: ElementNode, entry: PlacedChild, index: number, sibling: GObject.Object | null): void => {
    const behavior = entry.behavior;
    const reorder = behavior?.reorder;
    if (reorder === undefined || behavior === null) return;
    const context = contextFor(parent, behavior);
    const result = reorder(parent.object, entry.widget, placeInfo(entry, index, sibling, context));
    adoptedFrom(parent, entry, behavior, result);
    applyLazyProps(entry);
};

const positionOf = (list: PlacedChild[], before: PlaceableNode | null): number => {
    if (before === null) return list.length;
    const index = list.findIndex((entry) => entry.node === before);
    return index < 0 ? list.length : index;
};

const placeNew = (parent: ElementNode, entry: PlacedChild, list: PlacedChild[], index: number): void => {
    attachEntry(parent, entry, index, siblingAt(list, index));
    if (!entry.attached) {
        const at = list.indexOf(entry);
        if (at >= 0) list.splice(at, 1);
    } else if (index < list.length - 1 && entry.behavior !== null && entry.behavior.reorder === undefined) {
        rebuild(parent, list);
    }
};

const moveEntry = (parent: ElementNode, entry: PlacedChild, list: PlacedChild[], index: number): void => {
    if (entry.behavior?.reorder !== undefined) reorderEntry(parent, entry, index, siblingAt(list, index));
    else rebuild(parent, list);
};

export const placeChild = (
    parent: ElementNode,
    slot: string,
    node: PlaceableNode,
    before: PlaceableNode | null,
): void => {
    const list = parent.placements.get(slot) ?? [];
    parent.placements.set(slot, list);
    const existing = list.findIndex((entry) => entry.node === node);
    const entry = existing >= 0 ? list[existing] : createEntry(slot, node);
    if (entry === undefined || entry === null) return;
    const isMove = existing >= 0;
    if (isMove) list.splice(existing, 1);
    const index = positionOf(list, before);
    list.splice(index, 0, entry);
    if (isMove) moveEntry(parent, entry, list, index);
    else placeNew(parent, entry, list, index);
    markFlush(parent);
};

export const unplaceChild = (parent: ElementNode, slot: string, node: PlaceableNode): void => {
    const list = parent.placements.get(slot);
    if (list === undefined) return;
    const index = list.findIndex((entry) => entry.node === node);
    if (index < 0) return;
    const [entry] = list.splice(index, 1);
    if (entry !== undefined) detachEntry(parent, entry);
    markFlush(parent);
};
