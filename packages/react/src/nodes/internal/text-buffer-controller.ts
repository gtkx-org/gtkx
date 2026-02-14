import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkTextViewProps } from "../../jsx.js";
import type { Node } from "../../node.js";
import { TextAnchorNode } from "../text-anchor.js";
import type { TextContentChild, TextContentParent } from "../text-content.js";
import { TextPaintableNode } from "../text-paintable.js";
import { TextSegmentNode } from "../text-segment.js";
import { TextTagNode } from "../text-tag.js";
import { hasChanged } from "./props.js";

type BufferCallbackProps = Pick<
    GtkTextViewProps,
    "onBufferChanged" | "onTextInserted" | "onTextDeleted" | "onCanUndoChanged" | "onCanRedoChanged"
>;

type BufferProps = Pick<GtkTextViewProps, "enableUndo"> & BufferCallbackProps;

export class TextBufferController<TBuffer extends Gtk.TextBuffer = Gtk.TextBuffer> {
    private buffer: TBuffer | null = null;
    private textChildren: TextContentChild[] = [];
    private initialMount = true;
    private irreversibleStarted = false;

    constructor(
        private readonly owner: Node & TextContentParent,
        private readonly container: Gtk.TextView,
        private readonly createBuffer: () => TBuffer,
    ) {}

    getBuffer(): TBuffer | null {
        return this.buffer;
    }

    hasTextChildren(): boolean {
        return this.textChildren.length > 0;
    }

    ensureBuffer(): TBuffer {
        if (!this.buffer) {
            this.buffer = this.createBuffer();
            this.container.setBuffer(this.buffer);
        }
        return this.buffer;
    }

    finalizeInitialMount(): void {
        if (this.irreversibleStarted) {
            this.buffer?.endIrreversibleAction();
            this.irreversibleStarted = false;
        }
        this.initialMount = false;
    }

    applyOwnProps(oldProps: BufferProps | null, newProps: BufferProps): void {
        const hasBufferProps =
            newProps.enableUndo !== undefined ||
            newProps.onBufferChanged !== undefined ||
            newProps.onTextInserted !== undefined ||
            newProps.onTextDeleted !== undefined ||
            newProps.onCanUndoChanged !== undefined ||
            newProps.onCanRedoChanged !== undefined;

        if (!hasBufferProps && this.textChildren.length === 0) {
            return;
        }

        const buffer = this.ensureBuffer();

        if (hasChanged(oldProps, newProps, "enableUndo") && newProps.enableUndo !== undefined) {
            buffer.setEnableUndo(newProps.enableUndo);
        }

        const signalHandlersChanged =
            hasChanged(oldProps, newProps, "onBufferChanged") ||
            hasChanged(oldProps, newProps, "onTextInserted") ||
            hasChanged(oldProps, newProps, "onTextDeleted") ||
            hasChanged(oldProps, newProps, "onCanUndoChanged") ||
            hasChanged(oldProps, newProps, "onCanRedoChanged");

        if (signalHandlersChanged) {
            this.setSignalHandlersChanged(newProps);
        }
    }

    private setSignalHandlersChanged(callbacks: BufferCallbackProps): void {
        if (!this.buffer) return;

        const buffer = this.buffer;
        const { onBufferChanged, onTextInserted, onTextDeleted, onCanUndoChanged, onCanRedoChanged } = callbacks;

        this.owner.signalStore.set(
            this.owner,
            buffer,
            "changed",
            onBufferChanged ? () => onBufferChanged(buffer) : null,
        );

        this.owner.signalStore.set(
            this.owner,
            buffer,
            "insert-text",
            onTextInserted
                ? (location: Gtk.TextIter, text: string) => onTextInserted(buffer, location.getOffset(), text)
                : null,
        );

        this.owner.signalStore.set(
            this.owner,
            buffer,
            "delete-range",
            onTextDeleted
                ? (start: Gtk.TextIter, end: Gtk.TextIter) => onTextDeleted(buffer, start.getOffset(), end.getOffset())
                : null,
        );

        this.owner.signalStore.set(
            this.owner,
            buffer,
            "notify::can-undo",
            onCanUndoChanged ? () => onCanUndoChanged(buffer.getCanUndo()) : null,
        );

        this.owner.signalStore.set(
            this.owner,
            buffer,
            "notify::can-redo",
            onCanRedoChanged ? () => onCanRedoChanged(buffer.getCanRedo()) : null,
        );
    }

