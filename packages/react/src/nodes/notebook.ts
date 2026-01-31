import type * as Gtk from "@gtkx/ffi/gtk";
import type { Props } from "../types.js";
import type { NotebookPageNode } from "./notebook-page.js";
import { WidgetNode } from "./widget.js";

export class NotebookNode extends WidgetNode<Gtk.Notebook, Props, NotebookPageNode> {
    public override appendChild(child: NotebookPageNode): void {
        super.appendChild(child);
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
