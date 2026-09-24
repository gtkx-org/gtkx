import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { drain, indexBeforeOrEnd } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo } from "./registry.js";
import { applyAdoptedProps, assertSlotCanChange } from "./apply-props.js";
import { shouldDetachBeforeParent } from "./behaviors.js";
import { typeInfoFor } from "./metadata.js";
import {
    DEFAULT_SLOT,
    ELEMENT_KIND,
    type ElementNode,
    LAZY_KIND,
    type LazyNode,
    lazyTarget,
    leafElement,
    type PlaceableNode,
    type PlacedChild,
} from "./node.js";
import { applyMutation, applyWrite, disconnectAllHandlers } from "./signals.js";
import { markTextDirty } from "./text.js";

type AttachContext = { parent: ElementNode; entry: PlacedChild; index: number; sibling: GObject.Object | null };

const pendingAdoptions: Set<LazyNode> = new Set();

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

const placeInfo = (entry: PlacedChild, index: number, sibling: GObject.Object | null): PlaceInfo => ({
    slot: entry.slot,
    index,
    sibling,
    adopted: entry.adopted,
    props: entry.node.props,
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

    replaceAdopted(entry.node, entry.adopted);
    applyAdoptedProps(lazyTarget(entry.node, entry.adopted), {}, entry.node.props);
    notifyAdoption(entry.node);
};

const replaceAdopted = (node: LazyNode, object: GObject.Object | null): void => {
    if (node.adopted === object) {
        return;
    }

    if (node.adopted !== null) {
        disconnectAllHandlers(lazyTarget(node, node.adopted));
    }

    node.adopted = object;
};

const notifyAdoption = (node: LazyNode): void => {
    if (node.adoptionListeners.size > 0) {
        pendingAdoptions.add(node);
    }
};

const flushAdoptions = (): void => {
    drain(pendingAdoptions, (node) => {
        for (const notify of node.adoptionListeners) {
            notify();
        }
    });
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

    const claim = attach(ctx.parent.object, ctx.entry.object, placeInfo(ctx.entry, ctx.index, ctx.sibling));

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

const detachInfo = (entry: PlacedChild, index: number): DetachInfo => ({
    index,
    slot: entry.slot,
    adopted: entry.adopted,
    props: entry.node.props,
});

const runDetach = (parent: ElementNode, entry: PlacedChild, index: number): void => {
    const behavior = entry.behavior;

    if (behavior === null) {
        writeSlot(parent, entry, null);

        return;
    }

    behavior.detach?.(parent.object, entry.object, detachInfo(entry, index));
};

const detachEntry = (parent: ElementNode, entry: PlacedChild, index: number): void => {
    applyMutation(() => {
        runDetach(parent, entry, index);
    });

    if (entry.node.kind === LAZY_KIND) {
        replaceAdopted(entry.node, null);
        notifyAdoption(entry.node);
    }
};

const isBeforeParentEntry = (entry: PlacedChild): boolean =>
    entry.behavior !== null && shouldDetachBeforeParent(entry.behavior);

const detachBeforeParentEntries = (
    parent: ElementNode,
    entries: PlacedChild[],
    release: (node: PlaceableNode) => void,
): void => {
    const remaining = entries.filter((entry, index) => {
        if (!isBeforeParentEntry(entry)) {
            return true;
        }

        detachEntry(parent, entry, index);
        release(entry.node);

        return false;
    });

    entries.splice(0, entries.length, ...remaining);
};

const teardownBeforeParent = (parent: ElementNode, release: (node: PlaceableNode) => void): void => {
    for (const entries of parent.placements.values()) {
        detachBeforeParentEntries(parent, entries, release);
    }
};

const rebuild = (parent: ElementNode, entries: PlacedChild[]): void => {
    for (const entry of entries) {
        detachEntry(parent, entry, 0);
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

    const claim = reorder(parent.object, entry.object, placeInfo(entry, index, siblingAt(entries, index)));
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

    if (parent.isMounted) {
        assertSlotCanChange(parent.typeName, slot);
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

    if (parent.isMounted) {
        assertSlotCanChange(parent.typeName, slot);
    }

    const [entry] = entries.splice(index, 1);

    if (entry !== undefined) {
        detachEntry(parent, entry, index);
    }
};

const teardownPlacements = (parent: ElementNode): void => {
    for (const entries of parent.placements.values()) {
        for (const entry of entries) {
            detachEntry(parent, entry, 0);
        }
    }

    parent.placements.clear();
};

export { flushAdoptions, placeChild, teardownBeforeParent, teardownPlacements, unplaceChild };
