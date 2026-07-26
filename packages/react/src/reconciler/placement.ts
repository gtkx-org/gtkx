import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getOrInsert, indexBeforeOrEnd, remove } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo } from "./registry.js";
import { applyAdoptedProps, markFlush } from "./apply-props.js";
import { typeInfoOf } from "./metadata.js";
import {
    contextFor,
    DEFAULT_SLOT,
    ELEMENT_KIND,
    type ElementNode,
    LAZY_KIND,
    lazyTarget,
    nodeObject,
    type PlaceableNode,
    type PlacedChild,
} from "./node.js";
import { markTextDirty } from "./text.js";

const createEntry = (slot: string, node: PlaceableNode): PlacedChild | null => {
    const object = nodeObject(node);
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
    entry.adopted = behavior.resolve === undefined
        ? (claim instanceof GObject.Object ? claim : null)
        : behavior.resolve(parent.object, entry.object);
};

const applyLazyProps = (entry: PlacedChild): void => {
    if (entry.node.kind !== LAZY_KIND || entry.adopted === null) return;
    applyAdoptedProps(lazyTarget(entry.node, entry.adopted), {}, entry.node.props);
    entry.node.adopted = entry.adopted;
};

const wireBufferView = (node: PlaceableNode, parent: ElementNode): void => {
    if (!(node.kind === ELEMENT_KIND && node.contentKind === "buffer" && parent.object instanceof Gtk.TextView)) {
        return;
    }

    node.bufferView = parent.object;
    markTextDirty(node);
};

const setObjectSlot = (parent: ElementNode, entry: PlacedChild): void => {
    Reflect.set(parent.object, entry.slot, entry.object);
    wireBufferView(entry.node, parent);
    entry.behavior = null;
    entry.attached = true;
};

type AttachContext = { parent: ElementNode; entry: PlacedChild; index: number; sibling: GObject.Object | null };

const tryAttach = (ctx: AttachContext, behavior: ElementBehavior): boolean => {
    const attach = behavior.attach;
    if (attach === undefined) return false;
    const context = contextFor(ctx.parent, behavior);
    const claim = attach(ctx.parent.object, ctx.entry.object, placeInfo(ctx.entry, ctx.index, ctx.sibling, context));
    if (claim === undefined) return false;
    ctx.entry.behavior = behavior;
    adoptedFrom(ctx.parent, ctx.entry, behavior, claim);
    ctx.entry.attached = true;
    applyLazyProps(ctx.entry);
    return true;
};

const attachEntry = (parent: ElementNode, entry: PlacedChild, index: number, sibling: GObject.Object | null): void => {
    const ctx: AttachContext = { parent, entry, index, sibling };
    for (const behavior of typeInfoOf(parent.typeName).behaviors) {
        if (tryAttach(ctx, behavior)) return;
    }
    if (entry.slot !== DEFAULT_SLOT) setObjectSlot(parent, entry);
};

const detachInfo = (entry: PlacedChild, context: unknown): DetachInfo => ({
    slot: entry.slot,
    adopted: entry.adopted,
    props: entry.node.props,
    context,
});

const detachEntry = (parent: ElementNode, entry: PlacedChild): void => {
    if (!entry.attached) return;
    entry.attached = false;
    const behavior = entry.behavior;
    if (behavior === null) {
        if (entry.slot !== DEFAULT_SLOT) Reflect.set(parent.object, entry.slot, null);
        return;
    }
    behavior.detach?.(parent.object, entry.object, detachInfo(entry, contextFor(parent, behavior)));
};

const rebuild = (parent: ElementNode, entries: PlacedChild[]): void => {
    for (const entry of entries) detachEntry(parent, entry);
    for (const [index, entry] of entries.entries()) {
        entry.behavior = null;
        attachEntry(parent, entry, index, siblingAt(entries, index));
    }
};

const positionOf = (entries: PlacedChild[], before: PlaceableNode | null): number =>
    indexBeforeOrEnd(entries, before, (entry, target) => entry.node === target);

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
    const behavior = entry.behavior;
    const reorder = behavior?.reorder;
    if (behavior === null || reorder === undefined) {
        rebuild(parent, entries);
        return;
    }
    const context = contextFor(parent, behavior);
    const claim = reorder(parent.object, entry.object, placeInfo(entry, index, siblingAt(entries, index), context));
    adoptedFrom(parent, entry, behavior, claim);
    applyLazyProps(entry);
};

const resolveEntry = (
    entries: PlacedChild[],
    existing: number,
    slot: string,
    node: PlaceableNode,
): PlacedChild | null => {
    if (existing >= 0) return entries[existing] ?? null;
    return createEntry(slot, node);
};

export const placeChild = (
    parent: ElementNode,
    slot: string,
    node: PlaceableNode,
    before: PlaceableNode | null,
): void => {
    const entries = getOrInsert(parent.placements, slot, () => []);
    const existing = entries.findIndex((entry) => entry.node === node);
    const entry = resolveEntry(entries, existing, slot, node);
    if (entry === null) return;
    const isMove = existing !== -1;
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
    if (index === -1) return;
    const [entry] = entries.splice(index, 1);
    if (entry !== undefined) detachEntry(parent, entry);
    markFlush(parent);
};
