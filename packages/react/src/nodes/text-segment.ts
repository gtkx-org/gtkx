import type { TextSegmentProps } from "../jsx.js";
import type { Node } from "../node.js";
import { BufferOffsetNode } from "./internal/buffer-offset-node.js";
import { hasChanged } from "./internal/props.js";
import type { TextContentParent } from "./text-content.js";

type TextSegmentParent = Node & TextContentParent;

export class TextSegmentNode extends BufferOffsetNode<TextSegmentProps, TextSegmentParent, never> {
    public override isValidChild(_child: Node): boolean {
        return false;
    }

    public override isValidParent(parent: Node): boolean {
        return isTextContentParent(parent);
    }

    public getText(): string {
        return this.props.text;
    }

    public getLength(): number {
        return this.props.text.length;
    }

    public override commitUpdate(oldProps: TextSegmentProps | null, newProps: TextSegmentProps): void {
        const oldText = oldProps?.text ?? "";
        const newText = newProps.text;

        super.commitUpdate(oldProps, newProps);

        if (hasChanged(oldProps, newProps, "text") && this.parent) {
            this.parent.onChildTextChanged(this, oldText.length, newText.length);
        }
    }
}

export function isTextContentParent(node: Node): node is TextSegmentParent {
    const candidate = node as unknown as TextContentParent;
    return (
        typeof candidate.onChildInserted === "function" &&
        typeof candidate.onChildRemoved === "function" &&
        typeof candidate.onChildTextChanged === "function"
    );
}
