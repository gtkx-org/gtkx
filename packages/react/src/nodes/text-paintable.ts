import type * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { registerNodeClass } from "../registry.js";
import { VirtualNode } from "./virtual.js";

const PLACEHOLDER = "\uFFFC";

export type TextPaintableProps = {
    paintable: Gdk.Paintable;
};

export class TextPaintableNode extends VirtualNode<TextPaintableProps> {
    public static override priority = 1;

    private buffer: Gtk.TextBuffer | null = null;
    public bufferOffset = 0;

    public static override matches(type: string): boolean {
        return type === "TextPaintable";
    }

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

    public override unmount(): void {
        this.buffer = null;
        super.unmount();
    }
}

registerNodeClass(TextPaintableNode);
