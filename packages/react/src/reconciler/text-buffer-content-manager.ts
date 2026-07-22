import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { getOrInsert } from "@gtkx/utils";
import { scheduleFlush } from "./commit-flush.js";
import { unparentWidget } from "./container-attach.js";
import { findClosest, type Node, stateOf } from "./state.js";
import {
    type AnchorSlot,
    anchorOffset,
    applyTagRange,
    createTagBracket,
    deleteAnchorChar,
    insertAnchorAt,
    type LeafSlot,
    type Mutate,
    markOffset,
    mountLeaf,
    registerTag,
    replaceLeafText,
    type Slot,
    type TagSlot,
    teardownLeaf,
    teardownTagBracket,
} from "./text-buffer-slots.js";
import { isBufferContentNode } from "./text-node-predicates.js";
import { trackedWidgetOf } from "./wrapper-content.js";

type Extent = { start: number; end: number };

type Container = Gtk.TextBuffer | Gtk.TextTag;

type WalkContext = {
    siblings: Node[];
    cursor: Gtk.TextMark;
    enclosing: Gtk.TextTag[];
    path: Set<Node>;
    mutate: Mutate;
};

const unionExtent = (left: Extent | null, right: Extent | null): Extent | null => {
    if (left === null) return right;
    if (right === null) return left;
    return { start: Math.min(left.start, right.start), end: Math.max(left.end, right.end) };
};

const leafText = (node: Node): string => String(stateOf(node).props.text ?? "");

class TextBufferContentManager {
    private owner: Gtk.TextBuffer;
    private mounted = new Map<Node, Slot>();
    private dirty = new Set<Node>();
    private markPlacements: { mark: Gtk.TextMark; at: Gtk.TextMark }[] = [];

    constructor(owner: Gtk.TextBuffer) {
        this.owner = owner;
    }

    public markDirty(node: Node): void {
        this.dirty.add(node);
    }

    public flush = (): void => {
        if (this.dirty.size === 0) return;
        const dirtyNodes = [...this.dirty];
        this.dirty.clear();
        this.assertNoTextPropConflict();

        let began = false;
        const mutate: Mutate = (fn) => {
            if (!began) {
                began = true;
                this.owner.beginIrreversibleAction();
            }
            fn();
        };
        try {
            this.reconcile(dirtyNodes, mutate);
        } finally {
            if (began) this.owner.endIrreversibleAction();
        }
    };

    private repairInvertedBrackets(): void {
        for (const slot of this.mounted.values()) {
            if (slot.kind !== "tag" && slot.kind !== "leaf") continue;
            const entry = markOffset(this.owner, slot.entry);
            const exit = markOffset(this.owner, slot.exit);
            if (entry <= exit) continue;
            this.owner.moveMark(slot.entry, this.owner.getIterAtOffset(exit));
            this.owner.moveMark(slot.exit, this.owner.getIterAtOffset(entry));
        }
    }

    private reconcile(dirtyNodes: Node[], mutate: Mutate): void {
        this.repairInvertedBrackets();
        const path = new Set<Node>();
        let needsSync = false;
        for (const node of dirtyNodes) {
            if (this.isLiveContent(node)) {
                this.collectPathContainers(node, path);
                needsSync = true;
            } else {
                this.teardownSubtree(node, mutate);
            }
        }
        if (needsSync) this.syncContainer(this.owner, path, mutate);
        for (const { mark, at } of this.markPlacements) {
            const where = this.owner.getIterAtMark(at);
            if (mark.getBuffer() === this.owner) this.owner.moveMark(mark, where);
            else this.owner.addMark(mark, where);
            this.owner.deleteMark(at);
        }
        this.markPlacements = [];
    }

    private assertNoTextPropConflict(): void {
        const state = stateOf(this.owner);
        if (state.props.text === undefined) return;
        if (!state.children.some(isBufferContentNode)) return;
        throw new Error("<GtkTextBuffer> cannot mix a `text` prop with content children; use one or the other");
    }

