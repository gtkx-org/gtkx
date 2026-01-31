import * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import { TextBufferController } from "./internal/text-buffer-controller.js";
import type { SlotNode } from "./slot.js";
import type { TextContentChild, TextContentParent } from "./text-content.js";
import type { TextSegmentNode } from "./text-segment.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = [
    "enableUndo",
    "onBufferChanged",
    "onTextInserted",
    "onTextDeleted",
    "onCanUndoChanged",
    "onCanRedoChanged",
] as const;

type TextViewProps = Props & {
    enableUndo?: boolean;
    onBufferChanged?: ((buffer: Gtk.TextBuffer) => void) | null;
    onTextInserted?: ((buffer: Gtk.TextBuffer, offset: number, text: string) => void) | null;
    onTextDeleted?: ((buffer: Gtk.TextBuffer, startOffset: number, endOffset: number) => void) | null;
    onCanUndoChanged?: ((canUndo: boolean) => void) | null;
    onCanRedoChanged?: ((canRedo: boolean) => void) | null;
};

type TextViewChild = TextContentChild | SlotNode | WidgetNode;

export class TextViewNode extends WidgetNode<Gtk.TextView, TextViewProps, TextViewChild> implements TextContentParent {
    protected override readonly excludedPropNames = OWN_PROPS;
    bufferController: TextBufferController | null = null;

    ensureBufferController(): TextBufferController {
        if (!this.bufferController) {
            this.bufferController = this.createBufferController();
        }
        return this.bufferController;
    }

    createBufferController(): TextBufferController {
        return new TextBufferController(this, this.container, () => new Gtk.TextBuffer());
    }

    public override commitUpdate(oldProps: TextViewProps | null, newProps: TextViewProps): void {
        super.commitUpdate(oldProps, newProps);
        this.ensureBufferController().applyOwnProps(oldProps, newProps);
    }

    public override appendChild(child: TextViewChild): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.appendChild(child);
            return;
        }
        super.appendChild(child);
    }

    public override insertBefore(child: TextViewChild, before: TextViewChild): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.insertBefore(child, before as TextContentChild);
            return;
        }
        super.insertBefore(child, before);
    }

    public override removeChild(child: TextViewChild): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.removeChild(child);
            return;
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
