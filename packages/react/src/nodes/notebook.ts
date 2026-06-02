import type * as Gtk from "@gtkx/gi/gtk";
import type { Node } from "../node.js";
import type { Props } from "../types.js";
import { ContainerSlotNode } from "./container-slot.js";
import { EventControllerNode } from "./event-controller.js";
import { NotebookPageNode } from "./notebook-page.js";
import { SlotNode } from "./slot.js";
import { WidgetNode } from "./widget.js";

type NotebookChild = NotebookPageNode | EventControllerNode | SlotNode | ContainerSlotNode;

export class NotebookNode extends WidgetNode<Gtk.Notebook, Props, NotebookChild> {
    public override isValidChild(child: Node): boolean {
        return (
            child instanceof NotebookPageNode ||
            child instanceof EventControllerNode ||
            child instanceof SlotNode ||
            child instanceof ContainerSlotNode
        );
    }

    public override insertBefore(child: NotebookChild, before: NotebookChild): void {
        if (child instanceof NotebookPageNode && before instanceof NotebookPageNode) {
            const isMove = this.children.includes(child);
            const beforePosition = this.backingInstance.pageNum(before.getChildWidget());
            child.setPosition(beforePosition);

            if (isMove) {
                this.backingInstance.reorderChild(child.getChildWidget(), beforePosition);
            }
        }

        super.insertBefore(child, before);
    }

    public override removeChild(child: NotebookChild): void {
        if (child instanceof NotebookPageNode) {
            child.setPosition(null);
        }
        super.removeChild(child);
    }
}