    private isLiveContent(node: Node): boolean {
        let current: Node = node;
        while (current !== this.owner) {
            const state = stateOf(current);
            if (state.hidden || state.parent === null) return false;
            current = state.parent;
        }
        return true;
    }

    private tagAncestors(node: Node): Gtk.TextTag[] {
        const tags: Gtk.TextTag[] = [];
        let current = stateOf(node).parent;
        while (current !== null && current !== this.owner) {
            if (current instanceof Gtk.TextTag) tags.push(current);
            current = stateOf(current).parent;
        }
        return tags;
    }

    private collectPathContainers(node: Node, path: Set<Node>): void {
        for (const tag of this.tagAncestors(node)) path.add(tag);
    }

    private enclosingTags(container: Container): Gtk.TextTag[] {
        const own = container instanceof Gtk.TextTag ? [container] : [];
        return [...own, ...this.tagAncestors(container)];
    }

    private contentChildrenOf(container: Container): Node[] {
        return stateOf(container).children.filter(isBufferContentNode);
    }

    private syncContainer(container: Container, path: Set<Node>, mutate: Mutate): Extent | null {
        const buffer = this.owner;
        const startOffset = this.containerStartOffset(container);
        const cursor = buffer.createMark(null, buffer.getIterAtOffset(startOffset), true);
        const walk: WalkContext = {
            siblings: this.contentChildrenOf(container),
            cursor,
            enclosing: this.enclosingTags(container),
            path,
            mutate,
        };
        try {
            let extent: Extent | null = null;
            for (const [index, child] of walk.siblings.entries()) {
                extent = unionExtent(extent, this.processChild(child, index, walk));
            }
            if (container instanceof Gtk.TextTag) return this.rebracketTag(container, extent);
            return extent;
        } finally {
            buffer.deleteMark(cursor);
        }
    }

    private bracketExtent(slot: LeafSlot | TagSlot): Extent {
        const entry = markOffset(this.owner, slot.entry);
        const exit = markOffset(this.owner, slot.exit);
        return entry <= exit ? { start: entry, end: exit } : { start: exit, end: entry };
    }

    private containerStartOffset(container: Container): number {
        if (!(container instanceof Gtk.TextTag)) return 0;
        const slot = this.mounted.get(container);
        return slot !== undefined && slot.kind === "tag" ? this.bracketExtent(slot).start : 0;
    }

    private processChild(child: Node, index: number, walk: WalkContext): Extent | null {
        const slot = this.mounted.get(child);
        if (stateOf(child).hidden) {
            if (slot !== undefined) this.teardownSubtree(child, walk.mutate);
            return null;
        }
        if (slot === undefined) return this.mountChild(child, index, walk);
        const start = this.slotStart(child, slot);
        if (start === null || start < markOffset(this.owner, walk.cursor)) {
            this.teardownSubtree(child, walk.mutate);
            return this.mountChild(child, index, walk);
        }
        const extent = this.updateInPlace(child, slot, start, walk);
        this.owner.moveMark(walk.cursor, this.owner.getIterAtOffset(extent.end));
        return extent;
    }

    private updateInPlace(child: Node, slot: Slot, start: number, walk: WalkContext): Extent {
        if (slot.kind === "leaf") return this.updateLeafInPlace(child, slot, start, walk);
        if (slot.kind === "tag") {
            if (child instanceof Gtk.TextTag && walk.path.has(child)) {
                const synced = this.syncContainer(child, walk.path, walk.mutate);
                if (synced !== null) return synced;
            }
            return this.bracketExtent(slot);
        }
        if (slot.kind === "anchor") {
            this.resyncAnchorWidget(child, slot);
            return { start, end: start + 1 };
        }
        return { start, end: start };
    }

