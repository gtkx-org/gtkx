import * as Gtk from "@gtkx/ffi/gtk";
import type * as Pango from "@gtkx/ffi/pango";
import type { ReactNode } from "react";
import type { Node } from "../node.js";
import { applyStyleChanges, type TagStyleProps } from "./internal/text-tag-styles.js";
import { hasChanged } from "./internal/utils.js";
import { TextAnchorNode } from "./text-anchor.js";
import type { TextContentChild, TextContentParent } from "./text-content.js";
import { TextSegmentNode } from "./text-segment.js";
import { VirtualNode } from "./virtual.js";

/**
 * Props for the TextTag virtual element.
 *
 * Used to declaratively define and apply text formatting to content within a TextBuffer.
 *
 * @example
 * ```tsx
 * <GtkTextView>
 *     <x.TextBuffer>
 *         Hello <x.TextTag id="bold" weight={Pango.Weight.BOLD}>bold</x.TextTag> world
 *     </x.TextBuffer>
 * </GtkTextView>
 * ```
 */
export type TextTagProps = {
    /** Unique identifier for this tag in the tag table */
    id: string;
    /** Priority of this tag (higher wins when multiple tags affect same property) */
    priority?: number;

    /** Background color as a string (e.g., "red", "#ff0000") */
    background?: string;
    /** Whether the background fills the entire line height */
    backgroundFullHeight?: boolean;
    /** Foreground (text) color as a string */
    foreground?: string;

    /** Font family name (e.g., "Sans", "Monospace") */
    family?: string;
    /** Font description string (e.g., "Sans Italic 12") */
    font?: string;
    /** Font size in points */
    sizePoints?: number;
    /** Font size in Pango units */
    size?: number;
    /** Font size scale factor relative to default */
    scale?: number;
    /** Font weight (use Pango.Weight constants) */
    weight?: Pango.Weight | number;
    /** Font style (use Pango.Style constants) */
    style?: Pango.Style;
    /** Font stretch (use Pango.Stretch constants) */
    stretch?: Pango.Stretch;
    /** Font variant (use Pango.Variant constants) */
    variant?: Pango.Variant;

    /** Whether to strike through the text */
    strikethrough?: boolean;
    /** Underline style (use Pango.Underline constants) */
    underline?: Pango.Underline;
    /** Overline style (use Pango.Overline constants) */
    overline?: Pango.Overline;

    /** Offset of text above baseline in Pango units (negative = below) */
    rise?: number;
    /** Extra spacing between characters in Pango units */
    letterSpacing?: number;
    /** Factor to scale line height by */
    lineHeight?: number;

    /** Left margin in pixels */
    leftMargin?: number;
    /** Right margin in pixels */
    rightMargin?: number;
    /** Paragraph indent in pixels (negative = hanging) */
    indent?: number;
    /** Pixels of blank space above paragraphs */
    pixelsAboveLines?: number;
    /** Pixels of blank space below paragraphs */
    pixelsBelowLines?: number;
    /** Pixels of blank space between wrapped lines */
    pixelsInsideWrap?: number;

    /** Text justification */
    justification?: Gtk.Justification;
    /** Text direction */
    direction?: Gtk.TextDirection;
    /** Wrap mode for line breaks */
    wrapMode?: Gtk.WrapMode;

    /** Whether the text can be modified */
    editable?: boolean;
    /** Whether the text is invisible/hidden */
    invisible?: boolean;
    /** Whether breaks are allowed */
    allowBreaks?: boolean;
    /** Whether to insert hyphens at breaks */
    insertHyphens?: boolean;
    /** Whether font fallback is enabled */
    fallback?: boolean;
    /** Whether margins accumulate */
    accumulativeMargin?: boolean;

    /** Paragraph background color as a string */
    paragraphBackground?: string;
    /** How to render invisible characters */
    showSpaces?: Pango.ShowFlags;
    /** How to transform text for display */
    textTransform?: Pango.TextTransform;

    /** OpenType font features as a string */
    fontFeatures?: string;
    /** Language code (e.g., "en-US") */
    language?: string;

    /** Text content and nested TextTag children */
    children?: ReactNode;
};