    isTextContentChild(child: Node): child is TextContentChild {
        return (
            child instanceof TextSegmentNode ||
            child instanceof TextTagNode ||
            child instanceof TextAnchorNode ||
            child instanceof TextPaintableNode
        );
    }

    appendChild(child: TextContentChild): void {
        const buffer = this.ensureBuffer();

        if (this.initialMount && !this.irreversibleStarted) {
            buffer.beginIrreversibleAction();
            this.irreversibleStarted = true;
        }

        const wasMoved = this.textChildren.indexOf(child) !== -1;
        if (wasMoved) {
            const existingIndex = this.textChildren.indexOf(child);
            const oldOffset = child.getBufferOffset();
            const oldLength = child.getLength();

            this.textChildren.splice(existingIndex, 1);

            if (oldLength > 0) {
                this.deleteTextAtRange(oldOffset, oldOffset + oldLength);
            }

            this.updateChildOffsets(existingIndex);
        }

        const offset = this.getTotalLength();

        this.textChildren.push(child);
        child.setBufferOffset(offset);

        if (child instanceof TextSegmentNode) {
            this.insertTextAtOffset(child.getText(), offset);
        } else if (child instanceof TextTagNode) {
            const text = child.getText();
            this.insertTextAtOffset(text, offset);
            if (!child.hasBuffer()) {
                child.setBuffer(buffer);
            }
            this.setupEmbeddedObjects(child);
        } else if (child instanceof TextAnchorNode) {
            child.setTextViewAndBuffer(this.container, buffer);
        } else if (child instanceof TextPaintableNode) {
            child.setTextViewAndBuffer(this.container, buffer);
        }

        if (wasMoved) {
            this.updateChildOffsets(0);
            this.reapplyTagsFromOffset(0);
        }
    }

    insertBefore(child: TextContentChild, before: TextContentChild): void {
        const buffer = this.ensureBuffer();

        if (this.initialMount && !this.irreversibleStarted) {
            buffer.beginIrreversibleAction();
            this.irreversibleStarted = true;
        }

        const existingIndex = this.textChildren.indexOf(child);
        if (existingIndex !== -1) {
            const oldOffset = child.getBufferOffset();
            const oldLength = child.getLength();

            this.textChildren.splice(existingIndex, 1);

            if (oldLength > 0) {
                this.deleteTextAtRange(oldOffset, oldOffset + oldLength);
            }

            this.updateChildOffsets(existingIndex);
        }

        const beforeIndex = this.textChildren.indexOf(before);
        const insertIndex = beforeIndex !== -1 ? beforeIndex : this.textChildren.length;

        let offset = 0;
        for (let i = 0; i < insertIndex; i++) {
            const c = this.textChildren[i];
            if (c) offset += c.getLength();
        }

        this.textChildren.splice(insertIndex, 0, child);
        child.setBufferOffset(offset);

        if (child instanceof TextSegmentNode) {
            this.insertTextAtOffset(child.getText(), offset);
        } else if (child instanceof TextTagNode) {
            const text = child.getText();
            this.insertTextAtOffset(text, offset);
            if (!child.hasBuffer()) {
                child.setBuffer(buffer);
            }
            this.setupEmbeddedObjects(child);
        } else if (child instanceof TextAnchorNode) {
            child.setTextViewAndBuffer(this.container, buffer);
        } else if (child instanceof TextPaintableNode) {
            child.setTextViewAndBuffer(this.container, buffer);
        }

        this.updateChildOffsets(0);
        this.reapplyTagsFromOffset(0);
    }

    removeChild(child: TextContentChild): void {
        const index = this.textChildren.indexOf(child);
        if (index === -1) return;

        const offset = child.getBufferOffset();
        const length = child.getLength();

        this.textChildren.splice(index, 1);

        if (this.buffer && length > 0) {
            this.deleteTextAtRange(offset, offset + length);
        }

        this.updateChildOffsets(index);
        this.reapplyTagsFromOffset(offset);
    }