    private updateLeafInPlace(child: Node, slot: LeafSlot, start: number, walk: WalkContext): Extent {
        const text = leafText(child);
        if (text !== slot.text) {
            replaceLeafText(this.owner, slot, text, walk.mutate);
            this.applyEnclosing(walk.enclosing, { start, end: start + text.length }, walk.mutate);
        }
        return this.bracketExtent(slot);
    }

    private mountChild(child: Node, index: number, walk: WalkContext): Extent {
        const cursorOffset = markOffset(this.owner, walk.cursor);
        const target = this.nextMountedSiblingStart(walk.siblings, index + 1, cursorOffset) ?? cursorOffset;
        const end = this.mountNodeAt(child, target, walk.enclosing, walk.mutate);
        this.owner.moveMark(walk.cursor, this.owner.getIterAtOffset(end));
        return { start: target, end };
    }

    private nextMountedSiblingStart(siblings: Node[], from: number, minOffset: number): number | null {
        for (const sibling of siblings.slice(from)) {
            if (stateOf(sibling).hidden) continue;
            const slot = this.mounted.get(sibling);
            if (slot === undefined) continue;
            const start = this.slotStart(sibling, slot);
            if (start !== null && start >= minOffset) return start;
        }
        return null;
    }

    private slotStart(node: Node, slot: Slot): number | null {
        if (slot.kind === "leaf" || slot.kind === "tag") return this.bracketExtent(slot).start;
        if (slot.kind === "anchor") {
            return slot.anchor.getDeleted() ? null : anchorOffset(this.owner, slot.anchor);
        }
        if (node instanceof Gtk.TextMark && node.getBuffer() === this.owner) return markOffset(this.owner, node);
        return null;
    }

    private mountNodeAt(node: Node, atOffset: number, enclosing: Gtk.TextTag[], mutate: Mutate): number {
        if (node instanceof Gtk.TextTag) return this.mountTagAt(node, atOffset, enclosing, mutate);
        if (node instanceof Gtk.TextChildAnchor) return this.mountAnchorAt(node, atOffset, enclosing, mutate);
        if (node instanceof Gtk.TextMark) {
            const at = this.owner.createMark(null, this.owner.getIterAtOffset(atOffset), true);
            this.markPlacements.push({ mark: node, at });
            this.mounted.set(node, { kind: "mark" });
            return atOffset;
        }
        return this.mountLeafAt(node, atOffset, enclosing, mutate);
    }

    private applyEnclosing(enclosing: Gtk.TextTag[], extent: Extent, mutate: Mutate): number {
        for (const tag of enclosing) applyTagRange(this.owner, tag, extent, mutate);
        return extent.end;
    }

    private mountLeafAt(node: Node, atOffset: number, enclosing: Gtk.TextTag[], mutate: Mutate): number {
        const text = leafText(node);
        const slot = mountLeaf(this.owner, text, atOffset, mutate);
        this.mounted.set(node, slot);
        return this.applyEnclosing(enclosing, { start: atOffset, end: atOffset + text.length }, mutate);
    }

    private mountTagAt(tag: Gtk.TextTag, atOffset: number, enclosing: Gtk.TextTag[], mutate: Mutate): number {
        registerTag(this.owner, tag);
        const childEnclosing = [...enclosing, tag];
        let position = atOffset;
        for (const child of this.contentChildrenOf(tag)) {
            if (stateOf(child).hidden) continue;
            position = this.mountNodeAt(child, position, childEnclosing, mutate);
        }
        this.mounted.set(tag, createTagBracket(this.owner, atOffset, position));
        return position;
    }

    private mountAnchorAt(
        node: Gtk.TextChildAnchor,
        atOffset: number,
        enclosing: Gtk.TextTag[],
        mutate: Mutate,
    ): number {
        const anchor = Gtk.TextChildAnchor.new();
        stateOf(node).adoptedInstance = anchor;
        insertAnchorAt(this.owner, anchor, atOffset, mutate);
        const slot: AnchorSlot = { kind: "anchor", anchor, attachedWidget: null };
        this.mounted.set(node, slot);
        this.resyncAnchorWidget(node, slot);
        return this.applyEnclosing(enclosing, { start: atOffset, end: atOffset + 1 }, mutate);
    }

