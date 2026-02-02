import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import type { Props } from "../types.js";
import { NotebookPageNode } from "./notebook-page.js";
import { WidgetNode } from "./widget.js";

export class NotebookNode extends WidgetNode<Gtk.Notebook, Props, NotebookPageNode> {
    public override isValidChild(child: Node): boolean {
        return child instanceof NotebookPageNode;
    }

    public override insertBefore(child: NotebookPageNode, before: NotebookPageNode): void {
        const isMove = this.children.includes(child);
        const beforePosition = this.container.pageNum(before.getChildWidget());
        child.setPosition(beforePosition);

        if (isMove) {
            this.container.reorderChild(child.getChildWidget(), beforePosition);
        }

        super.insertBefore(child, before);
    }

    public override removeChild(child: NotebookPageNode): void {
        child.setPosition(null);
        super.removeChild(child);
    }
}
