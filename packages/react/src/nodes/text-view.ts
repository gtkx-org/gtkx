import * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Props } from "../types.js";
import { TextBufferController } from "./internal/text-buffer-controller.js";
import { filterProps } from "./internal/utils.js";
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

export class TextViewNode extends WidgetNode<Gtk.TextView, TextViewProps> implements TextContentParent {
    protected bufferController: TextBufferController | null = null;

    protected ensureBufferController(): TextBufferController {
        if (!this.bufferController) {
            this.bufferController = this.createBufferController();
        }
        return this.bufferController;
    }

    protected createBufferController(): TextBufferController {
        return new TextBufferController(this, this.container, () => new Gtk.TextBuffer());
    }

    protected override applyUpdate(oldProps: TextViewProps | null, newProps: TextViewProps): void {
        super.applyUpdate(
            oldProps ? (filterProps(oldProps, OWN_PROPS) as TextViewProps) : null,
            filterProps(newProps, OWN_PROPS) as TextViewProps,
        );
        this.applyOwnProps(oldProps, newProps);
    }

    protected applyOwnProps(oldProps: TextViewProps | null, newProps: TextViewProps): void {
        this.ensureBufferController().applyOwnProps(oldProps, newProps);
    }

    public override appendChild(child: Node): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.appendChild(child as TextContentChild);
            return;
        }
        super.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.insertBefore(child as TextContentChild, before as TextContentChild);
            return;
        }
        super.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        const controller = this.ensureBufferController();
        if (controller.isTextContentChild(child)) {
            controller.removeChild(child as TextContentChild);
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
