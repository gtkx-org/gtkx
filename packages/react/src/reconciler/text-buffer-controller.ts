import type * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { unparentWidget } from "./container-attach.js";
import { type Node, stateOf } from "./state.js";
import { isAnchorNode, isBufferContentNode, isBufferTextNode, isPaintableNode } from "./text-node.js";

export class TextBufferController {
    private managesContent = false;
    private owner: Gtk.TextBuffer;

    constructor(owner: Gtk.TextBuffer) {
        this.owner = owner;
    }

    private resolveView(): Gtk.TextView | null {
        let ancestor = stateOf(this.owner).parent;
        while (ancestor && !(ancestor instanceof GObject.Object)) ancestor = stateOf(ancestor).parent;
        return ancestor instanceof Gtk.TextView ? ancestor : null;
    }

    private hasManagedChildren(): boolean {
        return stateOf(this.owner).children.some((child) => isBufferContentNode(child) || child instanceof Gtk.TextTag);
    }

    public rebuild = (): void => {
        const buffer = this.owner;

        if (this.hasManagedChildren()) this.managesContent = true;
        if (!this.managesContent) return;

        const state = stateOf(this.owner);
        buffer.beginIrreversibleAction();
        try {
            this.clearBuffer(buffer);
            this.insertChildren(buffer, state.children);
        } finally {
            buffer.endIrreversibleAction();
        }
    };

    private clearBuffer(buffer: Gtk.TextBuffer): void {
        const start = buffer.getStartIter();
        const end = buffer.getEndIter();
        if (!start.equal(end)) buffer.delete(start, end);

        const tagTable = buffer.getTagTable();
        const tags: Gtk.TextTag[] = [];
        tagTable.foreach((tag) => tags.push(tag));
        for (const tag of tags) tagTable.remove(tag);
    }

    private insertChildren(buffer: Gtk.TextBuffer, children: Node[]): void {
        for (const child of children) {
            this.insertChild(buffer, child);
        }
    }

    private insertChild(buffer: Gtk.TextBuffer, child: Node): void {
        if (isBufferTextNode(child)) {
            this.insertText(buffer, stateOf(child).props.text as string);
        } else if (isPaintableNode(child)) {
            this.insertPaintable(buffer, stateOf(child).props.paintable as Gdk.Paintable);
        } else if (isAnchorNode(child)) {
            this.insertAnchor(buffer, child);
        } else if (child instanceof Gtk.TextTag) {
            this.insertTag(buffer, child);
        }
    }

    private insertTag(buffer: Gtk.TextBuffer, tag: Gtk.TextTag): void {
        const tagTable = buffer.getTagTable();
        if (tag.name && !tagTable.lookup(tag.name)) tagTable.add(tag);

        const start = buffer.getCharCount();
        this.insertChildren(buffer, stateOf(tag).children);
        const end = buffer.getCharCount();
        if (end > start) {
            buffer.applyTag(tag, buffer.getIterAtOffset(start), buffer.getIterAtOffset(end));
        }
    }

    private insertAnchor(buffer: Gtk.TextBuffer, node: Node): void {
        const child = stateOf(node).children[0];
        const replacement = stateOf(node).props.replacementChar;
        const anchor =
            typeof replacement === "string"
                ? Gtk.TextChildAnchor.newWithReplacement(replacement)
                : Gtk.TextChildAnchor.new();
        buffer.insertChildAnchor(buffer.getEndIter(), anchor);
        const view = this.resolveView();
        if (view && child instanceof Gtk.Widget) {
            unparentWidget(child);
            view.addChildAtAnchor(child, anchor);
        }
    }

    private insertPaintable(buffer: Gtk.TextBuffer, paintable: Gdk.Paintable): void {
        buffer.insertPaintable(buffer.getEndIter(), paintable);
    }

    private insertText(buffer: Gtk.TextBuffer, text: string): void {
        if (text.length === 0) return;
        buffer.insert(buffer.getEndIter(), text, -1);
    }
}
