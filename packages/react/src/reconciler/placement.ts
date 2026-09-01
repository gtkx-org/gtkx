import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { indexBeforeOrEnd } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo } from "./registry.js";
import { applyAdoptedProps, markFlush } from "./apply-props.js";
import { typeInfoFor } from "./metadata.js";
import {
    DEFAULT_SLOT,
    ELEMENT_KIND,
    type ElementNode,
    getOrCreateContext,
    LAZY_KIND,
    lazyTarget,
    leafElement,
    type PlaceableNode,
    type PlacedChild,
} from "./node.js";
import { applyMutation, applyWrite } from "./signals.js";
import { markTextDirty } from "./text.js";

type AttachContext = { parent: ElementNode; entry: PlacedChild; index: number; sibling: GObject.Object | null };

const createEntry = (slot: string, node: PlaceableNode): PlacedChild | null => {
    const leaf = leafElement(node);

    if (leaf === null) {
        return null;
    }

    return {
        node,
        object: leaf.object,
        typeName: leaf.typeName,
        adopted: null,
        slot,
        behavior: null,
    };
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
    if (behavior.resolve !== undefined) {
        entry.adopted = behavior.resolve(parent.object, entry.object);

        return;
    }

    entry.adopted = claim instanceof GObject.Object ? claim : null;
};

const applyLazyProps = (entry: PlacedChild): void => {
    if (entry.node.kind !== LAZY_KIND || entry.adopted === null) {
        return;
    }

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

const writeSlot = (parent: ElementNode, entry: PlacedChild, value: GObject.Object | null): void => {
    applyWrite(entry.slot, () => {
        Reflect.set(parent.object, entry.slot, value);
    });
};

const setObjectSlot = (parent: ElementNode, entry: PlacedChild): void => {
    writeSlot(parent, entry, entry.object);
    wireBufferView(entry.node, parent);
    entry.behavior = null;
};

const didAttach = (ctx: AttachContext, behavior: ElementBehavior): boolean => {
    const attach = behavior.attach;

    if (attach === undefined) {
        return false;
    }

    const context = getOrCreateContext(ctx.parent, behavior);
    const claim = attach(ctx.parent.object, ctx.entry.object, placeInfo(ctx.entry, ctx.index, ctx.sibling, context));

    if (claim === undefined) {
        return false;
    }

    ctx.entry.behavior = behavior;
    adoptedFrom(ctx.parent, ctx.entry, behavior, claim);
    applyLazyProps(ctx.entry);

    return true;
};

const unclaimedChildError = (parentTypeName: string, childTypeName: string): Error =>
    new Error(
        `<${childTypeName}> cannot be a child of <${parentTypeName}>. Pass it to the ` +
        `<${parentTypeName}> prop that takes it, if there is one, portal it to rootElement with createPortal ` +
        `if it does not belong inside <${parentTypeName}>, or register an attach behavior for ` +
        `<${parentTypeName}> with defineElements from "@gtkx/react/config" if it belongs among its children.`,
    );

const runAttach = (parent: ElementNode, entry: PlacedChild, index: number, sibling: GObject.Object | null): void => {
    const ctx: AttachContext = { parent, entry, index, sibling };

    for (const behavior of typeInfoFor(parent.typeName).behaviors) {
        if (didAttach(ctx, behavior)) {
            return;
        }
    }

    if (entry.slot === DEFAULT_SLOT) {
        throw unclaimedChildError(parent.typeName, entry.typeName);
    }

    setObjectSlot(parent, entry);
};

const attachEntry = (parent: ElementNode, entry: PlacedChild, index: number, sibling: GObject.Object | null): void => {
    applyMutation(() => {
        runAttach(parent, entry, index, sibling);
    });
};

const detachInfo = (entry: PlacedChild, context: unknown): DetachInfo => ({
    slot: entry.slot,
    adopted: entry.adopted,
    props: entry.node.props,
    context,
});

const runDetach = (parent: ElementNode, entry: PlacedChild): void => {
    const behavior = entry.behavior;

    if (behavior === null) {
        writeSlot(parent, entry, null);

        return;
    }

    behavior.detach?.(parent.object, entry.object, detachInfo(entry, getOrCreateContext(parent, behavior)));
};

const detachEntry = (parent: ElementNode, entry: PlacedChild): void => {
    applyMutation(() => {
        runDetach(parent, entry);
    });
};

const rebuild = (parent: ElementNode, entries: PlacedChild[]): void => {
    for (const entry of entries) {
        detachEntry(parent, entry);
    }

    for (const [index, entry] of entries.entries()) {
        entry.behavior = null;
        attachEntry(parent, entry, index, siblingAt(entries, index));
    }
};

const getPosition = (entries: PlacedChild[], before: PlaceableNode | null): number =>
    indexBeforeOrEnd(entries, before, (entry, target) => entry.node === target);

const placeNew = (parent: ElementNode, entry: PlacedChild, entries: PlacedChild[], index: number): void => {
    attachEntry(parent, entry, index, siblingAt(entries, index));
    const isInsertedBeforeEnd = index < entries.length - 1;
    const isCannotReorderInPlace = entry.behavior !== null && entry.behavior.reorder === undefined;

    if (isInsertedBeforeEnd && isCannotReorderInPlace) {
        rebuild(parent, entries);
    }
};

const moveEntry = (parent: ElementNode, entry: PlacedChild, entries: PlacedChild[], index: number): void => {
    const behavior = entry.behavior;
    const reorder = behavior?.reorder;

    if (behavior === null || reorder === undefined) {
        rebuild(parent, entries);

        return;
    }

    const context = getOrCreateContext(parent, behavior);
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
    if (existing >= 0) {
        return entries[existing] ?? null;
    }

    return createEntry(slot, node);
};

const placeChild = (
    parent: ElementNode,
    slot: string,
    node: PlaceableNode,
    before: PlaceableNode | null,
): void => {
    const entries = parent.placements.getOrInsertComputed(slot, () => []);
    const existing = entries.findIndex((entry) => entry.node === node);
    const entry = resolveEntry(entries, existing, slot, node);

    if (entry === null) {
        return;
    }

    const isMove = existing !== -1;

    if (isMove) {
        entries.splice(existing, 1);
    }

    const index = getPosition(entries, before);
    entries.splice(index, 0, entry);

    if (isMove) {
        moveEntry(parent, entry, entries, index);
    } else {
        placeNew(parent, entry, entries, index);
    }

    markFlush(parent);
};

const unplaceChild = (parent: ElementNode, slot: string, node: PlaceableNode): void => {
    const entries = parent.placements.get(slot);

    if (entries === undefined) {
        return;
    }

    const index = entries.findIndex((entry) => entry.node === node);

    if (index === -1) {
        return;
    }

    const [entry] = entries.splice(index, 1);

    if (entry !== undefined) {
        detachEntry(parent, entry);
    }

    markFlush(parent);
};

export { placeChild, unplaceChild };