    private setupEmbeddedObjects(tag: TextTagNode): void {
        if (!this.buffer) return;

        for (const child of tag.children) {
            if (child instanceof TextPaintableNode || child instanceof TextAnchorNode) {
                this.deleteTextAtRange(child.getBufferOffset(), child.getBufferOffset() + 1);
                child.setTextViewAndBuffer(this.container, this.buffer);
            } else if (child instanceof TextTagNode) {
                this.setupEmbeddedObjects(child);
            }
        }

        tag.reapplyTag();
    }

    private getTotalLength(): number {
        let length = 0;
        for (const child of this.textChildren) {
            length += child.getLength();
        }
        return length;
    }

    private insertTextAtOffset(text: string, offset: number): void {
        const buffer = this.buffer;
        if (!buffer || text.length === 0) return;

        const iter = new Gtk.TextIter();
        buffer.getIterAtOffset(iter, offset);
        buffer.insert(iter, text, -1);
    }

    private deleteTextAtRange(start: number, end: number): void {
        const buffer = this.buffer;
        if (!buffer || start >= end) return;

        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();

        buffer.getIterAtOffset(startIter, start);
        buffer.getIterAtOffset(endIter, end);
        buffer.delete(startIter, endIter);
    }

    private updateChildOffsets(startIndex: number): void {
        let offset = 0;

        for (let i = 0; i < startIndex; i++) {
            const child = this.textChildren[i];
            if (child) offset += child.getLength();
        }

        for (let i = startIndex; i < this.textChildren.length; i++) {
            const child = this.textChildren[i];
            if (child) {
                child.setBufferOffset(offset);
                offset += child.getLength();
            }
        }
    }

    private reapplyAllTagsRecursive(children: TextContentChild[]): void {
        for (const child of children) {
            if (child instanceof TextTagNode) {
                child.reapplyTag();
                this.reapplyAllTagsRecursive(child.children);
            }
        }
    }

    private reapplyTagsFromOffset(fromOffset: number): void {
        for (const child of this.textChildren) {
            if (child instanceof TextTagNode) {
                if (child.getBufferOffset() + child.getLength() > fromOffset) {
                    child.reapplyTag();
                    this.reapplyAllTagsRecursive(child.children);
                }
            }
        }
    }

    private findDirectChildContaining(offset: number): number {
        for (let i = 0; i < this.textChildren.length; i++) {
            const child = this.textChildren[i];
            if (child) {
                const start = child.getBufferOffset();
                const end = start + child.getLength();
                if (offset >= start && offset <= end) {
                    return i;
                }
            }
        }
        return -1;
    }

    onChildInserted(child: TextContentChild): void {
        if (!this.buffer) return;

        if (child instanceof TextPaintableNode) {
            child.setTextViewAndBuffer(this.container, this.buffer);
        } else if (child instanceof TextAnchorNode) {
            child.setTextViewAndBuffer(this.container, this.buffer);
        } else {
            const text = child.getText();
            if (text.length > 0) {
                this.insertTextAtOffset(text, child.getBufferOffset());
            }
            if (child instanceof TextTagNode) {
                this.setupEmbeddedObjects(child);
            }
        }

        const containingIndex = this.findDirectChildContaining(child.getBufferOffset());
        if (containingIndex !== -1) {
            this.updateChildOffsets(containingIndex + 1);
        }

        this.reapplyTagsFromOffset(child.getBufferOffset());
    }

    onChildRemoved(child: TextContentChild): void {
        if (!this.buffer) return;

        const offset = child.getBufferOffset();
        const length = child.getLength();

        if (length > 0) {
            this.deleteTextAtRange(offset, offset + length);
        }

        const containingIndex = this.findDirectChildContaining(offset);
        if (containingIndex !== -1) {
            this.updateChildOffsets(containingIndex + 1);
        }

        this.reapplyTagsFromOffset(offset);
    }

    onChildTextChanged(child: TextSegmentNode, oldLength: number, _newLength: number): void {
        if (!this.buffer) return;

        this.owner.signalStore.blockAll();
        try {
            const offset = child.getBufferOffset();

            this.deleteTextAtRange(offset, offset + oldLength);
            this.insertTextAtOffset(child.getText(), offset);

            const containingIndex = this.findDirectChildContaining(offset);
            if (containingIndex !== -1) {
                this.updateChildOffsets(containingIndex + 1);
            }

            this.reapplyTagsFromOffset(offset);
        } finally {
            this.owner.signalStore.unblockAll();
        }
    }
}
