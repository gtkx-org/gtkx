import type { Node } from "../../node.js";
import { VirtualNode } from "../virtual.js";

/**
 * Base class for virtual nodes that carry a buffer offset, used by text-segment,
 * text-tag, text-anchor, and text-paintable to track their position inside a
 * Gtk.TextBuffer managed by `TextBufferController`.
 */
export abstract class BufferOffsetNode<
    TProps,
    TParent extends Node,
    TChild extends Node,
    // biome-ignore lint/suspicious/noExplicitAny: matches VirtualNode's loose bound
> extends VirtualNode<TProps, TParent, TChild & any> {
    private bufferOffset = 0;

    public getBufferOffset(): number {
        return this.bufferOffset;
    }

    public setBufferOffset(offset: number): void {
        this.bufferOffset = offset;
    }
}
