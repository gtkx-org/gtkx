import * as Gtk from "@gtkx/ffi/gtk";
import type { GtkTextViewProps } from "../jsx.js";
import type { Node } from "../node.js";
import { filterProps } from "./internal/props.js";
import { TextBufferController } from "./internal/text-buffer-controller.js";
import { SlotNode } from "./slot.js";
import { TextAnchorNode } from "./text-anchor.js";
import type { TextContentChild, TextContentParent } from "./text-content.js";
import { TextPaintableNode } from "./text-paintable.js";
import { TextSegmentNode } from "./text-segment.js";
import { TextTagNode } from "./text-tag.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = [
    "enableUndo",
    "onBufferChanged",
    "onTextInserted",
    "onTextDeleted",
    "onCanUndoChanged",
    "onCanRedoChanged",
] as const;

type TextViewProps = Pick<GtkTextViewProps, (typeof OWN_PROPS)[number]>;
type TextViewChild = TextContentChild | SlotNode | WidgetNode;

export class TextViewNode extends WidgetNode<Gtk.TextView, TextViewProps, TextViewChild> implements TextContentParent {
    protected bufferController: TextBufferController | null = null;

    public override isValidChild(child: Node): boolean {
        return (
            child instanceof TextSegmentNode ||
            child instanceof TextTagNode ||
            child instanceof TextAnchorNode ||
            child instanceof TextPaintableNode ||
            child instanceof SlotNode ||
            child instanceof WidgetNode
        );
    }

    protected ensureBufferController(): TextBufferController {
        if (!this.bufferController) {
            this.bufferController = this.createBufferController();
        }
        return this.bufferController;
    }

    protected createBufferController(): TextBufferController {
        return new TextBufferController(this, this.container, () => new Gtk.TextBuffer());
    }

    public override commitUpdate(oldProps: TextViewProps | null, newProps: TextViewProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.ensureBufferController().applyOwnProps(oldProps, newProps);
    }

    public override appendChild(child: TextViewChild): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.appendChild(child);
        }
        super.appendChild(child);
    }

    public override insertBefore(child: TextViewChild, before: TextViewChild): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.insertBefore(child, before as TextContentChild);
        }
        super.insertBefore(child, before);
    }

    public override removeChild(child: TextViewChild): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.removeChild(child);
        }
        super.removeChild(child);
    }

    public onChildInserted(child: TextContentChild): void {
        this.ensureBufferController().onChildInserted(child);
    }

    public onChildRemoved(child: TextContentChild): void {
        this.ensureBufferController().onChildRemoved(child);
    }

    public onChildTextChanged(child: TextSegmentNode, oldLength: number, newLength: number): void {
        this.ensureBufferController().onChildTextChanged(child, oldLength, newLength);
    }
}
