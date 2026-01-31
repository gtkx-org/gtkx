import { hasChanged } from "./internal/utils.js";
import type { TextContentParent } from "./text-content.js";
import { VirtualNode } from "./virtual.js";

export type TextSegmentProps = {
    text: string;
};

export class TextSegmentNode extends VirtualNode<TextSegmentProps> {
    private contentParent: TextContentParent | null = null;

    public bufferOffset = 0;

    public setParent(parent: TextContentParent): void {
        this.contentParent = parent;
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

        if (hasChanged(oldProps, newProps, "text") && this.contentParent) {
            this.contentParent.onChildTextChanged(this, oldText.length, newText.length);
        }
    }
}
