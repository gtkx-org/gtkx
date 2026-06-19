import type * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { scheduleFlush } from "./commit-flush.js";
import { type Node, stateOf } from "./state.js";
import { isAnchorWrapper, isBufferContentWrapper, isBufferTextWrapper, isPaintableWrapper } from "./text-wrapper.js";
import { unparentWidget } from "./widget.js";

/**
 * Linearizes a `<GtkTextBuffer>` element's React content children into its
 * backing `Gtk.TextBuffer`.
 *
 * On every structural or content change the buffer is rebuilt in tree order:
 * the children are walked depth-first while the buffer end iterator advances,
 * text runs and inline paintables are inserted, anchored widgets occupy one
 * anchor each, and each `Gtk.TextTag` is applied across the offset range its
 * descendant content spans. The rebuild is bracketed by
 * `beginIrreversibleAction`/`endIrreversibleAction` so it never pollutes the
 * user-facing undo stack, and is coalesced to one pass per commit through a
 * post-commit debounce. Buffer signal handlers are suppressed during a commit
 * by the owner's signal store.
 *
 * Anchored widgets need a view to attach to; the controller resolves the
 * enclosing `Gtk.TextView` from the buffer element's nearest backing ancestor
 * at rebuild time — stepping over the slot wrapper when the buffer is mounted
 * through a `buffer={...}` prop — and skips widget attachment when the buffer
 * is rendered without a view.
 */
export class TextBufferController {
    private managesContent = false;
    private readonly anchoredWidgets = new Set<Gtk.Widget>();
    private readonly boundRebuild = (): void => this.rebuild();

    /**
     * @param owner - The node whose backing GObject is the text buffer; its
     *   `children` are the content the buffer is rebuilt from.
     */
    constructor(private readonly owner: Node) {}

    /** Schedules a single buffer rebuild to run after the current commit drains. */
    public scheduleRebuild(): void {
        scheduleFlush(this.boundRebuild);
    }

    private resolveBuffer(): Gtk.TextBuffer | null {
        return this.owner instanceof Gtk.TextBuffer ? this.owner : null;
    }

    private resolveView(): Gtk.TextView | null {
        let ancestor = stateOf(this.owner).parent;
        while (ancestor && !(ancestor instanceof GObject.Object)) ancestor = stateOf(ancestor).parent;
        return ancestor instanceof Gtk.TextView ? ancestor : null;
    }

    private hasManagedChildren(): boolean {
        return stateOf(this.owner).children.some(
            (child) => isBufferContentWrapper(child) || child instanceof Gtk.TextTag,
        );
    }

    private rebuild(): void {
        const buffer = this.resolveBuffer();
        if (!buffer) return;

        if (this.hasManagedChildren()) this.managesContent = true;
        if (!this.managesContent) return;

        const state = stateOf(this.owner);
        state.signalStore.blockAll();
        buffer.beginIrreversibleAction();
        try {
            this.detachAnchoredWidgets();
            this.clearBuffer(buffer);
            this.insertChildren(buffer, state.children);
        } finally {
            buffer.endIrreversibleAction();
            state.signalStore.unblockAll();
        }
    }

    private detachAnchoredWidgets(): void {
        for (const widget of this.anchoredWidgets) unparentWidget(widget);
        this.anchoredWidgets.clear();
    }

    private clearBuffer(buffer: Gtk.TextBuffer): void {
        const start = buffer.getStartIter();
        const end = buffer.getEndIter();
        if (!start.equal(end)) buffer.delete(start, end);

        const tagTable = buffer.getTagTable();
        const tags: Gtk.TextTag[] = [];
        tagTable.foreach((tag) => tags.push(tag));
        for (const tag of tags) tagTable.remove(tag);
    }

    private insertChildren(buffer: Gtk.TextBuffer, children: readonly Node[]): void {
        for (const child of children) {
            this.insertChild(buffer, child);
        }
    }

    private insertChild(buffer: Gtk.TextBuffer, child: Node): void {
        if (isBufferTextWrapper(child)) {
            this.insertText(buffer, stateOf(child).props.text as string);
        } else if (isPaintableWrapper(child)) {
            this.insertPaintable(buffer, stateOf(child).props.paintable as Gdk.Paintable);
        } else if (isAnchorWrapper(child)) {
            this.insertAnchor(buffer, child);
        } else if (child instanceof Gtk.TextTag) {
            this.insertTag(buffer, child, child);
        }
    }

    private insertTag(buffer: Gtk.TextBuffer, element: Node, tag: Gtk.TextTag): void {
        const tagTable = buffer.getTagTable();
        if (tag.name && !tagTable.lookup(tag.name)) tagTable.add(tag);

        const start = buffer.getCharCount();
        this.insertChildren(buffer, stateOf(element).children);
        const end = buffer.getCharCount();
        if (end > start) {
            buffer.applyTag(tag, buffer.getIterAtOffset(start), buffer.getIterAtOffset(end));
        }
    }

    private insertAnchor(buffer: Gtk.TextBuffer, wrapper: Node): void {
        const child = stateOf(wrapper).children[0];
        const replacement = stateOf(wrapper).props.replacementChar;
        const anchor =
            typeof replacement === "string"
                ? Gtk.TextChildAnchor.newWithReplacement(replacement)
                : Gtk.TextChildAnchor.new();
        buffer.insertChildAnchor(buffer.getEndIter(), anchor);
        const view = this.resolveView();
        if (view && child instanceof Gtk.Widget) {
            unparentWidget(child);
            view.addChildAtAnchor(child, anchor);
            this.anchoredWidgets.add(child);
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
