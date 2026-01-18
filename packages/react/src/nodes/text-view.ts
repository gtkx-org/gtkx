import { batch } from "@gtkx/ffi";
import * as Gtk from "@gtkx/ffi/gtk";
import * as GtkSource from "@gtkx/ffi/gtksource";
import type { Node } from "../node.js";
import { registerNodeClass } from "../registry.js";
import type { Container, ContainerClass, Props } from "../types.js";
import { signalStore } from "./internal/signal-store.js";
import { isContainerType } from "./internal/utils.js";
import { TextAnchorNode } from "./text-anchor.js";
import type { TextContentChild, TextContentParent } from "./text-content.js";
import { TextSegmentNode } from "./text-segment.js";
import { TextTagNode } from "./text-tag.js";
import { WidgetNode } from "./widget.js";

type TextViewProps = Props & {
    enableUndo?: boolean;
    onTextChanged?: ((text: string) => void) | null;
    onCanUndoChanged?: ((canUndo: boolean) => void) | null;
    onCanRedoChanged?: ((canRedo: boolean) => void) | null;
};

export class TextViewNode extends WidgetNode<Gtk.TextView, TextViewProps> implements TextContentParent {
    public static override priority = 1;

    protected buffer?: Gtk.TextBuffer;
    protected textChildren: TextContentChild[] = [];

    public static override matches(_type: string, containerOrClass?: Container | ContainerClass | null): boolean {
        if (isContainerType(GtkSource.View, containerOrClass)) return false;
        return isContainerType(Gtk.TextView, containerOrClass);
    }

    public override updateProps(oldProps: TextViewProps | null, newProps: TextViewProps): void {
        super.updateProps(oldProps, newProps);
        this.updateBufferProps(oldProps, newProps);
    }

    protected ensureBuffer(): Gtk.TextBuffer {
        if (!this.buffer) {
            this.buffer = this.createBuffer();
            this.container.setBuffer(this.buffer);
        }
        return this.buffer;
    }

    protected createBuffer(): Gtk.TextBuffer {
        return new Gtk.TextBuffer();
    }

    private updateBufferProps(oldProps: TextViewProps | null, newProps: TextViewProps): void {
        const hasBufferProps =
            newProps.enableUndo !== undefined ||
            newProps.onTextChanged !== undefined ||
            newProps.onCanUndoChanged !== undefined ||
            newProps.onCanRedoChanged !== undefined;

        if (!hasBufferProps && this.textChildren.length === 0) {
            return;
        }

        const buffer = this.ensureBuffer();

        if (!oldProps || oldProps.enableUndo !== newProps.enableUndo) {
            if (newProps.enableUndo !== undefined) {
                buffer.setEnableUndo(newProps.enableUndo);
            }
        }

        if (
            !oldProps ||
            oldProps.onTextChanged !== newProps.onTextChanged ||
            oldProps.onCanUndoChanged !== newProps.onCanUndoChanged ||
            oldProps.onCanRedoChanged !== newProps.onCanRedoChanged
        ) {
            this.updateSignalHandlers(newProps);
        }
    }

    private updateSignalHandlers(props: TextViewProps): void {
        if (!this.buffer) return;

        const buffer = this.buffer;
        const { onTextChanged, onCanUndoChanged, onCanRedoChanged } = props;

        signalStore.set(this, buffer, "changed", onTextChanged ? () => onTextChanged(this.getBufferText()) : null);

        signalStore.set(
            this,
            buffer,
            "notify::can-undo",
            onCanUndoChanged ? () => onCanUndoChanged(buffer.getCanUndo()) : null,
        );

        signalStore.set(
            this,
            buffer,
            "notify::can-redo",
            onCanRedoChanged ? () => onCanRedoChanged(buffer.getCanRedo()) : null,
        );
    }

    protected getBufferText(): string {
        const buffer = this.buffer;
        if (!buffer) return "";

        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();

        batch(() => {
            buffer.getStartIter(startIter);
            buffer.getEndIter(endIter);
        });

        return buffer.getText(startIter, endIter, true);
    }

    public override appendChild(child: Node): void {
        if (this.isTextContentChild(child)) {
            this.appendTextChild(child as TextContentChild);
            return;
        }
        super.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (this.isTextContentChild(child)) {
            this.insertTextChildBefore(child as TextContentChild, before as TextContentChild);
            return;
        }
        super.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (this.isTextContentChild(child)) {
            this.removeTextChild(child as TextContentChild);
            return;
        }
        super.removeChild(child);
    }

    private isTextContentChild(child: Node): child is TextContentChild {
        return child instanceof TextSegmentNode || child instanceof TextTagNode || child instanceof TextAnchorNode;
    }

