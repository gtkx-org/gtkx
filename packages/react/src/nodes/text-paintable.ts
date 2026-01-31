import type * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { VirtualNode } from "./virtual.js";

const PLACEHOLDER = "\uFFFC";

/**
 * Props for the TextPaintable virtual element.
 *
 * Used to embed inline images or icons within text content in a GtkTextView.
 */
export type TextPaintableProps = {
    /** The paintable (image, icon, etc.) to embed inline with the text */
    paintable: Gdk.Paintable;
};

export class TextPaintableNode extends VirtualNode<TextPaintableProps> {
    private buffer: Gtk.TextBuffer | null = null;
    public bufferOffset = 0;

    public getLength(): number {
        return 1;
    }

    public getText(): string {
        return PLACEHOLDER;
    }

    public setTextViewAndBuffer(_textView: Gtk.TextView, buffer: Gtk.TextBuffer): void {
        this.buffer = buffer;
        this.insertPaintable();
    }

    private insertPaintable(): void {
        if (!this.buffer || !this.props.paintable) return;
        const iter = new Gtk.TextIter();
        this.buffer.getIterAtOffset(iter, this.bufferOffset);
        this.buffer.insertPaintable(iter, this.props.paintable);
    }

    public override detachDeletedInstance(): void {
        this.buffer = null;
        super.detachDeletedInstance();
    }
}
