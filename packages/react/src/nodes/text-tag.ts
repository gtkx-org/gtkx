import * as Gtk from "@gtkx/ffi/gtk";
import type { TextTagProps } from "../jsx.js";
import type { Node } from "../node.js";
import { hasChanged } from "./internal/props.js";
import { TextAnchorNode } from "./text-anchor.js";
import type { TextContentChild, TextContentParent } from "./text-content.js";
import { TextPaintableNode } from "./text-paintable.js";
import { isTextContentParent, TextSegmentNode } from "./text-segment.js";
import { VirtualNode } from "./virtual.js";

const STYLE_PROPS: Partial<Record<keyof TextTagProps, keyof Gtk.TextTag | string>> = {
    background: "setBackground",
    backgroundFullHeight: "backgroundFullHeight",
    foreground: "setForeground",
    family: "family",
    font: "font",
    sizePoints: "sizePoints",
    size: "size",
    scale: "scale",
    weight: "weight",
    style: "style",
    stretch: "stretch",
    variant: "variant",
    strikethrough: "strikethrough",
    underline: "underline",
    overline: "overline",
    rise: "rise",
    letterSpacing: "letterSpacing",
    lineHeight: "lineHeight",
    leftMargin: "leftMargin",
    rightMargin: "rightMargin",
    indent: "indent",
    pixelsAboveLines: "pixelsAboveLines",
    pixelsBelowLines: "pixelsBelowLines",
    pixelsInsideWrap: "pixelsInsideWrap",
    justification: "justification",
    direction: "direction",
    wrapMode: "wrapMode",
    editable: "editable",
    invisible: "invisible",
    allowBreaks: "allowBreaks",
    insertHyphens: "insertHyphens",
    fallback: "fallback",
    accumulativeMargin: "accumulativeMargin",
    paragraphBackground: "setParagraphBackground",
    showSpaces: "showSpaces",
    textTransform: "textTransform",
    fontFeatures: "fontFeatures",
    language: "language",
};

type TextTagParent = Node & TextContentParent;

