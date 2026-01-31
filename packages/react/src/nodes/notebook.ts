import type * as Gtk from "@gtkx/ffi/gtk";
import type { Node } from "../node.js";
import { NotebookPageNode } from "./notebook-page.js";
import { WidgetNode } from "./widget.js";

export class NotebookNode extends WidgetNode<Gtk.Notebook> {
    public override appendChild(child: Node): void {
        if (!(child instanceof NotebookPageNode)) {
            throw new Error(`Cannot append '${child.typeName}' to 'Notebook': expected x.NotebookPage`);
        }

        child.setParent(this.container);
    }

    public override insertBefore(child: Node, before: Node): void {
        if (!(child instanceof NotebookPageNode) || !(before instanceof NotebookPageNode)) {
            throw new Error(`Cannot insert '${child.typeName}' into 'Notebook': expected x.NotebookPage`);
        }

        const beforePosition = this.container.pageNum(before.getChild());
        child.setPosition(beforePosition);
        child.setParent(this.container);
    }

    public override removeChild(child: Node): void {
        if (!(child instanceof NotebookPageNode)) {
            throw new Error(`Cannot remove '${child.typeName}' from 'Notebook': expected x.NotebookPage`);
        }

        child.setPosition(null);
    }
}
