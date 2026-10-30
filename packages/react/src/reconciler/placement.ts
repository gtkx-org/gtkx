import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { createLogger, drain, indexBeforeOrEnd, type Logger } from "@gtkx/utils";
import type { DetachInfo, ElementBehavior, PlaceInfo } from "./registry.js";
import { applyAdoptedProps, discardAccessible, markDependentPropsDirty } from "./apply-props.js";
import { holdsOneChild, slotAccepting } from "./behaviors.js";
import { propertiesAccepting, typeInfoFor } from "./metadata.js";
import {
    DEFAULT_SLOT,
    createElementNode,
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
const pendingSlotChecks: Set<ElementNode> = new Set();
const log: Logger = createLogger("react");

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

const placeInfo = (
    parent: ElementNode,
    entry: PlacedChild,
    index: number,
    sibling: GObject.Object | null,
): PlaceInfo => ({
    slot: entry.slot,
    index,
    sibling,
    adopted: entry.adopted,
    props: entry.node.props,
    children: (parent.placements.get(entry.slot) ?? []).map((child) => child.object),
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

    if (node.propertyHost !== null) {
        teardownPlacements(node.propertyHost);
        discardAccessible(node.propertyHost);
    }

    node.adopted = object;
    node.propertyHost = object === null ? null : createElementNode(node.typeName, object, node.dispatch, null);

    if (node.propertyHost !== null) {
        for (const prop of node.propChildren) {
            for (const child of prop.children) {
                placeChild(node.propertyHost, prop.slot, child, null);
            }
        }
    }
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

const isShownWidget = (entry: PlacedChild): boolean => entry.object instanceof Gtk.Widget && entry.object.getVisible();

const singleChildGroups = (entries: readonly PlacedChild[]): PlacedChild[][] => {
    const groups: Map<ElementBehavior | null, PlacedChild[]> = new Map();

    for (const entry of entries) {
        if (entry.behavior === null || holdsOneChild(entry.behavior)) {
            groups.getOrInsertComputed(entry.behavior, () => []).push(entry);
        }
    }

    return [...groups.values()];
};

const warnHiddenChildren = (parent: ElementNode, slot: string, entries: readonly PlacedChild[]): void => {
    for (const group of singleChildGroups(entries)) {
        const shown = group.filter((entry) => isShownWidget(entry));
        const last = shown.at(-1);

        if (shown.length > 1 && last !== undefined) {
            const place = slot === DEFAULT_SLOT ? "as its child" : `in ${slot}`;
            log.warn(
                `<${parent.typeName}> shows one widget ${place} but was given ${String(shown.length)} visible ones; ` +
                    `only the last, <${last.typeName}>, is shown. Wrap them in a container such as <GtkBox>, ` +
                    `or pass the others through the props that take them.`,
            );
        }
    }
};

const flushSlotChecks = (): void => {
    drain(pendingSlotChecks, (parent) => {
        for (const [slot, entries] of parent.placements) {
            warnHiddenChildren(parent, slot, entries);
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
        markDependentPropsDirty(parent);
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

    const claim = attach(ctx.parent.object, ctx.entry.object, placeInfo(ctx.parent, ctx.entry, ctx.index, ctx.sibling));

    if (claim === undefined) {
        return false;
    }

    ctx.entry.behavior = behavior;
    adoptedFrom(ctx.parent, ctx.entry, behavior, claim);
    applyLazyProps(ctx.entry);

    return true;
};

const slotsAccepting = (parent: ElementNode, child: GObject.Object): string[] => {
    const behaviorSlots = typeInfoFor(parent.typeName).behaviors.flatMap(
        (behavior) => slotAccepting(behavior, parent.object, child) ?? [],
    );
    const slots = new Set([...behaviorSlots, ...propertiesAccepting(parent.object, child)]);

    return [...slots].filter((name) => name !== DEFAULT_SLOT);
};

const unclaimedChildError = (parent: ElementNode, entry: PlacedChild): Error => {
    const parentTag = `<${parent.typeName}>`;
    const childTag = `<${entry.typeName}>`;
    const slots = slotsAccepting(parent, entry.object);
    const placement =
        entry.slot === DEFAULT_SLOT
            ? `${childTag} cannot be a child of ${parentTag}.`
            : `${childTag} cannot be passed as ${entry.slot}: it is a method of ${parentTag}, not a prop.`;

    if (slots.length > 0) {
        const props = slots.map((name) => `${name}={<${entry.typeName} />}`).join(" or ");

        return new Error(`${placement} Pass it as a prop instead: ${props}.`);
    }

    return new Error(
        `${placement} Pass it to the ` +
            `${parentTag} prop that takes it, if there is one, portal it to rootElement with createPortal ` +
            `if it does not belong inside ${parentTag}, or register an attach behavior for ` +
            `${parentTag} with defineElements from "@gtkx/react/config" if it belongs among its children.`,
    );
};

const runAttach = (parent: ElementNode, entry: PlacedChild, index: number, sibling: GObject.Object | null): void => {
    const ctx: AttachContext = { parent, entry, index, sibling };

    for (const behavior of typeInfoFor(parent.typeName).behaviors) {
        if (didAttach(ctx, behavior)) {
            return;
        }
    }

    if (entry.slot === DEFAULT_SLOT || typeof Reflect.get(parent.object, entry.slot) === "function") {
        throw unclaimedChildError(parent, entry);
    }

    setObjectSlot(parent, entry);
};

const attachEntry = (parent: ElementNode, entry: PlacedChild, index: number, sibling: GObject.Object | null): void => {
    applyMutation(() => {
        runAttach(parent, entry, index, sibling);
    });
};

const detachInfo = (entry: PlacedChild, index: number, remaining: readonly PlacedChild[]): DetachInfo => ({
    index,
    slot: entry.slot,
    adopted: entry.adopted,
    props: entry.node.props,
    remaining: remaining.filter((other) => other.behavior === entry.behavior).map((other) => other.object),
});

const runDetach = (parent: ElementNode, entry: PlacedChild, info: DetachInfo): void => {
    const behavior = entry.behavior;

    if (behavior === null) {
        writeSlot(parent, entry, info.remaining.at(-1) ?? null);

        return;
    }

    behavior.detach?.(parent.object, entry.object, info);
};

const detachEntry = (
    parent: ElementNode,
    entry: PlacedChild,
    index: number,
    remaining: readonly PlacedChild[],
): void => {
    const info = detachInfo(entry, index, remaining);

    applyMutation(() => {
        runDetach(parent, entry, info);
    });

    if (entry.node.kind === LAZY_KIND) {
        replaceAdopted(entry.node, null);
        notifyAdoption(entry.node);
    }
};

const rebuild = (parent: ElementNode, entries: PlacedChild[]): void => {
    for (const [index, entry] of entries.entries()) {
        detachEntry(parent, entry, 0, entries.slice(index + 1));
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

    const claim = applyMutation(() =>
        reorder(parent.object, entry.object, placeInfo(parent, entry, index, siblingAt(entries, index))),
    );
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

const placeChild = (parent: ElementNode, slot: string, node: PlaceableNode, before: PlaceableNode | null): void => {
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

    if (process.env.NODE_ENV !== "production") {
        pendingSlotChecks.add(parent);
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

    const [entry] = entries.splice(index, 1);

    if (entry !== undefined) {
        detachEntry(parent, entry, index, entries);
    }
};

const teardownPlacements = (parent: ElementNode): void => {
    for (const [slot, entries] of parent.placements) {
        const retained: PlacedChild[] = [];
        for (const [index, entry] of entries.entries()) {
            if (parent.externalChildren.has(entry.node)) {
                retained.push(entry);
            } else {
                detachEntry(parent, entry, 0, [...retained, ...entries.slice(index + 1)]);
            }
        }
        if (retained.length === 0) {
            parent.placements.delete(slot);
        } else {
            parent.placements.set(slot, retained);
        }
    }
};

export { flushAdoptions, flushSlotChecks, placeChild, teardownPlacements, unplaceChild };