export class TextTagNode
    extends VirtualNode<TextTagProps, TextTagParent, TextContentChild>
    implements TextContentParent
{
    private buffer: Gtk.TextBuffer | null = null;
    private tag: Gtk.TextTag | null = null;

    private bufferOffset = 0;

    public getBufferOffset(): number {
        return this.bufferOffset;
    }

    public setBufferOffset(offset: number): void {
        this.bufferOffset = offset;
    }

    public override isValidChild(child: Node): boolean {
        return this.isTextContentChild(child);
    }

    public override isValidParent(parent: Node): boolean {
        return isTextContentParent(parent);
    }

    public override appendChild(child: TextContentChild): void {
        const index = this.children.length;
        super.appendChild(child);

        if (child instanceof TextTagNode && this.buffer) {
            child.setBuffer(this.buffer);
        }

        this.updateChildOffsets(index);
        this.parent?.onChildInserted(child);
    }

    public override removeChild(child: TextContentChild): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.setParent(null);
            this.updateChildOffsets(index);
            this.parent?.onChildRemoved(child);
            return;
        }
        super.removeChild(child);
    }

    public override insertBefore(child: TextContentChild, before: TextContentChild): void {
        const beforeIndex = this.children.indexOf(before);
        const insertIndex = beforeIndex !== -1 ? beforeIndex : this.children.length;

        super.insertBefore(child, before);

        if (child instanceof TextTagNode && this.buffer) {
            child.setBuffer(this.buffer);
        }

        this.updateChildOffsets(insertIndex);
        this.parent?.onChildInserted(child);
    }

    public override commitUpdate(oldProps: TextTagProps | null, newProps: TextTagProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyOwnProps(oldProps, newProps);
    }

    public override detachDeletedInstance(): void {
        if (this.buffer && this.tag) {
            this.removeTagFromBuffer();
            const tagTable = this.buffer.getTagTable();
            tagTable.remove(this.tag);
        }
        this.tag = null;
        this.buffer = null;
        super.detachDeletedInstance();
    }

    public setBuffer(buffer: Gtk.TextBuffer): void {
        this.buffer = buffer;
        this.updateChildOffsets(0);
        this.setupTag();

        for (const child of this.children) {
            if (child instanceof TextTagNode) {
                child.setBuffer(buffer);
            }
        }
    }

    public hasBuffer(): boolean {
        return this.buffer !== null;
    }

    public getText(): string {
        let text = "";
        for (const child of this.children) {
            text += child.getText();
        }
        return text;
    }

    public getLength(): number {
        let length = 0;
        for (const child of this.children) {
            length += child.getLength();
        }
        return length;
    }

    public reapplyTag(): void {
        if (!this.buffer || !this.tag) return;
        this.removeTagFromBuffer();
        this.applyTagToRange();
    }

    public onChildInserted(child: TextContentChild): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.updateChildOffsets(index);
        }

        this.parent?.onChildInserted(child);
    }

    public onChildRemoved(child: TextContentChild): void {
        this.parent?.onChildRemoved(child);
    }

    public onChildTextChanged(child: TextSegmentNode, oldLength: number, newLength: number): void {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.updateChildOffsets(index + 1);
        }

        this.parent?.onChildTextChanged(child, oldLength, newLength);
    }

    private setupTag(): void {
        if (!this.buffer) return;

        const tagTable = this.buffer.getTagTable();
        this.tag = new Gtk.TextTag(this.props.id);

        this.applyStyleProps(null, this.props);
        tagTable.add(this.tag);

        if (this.props.priority !== undefined) {
            this.tag.setPriority(this.props.priority);
        }

        this.applyTagToRange();
    }

    private applyOwnProps(oldProps: TextTagProps | null, newProps: TextTagProps): void {
        if (oldProps && oldProps.id !== newProps.id) {
            throw new Error("TextTag id cannot be changed after creation");
        }

        if (!this.tag) return;

        this.applyStyleProps(oldProps, newProps);

        if (hasChanged(oldProps, newProps, "priority") && newProps.priority !== undefined) {
            this.tag.setPriority(newProps.priority);
        }
    }

    private applyStyleProps(oldProps: TextTagProps | null, newProps: TextTagProps): void {
        if (!this.tag) return;
        for (const prop of Object.keys(STYLE_PROPS) as (keyof TextTagProps)[]) {
            if (hasChanged(oldProps, newProps, prop)) {
                const value = newProps[prop];
                const target = STYLE_PROPS[prop];
                if (value !== undefined && target) {
                    const tag = this.tag as unknown as Record<string, unknown>;
                    const member = tag[target];
                    if (typeof member === "function") {
                        (member as (v: unknown) => void).call(this.tag, value);
                    } else {
                        tag[target] = value;
                    }
                }
            }
        }
    }

    private applyTagToRange(): void {
        const buffer = this.buffer;
        const tag = this.tag;
        if (!buffer || !tag) return;

        const length = this.getLength();
        if (length === 0) return;

        const startIter = buffer.getIterAtOffset(this.bufferOffset);
        const endIter = buffer.getIterAtOffset(this.bufferOffset + length);

        buffer.applyTag(tag, startIter, endIter);
    }

    private removeTagFromBuffer(): void {
        const buffer = this.buffer;
        const tag = this.tag;
        if (!buffer || !tag) return;

        const startIter = buffer.getStartIter();
        const endIter = buffer.getEndIter();

        buffer.removeTag(tag, startIter, endIter);
    }

    private updateChildOffsets(startIndex: number): void {
        let offset = this.bufferOffset;

        for (let i = 0; i < startIndex; i++) {
            const child = this.children[i];
            if (child) offset += child.getLength();
        }

        for (let i = startIndex; i < this.children.length; i++) {
            const child = this.children[i];
            if (child) {
                child.setBufferOffset(offset);
                offset += child.getLength();
            }
        }
    }

    private isTextContentChild(child: Node): child is TextContentChild {
        return (
            child instanceof TextSegmentNode ||
            child instanceof TextTagNode ||
            child instanceof TextAnchorNode ||
            child instanceof TextPaintableNode
        );
    }
}
