import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { NotebookPageNode } from "./notebook-page.js";
import { WidgetNode } from "./widget.js";

export class NotebookNode extends WidgetNode<Gtk.Notebook> {
    public override appendChild(child: Node): void {
        if (!(child instanceof NotebookPageNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'Notebook': expected x.NotebookPage`);
        }

        super.appendChild(child);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof NotebookPageNode) || !(before instanceof NotebookPageNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into 'Notebook': expected x.NotebookPage`);
        }

        const isMove = this.children.includes(child);
        const beforePosition = this.container.pageNum(before.getChildWidget());
        child.setPosition(beforePosition);

        if (isMove) {
            this.container.reorderChild(child.getChildWidget(), beforePosition);
        }

        super.insertBefore(child, before);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof NotebookPageNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'Notebook': expected x.NotebookPage`);
        }

        child.setPosition(null);
        super.removeChild(child);
    }
}