export class TextTagNode extends VirtualNode<TextTagProps> implements TextContentParent {
    private buffer: Gtk.TextBuffer | null = null;
    private tag: Gtk.TextTag | null = null;
    private children: TextContentChild[] = [];
    private parent: TextContentParent | null = null;

    public bufferOffset = 0;

    public setParent(parent: TextContentParent): void {
        this.parent = parent;
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

    private applyStyleProps(oldProps: TagStyleProps | null, newProps: TagStyleProps): void {
        if (!this.tag) return;
        applyStyleChanges(this.tag, oldProps, newProps);
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

    public getChildren(): TextContentChild[] {
        return this.children;
    }

    private applyTagToRange(): void {
        const buffer = this.buffer;
        const tag = this.tag;
        if (!buffer || !tag) return;

        const length = this.getLength();
        if (length === 0) return;

        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();

        buffer.getIterAtOffset(startIter, this.bufferOffset);
        buffer.getIterAtOffset(endIter, this.bufferOffset + length);

        buffer.applyTag(tag, startIter, endIter);
    }

    private removeTagFromBuffer(): void {
        const buffer = this.buffer;
        const tag = this.tag;
        if (!buffer || !tag) return;

        const startIter = new Gtk.TextIter();
        const endIter = new Gtk.TextIter();

        buffer.getStartIter(startIter);
        buffer.getEndIter(endIter);

        buffer.removeTag(tag, startIter, endIter);
    }

    public reapplyTag(): void {
        if (!this.buffer || !this.tag) return;
        this.removeTagFromBuffer();
        this.applyTagToRange();
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
                child.bufferOffset = offset;
                offset += child.getLength();
            }
        }
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

    public override appendChild(child: Node): void {
        if (this.isTextContentChild(child)) {
            const index = this.children.length;
            this.children.push(child);
            this.setChildParent(child);

            if (child instanceof TextTagNode && this.buffer) {
                child.setBuffer(this.buffer);
            }

            this.updateChildOffsets(index);
            this.parent?.onChildInserted(child);
            return;
        }
        super.appendChild(child);
    }

    public override removeChild(child: Node): void {
        const index = this.children.indexOf(child as TextContentChild);
        if (index !== -1) {
            this.children.splice(index, 1);
            this.updateChildOffsets(index);
            this.parent?.onChildRemoved(child as TextContentChild);
            return;
        }
        super.removeChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (this.isTextContentChild(child)) {
            const beforeIndex = this.children.indexOf(before as TextContentChild);
            const insertIndex = beforeIndex !== -1 ? beforeIndex : this.children.length;

            this.children.splice(insertIndex, 0, child);
            this.setChildParent(child);

            if (child instanceof TextTagNode && this.buffer) {
                child.setBuffer(this.buffer);
            }

            this.updateChildOffsets(insertIndex);
            this.parent?.onChildInserted(child);
            return;
        }
        super.insertBefore(child, before);
    }

    private isTextContentChild(child: Node): child is TextContentChild {
        return child instanceof TextSegmentNode || child instanceof TextTagNode || child instanceof TextAnchorNode;
    }

    private setChildParent(child: TextContentChild): void {
        if (child instanceof TextSegmentNode || child instanceof TextTagNode) {
            child.setParent(this);
        }
    }

    public override updateProps(oldProps: TextTagProps | null, newProps: TextTagProps): void {
        super.updateProps(oldProps, newProps);

        if (oldProps && oldProps.id !== newProps.id) {
            throw new Error("TextTag id cannot be changed after creation");
        }

        if (this.tag) {
            this.applyStyleProps(oldProps, newProps);

            if (hasChanged(oldProps, newProps, "priority") && newProps.priority !== undefined) {
                this.tag.setPriority(newProps.priority);
            }
        }
    }

    public override unmount(): void {
        if (this.buffer && this.tag) {
            this.removeTagFromBuffer();
            const tagTable = this.buffer.getTagTable();
            tagTable.remove(this.tag);
        }
        this.tag = null;
        this.buffer = null;
        this.children = [];
        super.unmount();
    }
}
