import type * as Gtk from "@gtkx/ffi/gtk";
import type { TextPaintableProps } from "../jsx.js";
import type { Node } from "../node.js";
import { BufferOffsetNode } from "./internal/buffer-offset-node.js";
import { TEXT_OBJECT_REPLACEMENT, type TextContentParent } from "./text-content.js";
import { isTextContentParent } from "./text-segment.js";

export class TextPaintableNode extends BufferOffsetNode<TextPaintableProps, Node & TextContentParent, never> {
    public override isValidChild(_child: Node): boolean {
        return false;
    }

    public override isValidParent(parent: Node): boolean {
        return isTextContentParent(parent);
    }

    private buffer: Gtk.TextBuffer | null = null;

    public getLength(): number {
        return 1;
    }

    public getText(): string {
        return TEXT_OBJECT_REPLACEMENT;
    }

    public setTextViewAndBuffer(_textView: Gtk.TextView, buffer: Gtk.TextBuffer): void {
        this.buffer = buffer;
        this.insertPaintable();
    }

    private insertPaintable(): void {
        if (!this.buffer || !this.props.paintable) return;
        const iter = this.buffer.getIterAtOffset(this.getBufferOffset());
        this.buffer.insertPaintable(iter, this.props.paintable);
    }

    public override detachDeletedInstance(): void {
        this.buffer = null;
        super.detachDeletedInstance();
    }
}