    private appendTextChild(child: TextContentChild): void {
        const buffer = this.ensureBuffer();

        const wasMoved = this.textChildren.indexOf(child) !== -1;
        if (wasMoved) {
            const existingIndex = this.textChildren.indexOf(child);
            const oldOffset = child.bufferOffset;
            const oldLength = child.getLength();

            this.textChildren.splice(existingIndex, 1);

            if (oldLength > 0) {
                this.deleteTextAtRange(oldOffset, oldOffset + oldLength);
            }

            this.updateChildOffsets(existingIndex);
        }

        const offset = this.getTotalLength();

        this.textChildren.push(child);
        child.bufferOffset = offset;
        this.setChildParent(child);

        if (child instanceof TextSegmentNode) {
            this.insertTextAtOffset(child.getText(), offset);
        } else if (child instanceof TextTagNode) {
            const text = child.getText();
            this.insertTextAtOffset(text, offset);
            if (!child.hasBuffer()) {
                child.setBuffer(buffer);
            }
        } else if (child instanceof TextAnchorNode) {
            child.setTextViewAndBuffer(this.container, buffer);
        }

        if (wasMoved) {
            this.updateChildOffsets(0);
            this.reapplyTagsFromOffset(0);
        }
    }

    private insertTextChildBefore(child: TextContentChild, before: TextContentChild): void {
        const buffer = this.ensureBuffer();

        const existingIndex = this.textChildren.indexOf(child);
        if (existingIndex !== -1) {
            const oldOffset = child.bufferOffset;
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
        child.bufferOffset = offset;
        this.setChildParent(child);

        if (child instanceof TextSegmentNode) {
            this.insertTextAtOffset(child.getText(), offset);
        } else if (child instanceof TextTagNode) {
            const text = child.getText();
            this.insertTextAtOffset(text, offset);
            if (!child.hasBuffer()) {
                child.setBuffer(buffer);
            }
        } else if (child instanceof TextAnchorNode) {
            child.setTextViewAndBuffer(this.container, buffer);
        }

        this.updateChildOffsets(0);
        this.reapplyTagsFromOffset(0);
    }

    private removeTextChild(child: TextContentChild): void {
        const index = this.textChildren.indexOf(child);
        if (index === -1) return;

        const offset = child.bufferOffset;
        const length = child.getLength();

        this.textChildren.splice(index, 1);

        if (this.buffer && length > 0) {
            this.deleteTextAtRange(offset, offset + length);
        }

        this.updateChildOffsets(index);
        this.reapplyTagsFromOffset(offset);
    }

    private setChildParent(child: TextContentChild): void {
        if (child instanceof TextSegmentNode || child instanceof TextTagNode) {
            child.setParent(this);
        }
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
        batch(() => {
            buffer.getIterAtOffset(iter, offset);
            buffer.insert(iter, text, text.length);
        });
    }

    private deleteTextAtRange(start: number, end: number): void {
        const buffer = this.buffer;
        if (!buffer || start >= end) return;

        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();

        batch(() => {
            buffer.getIterAtOffset(startIter, start);
            buffer.getIterAtOffset(endIter, end);
            buffer.delete(startIter, endIter);
        });
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
                child.bufferOffset = offset;
                offset += child.getLength();
            }
        }
    }

    private reapplyAllTagsRecursive(children: TextContentChild[]): void {
        for (const child of children) {
            if (child instanceof TextTagNode) {
                child.reapplyTag();
                this.reapplyAllTagsRecursive(child.getChildren());
            }
        }
    }

    private reapplyTagsFromOffset(fromOffset: number): void {
        for (const child of this.textChildren) {
            if (child instanceof TextTagNode) {
                if (child.bufferOffset >= fromOffset) {
                    child.reapplyTag();
                    this.reapplyAllTagsRecursive(child.getChildren());
                } else if (child.bufferOffset + child.getLength() > fromOffset) {
                    child.reapplyTag();
                    this.reapplyAllTagsRecursive(child.getChildren());
                }
            }
        }
    }

    private findDirectChildContaining(offset: number): number {
        for (let i = 0; i < this.textChildren.length; i++) {
            const child = this.textChildren[i];
            if (child) {
                const start = child.bufferOffset;
                const end = start + child.getLength();
                if (offset >= start && offset <= end) {
                    return i;
                }
            }
        }
        return -1;
    }

    public onChildInserted(child: TextContentChild): void {
        if (!this.buffer) return;

        const text = child.getText();
        if (text.length > 0) {
            this.insertTextAtOffset(text, child.bufferOffset);
        }

        const containingIndex = this.findDirectChildContaining(child.bufferOffset);
        if (containingIndex !== -1) {
            this.updateChildOffsets(containingIndex + 1);
        }

        this.reapplyTagsFromOffset(child.bufferOffset);
    }

    public onChildRemoved(child: TextContentChild): void {
        if (!this.buffer) return;

        const offset = child.bufferOffset;
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

    public onChildTextChanged(child: TextSegmentNode, oldLength: number, _newLength: number): void {
        if (!this.buffer) return;

        const offset = child.bufferOffset;

        this.deleteTextAtRange(offset, offset + oldLength);
        this.insertTextAtOffset(child.getText(), offset);

        const containingIndex = this.findDirectChildContaining(offset);
        if (containingIndex !== -1) {
            this.updateChildOffsets(containingIndex + 1);
        }

        this.reapplyTagsFromOffset(offset);
    }
}

registerNodeClass(TextViewNode);
