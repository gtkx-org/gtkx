import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getOrInsert, remove } from "@gtkx/utils";
import { applyAdoptedProps, markFlush } from "./apply-props.js";
import { typeInfoOf } from "./metadata.js";
import {
    contextFor,
    DEFAULT_SLOT,
    ELEMENT_KIND,
    type ElementNode,
    LAZY_KIND,
    lazyTarget,
    nodeWidget,
    type PlaceableNode,
    type PlacedChild,
} from "./node.js";
import type { ElementBehavior, PlaceInfo } from "./registry.js";
import { markTextDirty } from "./text.js";

const createEntry = (slot: string, node: PlaceableNode): PlacedChild | null => {
    const object = nodeWidget(node);
    if (object === null) return null;
    return { node, object, adopted: null, slot, behavior: null, attached: false };
};

const siblingAt = (entries: PlacedChild[], index: number): GObject.Object | null =>
    index > 0 ? (entries[index - 1]?.object ?? null) : null;

const placeInfo = (entry: PlacedChild, index: number, sibling: GObject.Object | null, context: unknown): PlaceInfo => ({
    slot: entry.slot,
    index,
    sibling,
    adopted: entry.adopted,
    props: entry.node.props,
    context,
});

const adoptedFrom = (parent: ElementNode, entry: PlacedChild, behavior: ElementBehavior, claim: unknown): void => {
    if (behavior.resolve !== undefined) entry.adopted = behavior.resolve(parent.object, entry.object);
    else entry.adopted = claim instanceof GObject.Object ? claim : null;
};

const applyLazyProps = (entry: PlacedChild): void => {
    if (entry.node.kind !== LAZY_KIND || entry.adopted === null) return;
    applyAdoptedProps(lazyTarget(entry.node, entry.adopted), {}, entry.node.props);
    entry.node.adopted = entry.adopted;
};

const setObjectSlot = (parent: ElementNode, entry: PlacedChild): void => {
    Reflect.set(parent.object, entry.slot, entry.object);
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
        const claim = attach(parent.object, entry.object, placeInfo(entry, index, sibling, context));
        if (claim === undefined) continue;
        entry.behavior = behavior;
        adoptedFrom(parent, entry, behavior, claim);
        entry.attached = true;
        applyLazyProps(entry);
        return;
    }
    if (entry.slot !== DEFAULT_SLOT) setObjectSlot(parent, entry);
};

const detachEntry = (parent: ElementNode, entry: PlacedChild): void => {
    if (!entry.attached) return;
    entry.attached = false;
    const behavior = entry.behavior;
    if (behavior === null) {
        if (entry.slot !== DEFAULT_SLOT) Reflect.set(parent.object, entry.slot, null);
        return;
    }
    const context = contextFor(parent, behavior);
    behavior.detach?.(parent.object, entry.object, {
        slot: entry.slot,
        adopted: entry.adopted,
        props: entry.node.props,
        context,
    });
};

const rebuild = (parent: ElementNode, entries: PlacedChild[]): void => {
    for (const entry of entries) detachEntry(parent, entry);
    entries.forEach((entry, index) => {
        entry.behavior = null;
        attachEntry(parent, entry, index, siblingAt(entries, index));
    });
};

const reorderEntry = (parent: ElementNode, entry: PlacedChild, index: number, sibling: GObject.Object | null): void => {
    const behavior = entry.behavior;
    const reorder = behavior?.reorder;
    if (reorder === undefined || behavior === null) return;
    const context = contextFor(parent, behavior);
    const claim = reorder(parent.object, entry.object, placeInfo(entry, index, sibling, context));
    adoptedFrom(parent, entry, behavior, claim);
    applyLazyProps(entry);
};

const positionOf = (entries: PlacedChild[], before: PlaceableNode | null): number => {
    if (before === null) return entries.length;
    const index = entries.findIndex((entry) => entry.node === before);
    return index < 0 ? entries.length : index;
};

const placeNew = (parent: ElementNode, entry: PlacedChild, entries: PlacedChild[], index: number): void => {
    attachEntry(parent, entry, index, siblingAt(entries, index));
    if (!entry.attached) {
        remove(entries, entry);
        return;
    }
    const insertedBeforeEnd = index < entries.length - 1;
    const cannotReorderInPlace = entry.behavior !== null && entry.behavior.reorder === undefined;
    if (insertedBeforeEnd && cannotReorderInPlace) rebuild(parent, entries);
};

const moveEntry = (parent: ElementNode, entry: PlacedChild, entries: PlacedChild[], index: number): void => {
    if (entry.behavior?.reorder !== undefined) reorderEntry(parent, entry, index, siblingAt(entries, index));
    else rebuild(parent, entries);
};

export const placeChild = (
    parent: ElementNode,
    slot: string,
    node: PlaceableNode,
    before: PlaceableNode | null,
): void => {
    const entries = getOrInsert(parent.placements, slot, () => []);
    const existing = entries.findIndex((entry) => entry.node === node);
    const entry = existing >= 0 ? entries[existing] : createEntry(slot, node);
    if (entry === undefined || entry === null) return;
    const isMove = existing >= 0;
    if (isMove) entries.splice(existing, 1);
    const index = positionOf(entries, before);
    entries.splice(index, 0, entry);
    if (isMove) moveEntry(parent, entry, entries, index);
    else placeNew(parent, entry, entries, index);
    markFlush(parent);
};

export const unplaceChild = (parent: ElementNode, slot: string, node: PlaceableNode): void => {
    const entries = parent.placements.get(slot);
    if (entries === undefined) return;
    const index = entries.findIndex((entry) => entry.node === node);
    if (index < 0) return;
    const [entry] = entries.splice(index, 1);
    if (entry !== undefined) detachEntry(parent, entry);
    markFlush(parent);
};