    private resyncAnchorWidget(node: Node, slot: AnchorSlot): void {
        const desired = trackedWidgetOf(node);
        if (slot.attachedWidget === desired) return;
        const view = this.resolveView();
        if (view === null) return;
        if (slot.attachedWidget !== null && slot.attachedWidget.getParent() === view) {
            view.remove(slot.attachedWidget);
        }
        if (desired !== null) {
            unparentWidget(desired);
            view.addChildAtAnchor(desired, slot.anchor);
        }
        slot.attachedWidget = desired;
    }

    private rebracketTag(tag: Gtk.TextTag, extent: Extent | null): Extent | null {
        const slot = this.mounted.get(tag);
        if (slot === undefined || slot.kind !== "tag") return extent;
        const buffer = this.owner;
        if (extent === null) {
            const entryOffset = markOffset(buffer, slot.entry);
            if (markOffset(buffer, slot.exit) !== entryOffset) {
                buffer.moveMark(slot.exit, buffer.getIterAtOffset(entryOffset));
            }
            return { start: entryOffset, end: entryOffset };
        }
        if (markOffset(buffer, slot.entry) > extent.start) {
            buffer.moveMark(slot.entry, buffer.getIterAtOffset(extent.start));
        }
        if (markOffset(buffer, slot.exit) < extent.end) {
            buffer.moveMark(slot.exit, buffer.getIterAtOffset(extent.end));
        }
        return { start: markOffset(buffer, slot.entry), end: markOffset(buffer, slot.exit) };
    }

    private teardownSubtree(node: Node, mutate: Mutate): void {
        const slot = this.mounted.get(node);
        this.mounted.delete(node);
        if (node instanceof Gtk.TextTag) {
            if (slot !== undefined && slot.kind === "tag") teardownTagBracket(this.owner, node, slot, mutate);
            for (const child of this.contentChildrenOf(node)) this.teardownSubtree(child, mutate);
            return;
        }
        if (slot === undefined) return;
        if (slot.kind === "leaf") teardownLeaf(this.owner, slot, mutate);
        else if (slot.kind === "anchor") this.teardownAnchor(slot, mutate);
        else if (slot.kind === "mark" && node instanceof Gtk.TextMark) {
            if (node.getBuffer() === this.owner) this.owner.deleteMark(node);
        }
    }

    private teardownAnchor(slot: AnchorSlot, mutate: Mutate): void {
        const view = this.resolveView();
        if (slot.attachedWidget !== null && view !== null && slot.attachedWidget.getParent() === view) {
            view.remove(slot.attachedWidget);
        }
        slot.attachedWidget = null;
        deleteAnchorChar(this.owner, slot.anchor, mutate);
    }

    private resolveView(): Gtk.TextView | null {
        let ancestor = stateOf(this.owner).parent;
        while (ancestor && !(ancestor instanceof GObject.Object)) ancestor = stateOf(ancestor).parent;
        return ancestor instanceof Gtk.TextView ? ancestor : null;
    }
}

const managers = new WeakMap<Gtk.TextBuffer, TextBufferContentManager>();

export const scheduleTextBufferSync = (searchFrom: Node, dirtyNode: Node = searchFrom): void => {
    const owner = findClosest(
        searchFrom,
        (candidate): candidate is Gtk.TextBuffer => candidate instanceof Gtk.TextBuffer,
    );
    if (owner === null) return;
    const manager = getOrInsert(managers, owner, () => new TextBufferContentManager(owner));
    manager.markDirty(dirtyNode);
    scheduleFlush(manager.flush);
};
